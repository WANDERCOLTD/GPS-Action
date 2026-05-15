/**
 * @build-unit BU-network-feed
 * @spec architecture/decision-log.md (D083)
 * @spec adrs/0017-network-card-state.md
 * @spec product/analytics-events.md
 *
 * Network feed service. Composes Grant (AIFA)'s read-only Supabase
 * view (`public.gps_group_messages`) with our own
 * `NetworkCardState` table (ADR-0017) and serves the joined cards
 * to the tRPC router.
 *
 * Caching: a tiny in-process LRU + TTL cache fronts the Supabase
 * fetch. At brief-locked volume (~5–10 cards/day), 20 cache entries
 * × 5-minute TTL covers the realistic query space (a handful of
 * recent cursor positions). The cache is per-process; we accept
 * cross-pod skew on multi-instance deploys — the surface tolerates
 * a 5-minute staleness window by design.
 *
 * State rows are looked up lazily — the absence of a row means
 * `NEW` at read time (per ADR-0017 §8). State mutations write
 * through Prisma + the audit log. Any mutation invalidates the
 * cache wholesale (the alternative — surgical eviction by
 * messageId — is more complex than the volume warrants).
 */

import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { isFeatureEnabled } from '@/server/services/flags';
import { getLinkPreview } from '@/server/services/link-preview-cache';
import { fetchLinkMetadata } from '@/server/services/link-metadata';
import { listSourceIconOverrides } from '@/server/services/source-icon-overrides';
import { getNetworkCardShareCounts } from '@/server/services/share-event';
import { getSystemSettingInt } from '@/server/services/system-setting';
import {
  listGpsChatLabels,
  listGpsGroupMessages,
  SupabaseConfigError,
  type GpsChatLabelRow,
  type GpsGroupMessageRow,
} from '@/server/lib/supabase';
import type {
  NetworkCard,
  NetworkCardLinkPreview,
  NetworkCardShareCounts,
  NetworkCardSource,
  NetworkCardWorkflowState,
  NetworkListResponse,
  NetworkSource,
} from '@/shared/network-card';
import { emptyNetworkCardShareCounts } from '@/shared/network-card';
import type { NetworkListInput, NetworkSetCardStateInput } from '@/shared/validation/network';

const LINK_PREVIEW_FLAG = 'network_link_previews';

// ── Cache ────────────────────────────────────────────────────────────────

interface CacheEntry {
  value: NetworkListResponse;
  expiresAt: number;
}

const CACHE_MAX_ENTRIES = 20;

function readCacheTtlMs(): number {
  const raw = process.env.NETWORK_CACHE_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
  return seconds * 1000;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(input: NetworkListInput): string {
  // Sort sources so `?source=a,b` and `?source=b,a` share a cache slot.
  const sources = input.sources.length ? [...input.sources].sort().join(',') : 'all';
  return `${input.windowDays}:${input.limit}:${input.cursor ?? 'first'}:${sources}:${input.sort}`;
}

function cacheGet(key: string): NetworkListResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  // LRU touch — re-insert to move to most-recently-used.
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function cacheSet(key: string, value: NetworkListResponse): void {
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + readCacheTtlMs() });
}

/** Wholesale cache invalidation. Used after any mutation. */
export function invalidateNetworkListCache(): void {
  cache.clear();
  sourcesCache.value = null;
}

/** Test-only: peek at cache size for assertions. */
export function _networkCacheSize(): number {
  return cache.size;
}

// ── Compound cursor (sent_at + id tiebreaker) ────────────────────────────
//
// Wire format: `<isoSentAt>|<id>`. Pipe is a safe separator — ISO 8601
// never contains one, and ids are ASCII digits. Decoder is forgiving:
// malformed or legacy id-only cursors fall through to a "first page"
// query rather than 400-ing, so a bookmarked URL from before this
// change still loads (it just starts from page 1 instead of where it
// left off).

const CURSOR_SEPARATOR = '|';

function encodeCursor(sentAt: string, id: number): string {
  return `${sentAt}${CURSOR_SEPARATOR}${id}`;
}

function decodeCursor(raw: string | undefined): { sentAt: string; id: number } | undefined {
  if (raw === undefined) return undefined;
  const idx = raw.indexOf(CURSOR_SEPARATOR);
  if (idx < 0) {
    // Legacy id-only cursor or malformed input — skip the cursor, return
    // page 1. Prevents stale bookmarks 400-ing after the format change.
    return undefined;
  }
  const sentAt = raw.slice(0, idx);
  const id = Number.parseInt(raw.slice(idx + 1), 10);
  if (!sentAt || !Number.isFinite(id)) return undefined;
  return { sentAt, id };
}

// ── Source list cache (chip strip) ───────────────────────────────────────
//
// `gps_chat_labels` changes ~weekly at most (per Grant). Per the Round 2
// rate-limit guidance, hold a 24h TTL by default. Configurable via
// NETWORK_SOURCES_CACHE_TTL_SECONDS for tests / ops. Cleared by any
// `setNetworkCardState` mutation (the same `invalidateNetworkListCache`
// path) — strictly that's wasted invalidation, since triage doesn't
// touch sources, but the alternative is fiddlier than the cost.

interface SourcesCacheEntry {
  /** Projected source set, sorted as Grant returns it. */
  list: NetworkSource[];
  /** Lookup by `chat_id` for the message-join path. */
  byChatId: Map<string, NetworkCardSource>;
  expiresAt: number;
}

const sourcesCache: { value: SourcesCacheEntry | null } = { value: null };

function readSourcesCacheTtlMs(): number {
  const raw = process.env.NETWORK_SOURCES_CACHE_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  // Default 24 hours per Grant's rate-limit guidance.
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 24 * 60 * 60;
  return seconds * 1000;
}

/**
 * Internal: fetch the labels cache entry (list + chat_id Map),
 * honouring the 24h TTL. Both `listNetworkSources` (chip-strip
 * surface) and `listNetworkCards` (message join) read through here.
 *
 * On SUPABASE config missing → degrade to an empty cache entry so
 * downstream code still sees a Map (just an empty one) and renders
 * the synthetic-source fallback path.
 */
async function getSourcesCacheEntry(deps: {
  fetchSources?: typeof listGpsChatLabels;
  bypassCache?: boolean;
}): Promise<SourcesCacheEntry> {
  if (!deps.bypassCache && sourcesCache.value && sourcesCache.value.expiresAt > Date.now()) {
    return sourcesCache.value;
  }
  const fetchSources = deps.fetchSources ?? listGpsChatLabels;
  let rows: GpsChatLabelRow[];
  try {
    rows = await fetchSources();
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      console.error(
        '[network] SUPABASE_URL / SUPABASE_ANON_KEY missing — degrading sources to empty',
      );
      const empty: SourcesCacheEntry = {
        list: [],
        byChatId: new Map(),
        expiresAt: Number.MAX_SAFE_INTEGER,
      };
      return empty;
    }
    throw err;
  }
  const list = rows.map(labelRowToSource);
  const byChatId = new Map<string, NetworkCardSource>();
  for (const row of rows) byChatId.set(row.chat_id, labelRowToSource(row));
  const entry: SourcesCacheEntry = {
    list,
    byChatId,
    expiresAt: Date.now() + readSourcesCacheTtlMs(),
  };
  if (!deps.bypassCache) {
    sourcesCache.value = entry;
  }
  return entry;
}

/**
 * bu-network-source-chips — fetch the active source set for the chip
 * strip. Cached at 24h TTL by default (configurable). Empty when
 * SUPABASE_URL / SUPABASE_ANON_KEY are missing — degrades gracefully
 * the same way `listNetworkCards` does.
 */
export async function listNetworkSources(
  deps: {
    fetchSources?: typeof listGpsChatLabels;
    /** Skip the cache layer — used by tests. */
    bypassCache?: boolean;
    /** Override the override-map fetcher — primarily for tests (ADR-0020). */
    fetchOverrides?: typeof listSourceIconOverrides;
  } = {},
): Promise<NetworkSource[]> {
  const entry = await getSourcesCacheEntry(deps);
  const fetchOverrides = deps.fetchOverrides ?? listSourceIconOverrides;
  const overrides = await fetchOverrides();
  return entry.list.map((source) => ({
    ...source,
    iconOverride: overrides.get(source.slug) ?? null,
  }));
}

/** Wholesale source-cache invalidation. Exposed for admin "Refresh sources". */
export function invalidateNetworkSourcesCache(): void {
  sourcesCache.value = null;
}

function labelRowToSource(row: GpsChatLabelRow): NetworkCardSource {
  return {
    slug: row.slug,
    label: row.label,
    description: row.description,
    displayOrder: row.display_order,
    color: row.color,
    icon: row.icon,
    memberCount: row.member_count,
  };
}

// ── List ─────────────────────────────────────────────────────────────────

interface ListDeps {
  /** Override the upstream fetcher — primarily for tests. */
  fetchUpstream?: typeof listGpsGroupMessages;
  /**
   * bu-network-source-chips — override the labels fetcher for the
   * service-side join. Tests pass a stub that returns canned label
   * rows; default reads from `listGpsChatLabels`. Hits the same 24h
   * cache as `listNetworkSources`.
   */
  fetchLabels?: typeof listGpsChatLabels;
  /**
   * Override the link-preview enrichment path. Default reads the
   * `network_link_previews` flag and (when on) fetches OG metadata via
   * the cached fetcher. Tests pass `() => Promise.resolve(null)` to
   * skip enrichment, or a stub that returns canned metadata.
   */
  resolveLinkPreview?: (url: string) => Promise<NetworkCardLinkPreview | null>;
  /**
   * bu-network-shares — override the share-counts projection. Default
   * reads from the ShareEvent table via `getNetworkCardShareCounts`.
   * Tests pass `() => Promise.resolve(new Map())` to skip the projection,
   * or a stub that returns canned counts.
   */
  fetchShareCounts?: (messageIds: string[]) => Promise<Map<string, NetworkCardShareCounts>>;
}

export async function listNetworkCards(
  input: NetworkListInput,
  deps: ListDeps = {},
): Promise<NetworkListResponse> {
  const key = cacheKey(input);

  // bu-network-card-body-clamp — threshold lives outside the LRU cache
  // so an admin update via /settings takes effect on the next request
  // without an explicit cache bust. Cheap (one indexed lookup) and
  // decorates onto whatever response we return below.
  const bodyClampThresholdLines = await readBodyClampThresholdLines();

  if (!input.refresh) {
    const cached = cacheGet(key);
    if (cached) return { ...cached, fromCache: true, bodyClampThresholdLines };
  } else {
    cache.delete(key);
  }

  const fetchUpstream = deps.fetchUpstream ?? listGpsGroupMessages;
  const decodedCursor = decodeCursor(input.cursor);

  // bu-network-source-chips — labels first so we can resolve the
  // slug filter into chat_ids and push them upstream into the
  // messages query. Doing the filter in PostgREST (rather than post-
  // fetch in JS) is essential: a 50-row id-DESC page from one source
  // can completely shadow another source's rows (e.g. after a
  // backfill into one chat), so a service-side filter would yield
  // zero results from a chat that genuinely has recent activity.
  // Labels hit the 24h cache so this is essentially free after the
  // first call per process.
  let labels: SourcesCacheEntry;
  try {
    labels = await getSourcesCacheEntry({ fetchSources: deps.fetchLabels });
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      console.error('[network] SUPABASE_URL / SUPABASE_ANON_KEY missing — degrading to empty list');
      return {
        items: [],
        nextCursor: null,
        fetchedAt: new Date(),
        fromCache: false,
        bodyClampThresholdLines,
      };
    }
    throw err;
  }

  // Resolve slug filter → chat_id allowlist. Unknown slugs silently drop.
  let chatIdAllowlist: string[] | undefined;
  if (input.sources.length > 0) {
    const allowedSlugs = new Set(input.sources);
    const ids: string[] = [];
    for (const [chatId, source] of labels.byChatId) {
      if (allowedSlugs.has(source.slug)) ids.push(chatId);
    }
    // Empty list = the slug(s) match nothing. Short-circuit to avoid
    // an upstream call with `chat_id=in.()` (PostgREST treats empty IN
    // as a parse error in some versions).
    if (ids.length === 0) {
      const empty: NetworkListResponse = {
        items: [],
        nextCursor: null,
        fetchedAt: new Date(),
        fromCache: false,
        bodyClampThresholdLines,
      };
      cacheSet(key, empty);
      return empty;
    }
    chatIdAllowlist = ids;
  }

  let rows: GpsGroupMessageRow[];
  try {
    rows = await fetchUpstream({
      windowDays: input.windowDays,
      limit: input.limit,
      cursor: decodedCursor,
      direction: input.sort === 'oldest' ? 'asc' : 'desc',
      chatIds: chatIdAllowlist,
    });
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      console.error('[network] SUPABASE_URL / SUPABASE_ANON_KEY missing — degrading to empty list');
      return {
        items: [],
        nextCursor: null,
        fetchedAt: new Date(),
        fromCache: false,
        bodyClampThresholdLines,
      };
    }
    throw err;
  }

  const messageIds = rows.map((row) => BigInt(row.id));
  const stateRows = messageIds.length
    ? await prisma.networkCardState.findMany({
        where: { messageId: { in: messageIds } },
        select: {
          messageId: true,
          status: true,
          ownerUserId: true,
          ownerUser: { select: { displayName: true } },
          notes: true,
          updatedAt: true,
        },
      })
    : [];

  const stateByMessageId = new Map<string, NetworkCardWorkflowState>();
  for (const row of stateRows) {
    stateByMessageId.set(row.messageId.toString(), {
      status: row.status,
      ownerUserId: row.ownerUserId,
      ownerDisplayName: row.ownerUser?.displayName ?? null,
      notes: row.notes,
      updatedAt: row.updatedAt,
    });
  }

  const baseItems: NetworkCard[] = rows.map((row) =>
    upstreamToCard(row, stateByMessageId, labels.byChatId),
  );
  const resolveLinkPreview = deps.resolveLinkPreview ?? (await buildDefaultLinkPreviewResolver());
  const previewedItems = await enrichWithLinkPreviews(baseItems, resolveLinkPreview);

  // bu-network-shares — bulk-project verified share counts for the
  // visible window. One query covers every card in the page; cards
  // with zero shares get a zero-filled object so the renderer never
  // sees `undefined`.
  const fetchShareCounts = deps.fetchShareCounts ?? defaultShareCountsFetcher;
  const messageIdStrings = previewedItems.map((c) => c.id.toString());
  const shareCountsByMessageId = await fetchShareCounts(messageIdStrings);
  const items = previewedItems.map((card) => ({
    ...card,
    shareCounts: shareCountsByMessageId.get(card.id.toString()) ?? emptyNetworkCardShareCounts(),
  }));

  const lastRow = rows.length === input.limit ? rows[rows.length - 1] : undefined;
  const nextCursor = lastRow ? encodeCursor(lastRow.sent_at, lastRow.id) : null;

  const response: NetworkListResponse = {
    items,
    nextCursor,
    fetchedAt: new Date(),
    fromCache: false,
    bodyClampThresholdLines,
  };

  cacheSet(key, response);
  return response;
}

/**
 * bu-network-card-body-clamp — read the admin-tunable threshold from
 * `SystemSetting`. Default 6 (seeded by migration; also the fallback
 * when the row is missing for any reason). Wrapped in its own helper
 * so the value is consistently sourced + so the lookup can be moved
 * behind its own cache later if the per-request DB hit ever shows
 * up in profiling (it shouldn't — single-row indexed lookup).
 */
async function readBodyClampThresholdLines(): Promise<number> {
  return getSystemSettingInt('network_card_body_clamp_threshold_lines', 6);
}

// ── Link preview enrichment ──────────────────────────────────────────────

/**
 * Build a per-list resolver. The FF check happens once here, not once
 * per card — flag-off lists pay a single DB hit, not N. When the flag
 * is off we hand back a no-op resolver so the parallel `Promise.all`
 * inside `enrichWithLinkPreviews` is effectively free.
 *
 * When on, each URL hits the in-process LRU+TTL cache; only true
 * cache misses reach the network. Any thrown error is swallowed to
 * `null` — preview is decorative, never load-bearing.
 */
async function buildDefaultLinkPreviewResolver(): Promise<
  (url: string) => Promise<NetworkCardLinkPreview | null>
> {
  const enabled = await isFeatureEnabled(LINK_PREVIEW_FLAG);
  if (!enabled) return async () => null;
  return async (url: string) => {
    try {
      const metadata = await getLinkPreview(url, { fetcher: fetchLinkMetadata });
      if (!metadata) return null;
      return {
        title: metadata.title,
        description: metadata.description,
        imageUrl: metadata.imageUrl,
        siteName: metadata.siteName,
        faviconUrl: metadata.faviconUrl,
      };
    } catch {
      return null;
    }
  };
}

/**
 * Enrich every card in parallel. Total latency is bounded by the
 * slowest single fetch (5s timeout cap inside `fetchLinkMetadata`),
 * not the sum. `Promise.all` is safe because the resolver swallows
 * its own errors — no rejection escapes.
 */
async function enrichWithLinkPreviews(
  cards: NetworkCard[],
  resolve: (url: string) => Promise<NetworkCardLinkPreview | null>,
): Promise<NetworkCard[]> {
  if (cards.length === 0) return cards;
  const previews = await Promise.all(cards.map((card) => resolve(card.url)));
  return cards.map((card, idx) => ({ ...card, linkPreview: previews[idx] ?? null }));
}

function upstreamToCard(
  row: GpsGroupMessageRow,
  stateByMessageId: Map<string, NetworkCardWorkflowState>,
  sourceByChatId: Map<string, NetworkCardSource>,
): NetworkCard {
  const id = BigInt(row.id);
  const state = stateByMessageId.get(id.toString()) ?? defaultState();
  return {
    id,
    sentAt: new Date(row.sent_at),
    url: row.url,
    linkTitle: row.link_title,
    textBody: bodyOrNullWhenJustUrl(row.text_body, row.url),
    fromName: row.from_name,
    senderHash: row.sender_hash,
    chatId: row.chat_id,
    state,
    linkPreview: null,
    // Replaced by the bulk projection after enrichment. Seed with the
    // zero object so the type is always satisfied before the join.
    shareCounts: emptyNetworkCardShareCounts(),
    source: sourceForChatId(row.chat_id, row.id, sourceByChatId),
    isForwarded: row.is_forwarded,
  };
}

/**
 * bu-network-source-chips — look up the source for a message's
 * `chat_id` in the labels Map (cached separately at 24h TTL).
 * `gps_chat_labels` is a view of `gps.allowed_chats`, so every
 * message row should hit; if it ever doesn't (labels cache empty
 * from a SUPABASE config miss, or Grant adds a chat without a label
 * row), fall back to a synthetic source derived from `chat_id` so
 * the renderer still has something to display.
 */
function sourceForChatId(
  chatId: string,
  messageId: number,
  sourceByChatId: Map<string, NetworkCardSource>,
): NetworkCardSource {
  const source = sourceByChatId.get(chatId);
  if (source) return source;
  // Warn once per missing chat_id per process — labels cache is
  // long-lived (24h), so the same chat_id would warn on every call
  // through the day. Bounded set keeps the log volume sane.
  if (!warnedMissingChatIds.has(chatId)) {
    console.warn(
      `[network] no gps_chat_labels row for chat_id=${chatId} (message id=${messageId}); falling back to synthetic source`,
    );
    warnedMissingChatIds.add(chatId);
  }
  return {
    slug: 'unknown',
    label: chatId,
    description: null,
    displayOrder: 9999,
    color: null,
    icon: null,
    memberCount: null,
  };
}

const warnedMissingChatIds = new Set<string>();

/**
 * bu-network-shares — default projection. Wraps the share-event service
 * and reshapes its ShareCounts (which carries a Record<ShareDestination,
 * number>) into the wire-friendly `NetworkCardShareCounts` shape (which
 * has known-key fields). The two shapes carry identical data; the
 * wire shape is enumerated so it serialises cleanly through tRPC +
 * the server-component → client-component boundary without an `enum`
 * import on the client side.
 */
async function defaultShareCountsFetcher(
  messageIds: string[],
): Promise<Map<string, NetworkCardShareCounts>> {
  const raw = await getNetworkCardShareCounts(messageIds);
  const out = new Map<string, NetworkCardShareCounts>();
  for (const [id, counts] of raw) {
    out.set(id, {
      total: counts.total,
      perDestination: {
        whatsapp: counts.perDestination.whatsapp ?? 0,
        x: counts.perDestination.x ?? 0,
        instagram: counts.perDestination.instagram ?? 0,
        facebook: counts.perDestination.facebook ?? 0,
        email: counts.perDestination.email ?? 0,
        copy_link: counts.perDestination.copy_link ?? 0,
        other: counts.perDestination.other ?? 0,
      },
    });
  }
  return out;
}

function defaultState(): NetworkCardWorkflowState {
  return {
    status: 'NEW',
    ownerUserId: null,
    ownerDisplayName: null,
    notes: null,
    updatedAt: null,
  };
}

/**
 * Suppress `text_body` when it equals the URL itself — about 70% of
 * link-only messages have no commentary, and rendering the URL twice
 * (title + body) is noise.
 */
function bodyOrNullWhenJustUrl(body: string | null, url: string): string | null {
  if (!body) return null;
  const trimmed = body.trim();
  if (trimmed === url || trimmed === url.trim()) return null;
  return body;
}

// ── Mutate ───────────────────────────────────────────────────────────────

interface SetCardStateArgs extends NetworkSetCardStateInput {
  callerId: string;
}

export async function setNetworkCardState(
  args: SetCardStateArgs,
): Promise<NetworkCardWorkflowState> {
  const { messageId, status, ownerUserId, notes, callerId } = args;

  const row = await prisma.networkCardState.upsert({
    where: { messageId },
    create: {
      messageId,
      status,
      ownerUserId: ownerUserId ?? null,
      notes: notes ?? null,
    },
    update: {
      status,
      ...(ownerUserId !== undefined ? { ownerUserId } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    select: {
      messageId: true,
      status: true,
      ownerUserId: true,
      ownerUser: { select: { displayName: true } },
      notes: true,
      updatedAt: true,
    },
  });

  await auditLog({
    action: `network_card.${status.toLowerCase()}`,
    entityType: 'networkCardState',
    entityId: row.messageId.toString(),
    userId: callerId,
    changes: {
      status: row.status,
      ownerUserId: row.ownerUserId,
    },
  });

  invalidateNetworkListCache();

  return {
    status: row.status,
    ownerUserId: row.ownerUserId,
    ownerDisplayName: row.ownerUser?.displayName ?? null,
    notes: row.notes,
    updatedAt: row.updatedAt,
  };
}
