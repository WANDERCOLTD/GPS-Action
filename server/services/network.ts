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
import { getNetworkCardShareCounts } from '@/server/services/share-event';
import {
  listGpsGroupMessages,
  SupabaseConfigError,
  type GpsGroupMessageRow,
} from '@/server/lib/supabase';
import type {
  NetworkCard,
  NetworkCardLinkPreview,
  NetworkCardShareCounts,
  NetworkCardWorkflowState,
  NetworkListResponse,
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
  return `${input.windowDays}:${input.limit}:${input.cursor ?? 'first'}`;
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
}

/** Test-only: peek at cache size for assertions. */
export function _networkCacheSize(): number {
  return cache.size;
}

// ── List ─────────────────────────────────────────────────────────────────

interface ListDeps {
  /** Override the upstream fetcher — primarily for tests. */
  fetchUpstream?: typeof listGpsGroupMessages;
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

  if (!input.refresh) {
    const cached = cacheGet(key);
    if (cached) return { ...cached, fromCache: true };
  } else {
    cache.delete(key);
  }

  const fetchUpstream = deps.fetchUpstream ?? listGpsGroupMessages;
  const cursorId = input.cursor !== undefined ? Number.parseInt(input.cursor, 10) : undefined;
  let rows: GpsGroupMessageRow[];
  try {
    rows = await fetchUpstream({
      windowDays: input.windowDays,
      limit: input.limit,
      cursorId: Number.isFinite(cursorId) ? cursorId : undefined,
    });
  } catch (err) {
    // Graceful degrade when SUPABASE_URL / SUPABASE_ANON_KEY are absent —
    // the surface promised in .env.example is "returns an empty list".
    // Don't cache: a server restart with vars set should serve real data
    // immediately, not the empty placeholder.
    if (err instanceof SupabaseConfigError) {
      // Leave a breadcrumb in Vercel runtime logs. Without this the
      // empty list is indistinguishable from a genuinely empty upstream
      // — every prior debug session lost an hour to that ambiguity.
      console.error('[network] SUPABASE_URL / SUPABASE_ANON_KEY missing — degrading to empty list');
      return { items: [], nextCursor: null, fetchedAt: new Date(), fromCache: false };
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

  const baseItems: NetworkCard[] = rows.map((row) => upstreamToCard(row, stateByMessageId));
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
  const nextCursor = lastRow ? String(lastRow.id) : null;

  const response: NetworkListResponse = {
    items,
    nextCursor,
    fetchedAt: new Date(),
    fromCache: false,
  };

  cacheSet(key, response);
  return response;
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
  };
}

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
