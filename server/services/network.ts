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
import { listGpsGroupMessages, type GpsGroupMessageRow } from '@/server/lib/supabase';
import type {
  NetworkCard,
  NetworkCardWorkflowState,
  NetworkListResponse,
} from '@/shared/network-card';
import type { NetworkListInput, NetworkSetCardStateInput } from '@/shared/validation/network';

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
  const rows = await fetchUpstream({
    windowDays: input.windowDays,
    limit: input.limit,
    cursorId: Number.isFinite(cursorId) ? cursorId : undefined,
  });

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

  const items: NetworkCard[] = rows.map((row) => upstreamToCard(row, stateByMessageId));
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
  };
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
