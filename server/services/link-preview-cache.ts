/**
 * @build-unit BU-network-link-previews
 * @spec build/session-briefs/bu-network-link-previews.md
 *
 * URL-keyed LRU+TTL cache fronting `fetchLinkMetadata`. Used by the
 * network feed service to enrich each card with OpenGraph data
 * without re-fetching identical URLs on every page load.
 *
 * Mirrors the cache pattern in `server/services/network.ts` (in-process
 * Map with LRU touch + expiry sweep on read). Per-process — multi-pod
 * deploys accept cross-pod skew. Failures are cached too (as `null`):
 * a temporarily-broken URL still avoids hammering the upstream on
 * every render. TTL handles eventual recovery without a manual flush.
 *
 * The cache is intentionally write-once-per-key on a miss path: if two
 * concurrent calls for the same URL race, both will fetch — that's a
 * cheap duplicate, not a correctness bug. A request-coalescing layer
 * (single in-flight Promise per key) is a follow-up if duplicate
 * fetches show up in logs.
 */

import { fetchLinkMetadata, type LinkMetadata } from '@/server/services/link-metadata';

interface CacheEntry {
  value: LinkMetadata | null;
  expiresAt: number;
}

function readMaxEntries(): number {
  const raw = process.env.NETWORK_LINK_PREVIEW_MAX_ENTRIES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  // 200 default holds ~1 month of network-feed URLs at observed
  // volume. Override via env for tests or aggressive sizing.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
}

function readCacheTtlMs(): number {
  const raw = process.env.NETWORK_LINK_PREVIEW_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  // 1 hour default — link metadata changes slowly. Override via env
  // for tests or aggressive flushing.
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
  return seconds * 1000;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(url: string): { hit: true; value: LinkMetadata | null } | { hit: false } {
  const entry = cache.get(url);
  if (!entry) return { hit: false };
  if (entry.expiresAt < Date.now()) {
    cache.delete(url);
    return { hit: false };
  }
  // LRU touch — re-insert to move to most-recently-used.
  cache.delete(url);
  cache.set(url, entry);
  return { hit: true, value: entry.value };
}

function cacheSet(url: string, value: LinkMetadata | null): void {
  const max = readMaxEntries();
  if (cache.size >= max && !cache.has(url)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(url, { value, expiresAt: Date.now() + readCacheTtlMs() });
}

/** Wholesale cache invalidation. Used by admin escape hatch + tests. */
export function invalidateLinkPreviewCache(): void {
  cache.clear();
}

/** Test-only: peek at cache size for assertions. */
export function _linkPreviewCacheSize(): number {
  return cache.size;
}

interface GetLinkPreviewDeps {
  /** Override the underlying fetcher. Tests inject; production uses default. */
  fetcher?: typeof fetchLinkMetadata;
}

/**
 * Returns OpenGraph metadata for `url`, or `null` when the fetch
 * fails or the page has no parseable metadata. Result is cached;
 * a null is also cached so a broken URL doesn't re-fetch on every
 * list call.
 */
export async function getLinkPreview(
  url: string,
  deps: GetLinkPreviewDeps = {},
): Promise<LinkMetadata | null> {
  const cached = cacheGet(url);
  if (cached.hit) return cached.value;

  const fetcher = deps.fetcher ?? fetchLinkMetadata;
  const result = await fetcher({ url });
  const value: LinkMetadata | null = result.ok ? result.data : null;
  cacheSet(url, value);
  return value;
}
