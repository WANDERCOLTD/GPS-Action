# ADR-0019 · LinkPreview — persistent server-side store for URL preview metadata

**Status:** Accepted
**Date:** 2026-05-15
**Deciders:** Paul

## Context

`bu-network-feed` and `bu-feed-card-affordances` introduced
`server/services/link-preview-cache.ts`, an in-process LRU+TTL map
that fronts `fetchLinkMetadata` (OpenGraph / Twitter / HTML-title
scrape). Today's properties:

- Per-pod — multi-pod deploys each hold their own cache
- Lost on every deploy and cold pod boot
- ~200-entry LRU, 1-hour TTL
- Not shared across surfaces (each consumer holds its own warm-up
  cost)

This was right for the first iteration of `/network` (single
consumer, low volume). Three forces push us off it now:

1. **`bu-network-spread-gallery`** depends on URL-keyed dedup
   across the full 30-day window. An in-memory LRU that drops the
   oldest entries on overflow means the gallery's groupBy gets
   inconsistent results — the same URL may have a preview one
   minute and not the next.
2. **Cross-surface reuse.** `/compose`, `/feed` post link cards
   (D060), `/network`, and the new `/network/spread` will all
   render OG previews of the same URLs. A persistent store means
   one fetch warms every surface for every user.
3. **Cold-pod tax.** Each deploy currently triggers ~50–100
   re-fetches as the first /network requests hit cold pods. A
   persistent store removes that.

The fetch function (`fetchLinkMetadata`) is unchanged — this ADR is
about **where the result is stored** and **how it's keyed**.

## Probe data justifying the move

Sampled 120 recent URLs from /network's top 4 platforms (X, FB, IG,
YT). With a 1MB read cap (matches `fetchLinkMetadata.MAX_BYTES`):

| Platform   | Usable og:image rate |
|------------|---------------------:|
| Instagram  |  100% |
| YouTube    |   97% |
| X / Twitter |  73% (rest are connection-blocked) |
| Facebook   |   73% (rest are private/no-og) |
| **Total**  | **86%** |

86% means a gallery is feasible — but only if we don't re-fetch
every URL on every cold-pod boot.

## Options considered

- **A. Status quo (in-process LRU).** Rejected: doesn't survive
  deploy or scale across pods; the gallery's dedup contract breaks
  on cache eviction.
- **B. Redis / external cache.** Rejected for v1: adds infra
  dependency, operational cost, and we already have Postgres for
  every other piece of state. The fetch results aren't latency-
  sensitive (one cache miss costs 5s; one cache hit costs ~5ms
  via DB).
- **C. Postgres-backed `LinkPreview` model.** Selected. Same
  database we use for everything else, integrates with Prisma,
  free for our scale (~140 MB/year storage).
- **D. Postgres + L1 in-memory cache in front.** Rejected for v1:
  cache layers add invalidation risk for negligible benefit at our
  volume (~30–60 link previews per /network render × <1ms each).
  If hot-path perf shows up as an issue, an L1 in front is a v2.

## Decision

Add a new Prisma model `LinkPreview`. Read-through DB-backed cache.
Same `linkPreviewCache.get(url)` boundary — only the storage
backend changes; callers don't change.

### 1. Schema

```prisma
model LinkPreview {
  id            String   @id @default(uuid())
  url           String   @unique          // canonical lookup key
  normalizedUrl String                    // for cross-URL dedup (spread gallery)
  title         String?
  description   String?
  imageUrl      String?
  siteName      String?
  faviconUrl    String?
  linkType      String?                   // Social|Video|News|Action|Other
  fetchStatus   String                    // ok|no_og|fetch_error|blocked
  fetchedAt     DateTime
  expiresAt     DateTime
  @@index([normalizedUrl])
  @@index([expiresAt])
  @@index([linkType])
}
```

### 2. `url` is the lookup key; `normalizedUrl` is the dedup key

Two distinct fields because they serve two distinct queries:

- **`url`** (`@unique`) — the exact URL the caller passed. Used for
  the read-through cache lookup: "have I already fetched THIS URL?"
- **`normalizedUrl`** (indexed, not unique) — the same URL with
  tracking params stripped, host lowercased, fragment removed,
  trailing slash stripped, query params sorted. Used by the spread
  gallery to ask "how many distinct messages reference the same
  underlying URL?"

Two messages sharing the same article via `https://example.com/x?utm=a`
and `https://example.com/x?utm=b` will have **two** `LinkPreview` rows
(one per exact URL, so the OG fetch isn't re-done if a user pastes
either variant) but **one** `normalizedUrl` group in the spread
gallery's dedup.

Normalisation rules live in `server/lib/url-normalize.ts`:

- Lowercase host
- Drop `www.` prefix
- Strip fragment (`#...`)
- Strip tracking params: `utm_*`, `fbclid`, `gclid`, `mc_cid`,
  `mc_eid`, `ref`, `igshid`, `si`
- Strip trailing slash (except for root path)
- Alphabetise remaining query params
- Normalise scheme: `http://` → `https://`

### 3. TTL policy

`expiresAt` is set at write time per fetch result:

- `fetchStatus = ok` → 30 days (OG metadata changes slowly)
- `fetchStatus = no_og` → 30 days (page exists, just no metadata —
  no point re-fetching often)
- `fetchStatus = fetch_error|blocked` → 3 days (retry sooner; rate
  limits and transient blocks recover)

On read: if `expiresAt < now()`, treat as a miss and re-fetch.

Configurable via env vars
(`LINK_PREVIEW_OK_TTL_DAYS`, `LINK_PREVIEW_ERROR_TTL_DAYS`).

### 4. Fill strategy: lazy, on-demand

Same pattern as the current in-memory cache:

1. Caller invokes `linkPreviewCache.get(url)`.
2. Lookup row by `url`.
3. If hit and not expired → return cached value.
4. If miss or expired → call `fetchLinkMetadata`, upsert the row,
   return value.

No background populate loop, no cron refresher in v1. If a URL is
never requested, it's never in the store. The spread gallery's
read query LEFT JOINs on `url` so URLs without a cached preview
fall through to a "no-og" tile (domain-coloured fallback) rather
than blocking the render on a fetch.

### 5. `linkType` is stored, not computed at read time

Domain → type classification (`Social|Video|News|Action|Other`)
runs once at fetch time via `server/lib/url-type.ts` (a pure
function over the host). Stored on the row + indexed so type-chip
filtering on the gallery is a pure SQL `WHERE linkType IN (...)`
with index support rather than per-row regex.

Backfill on schema deploy: not needed. The in-memory cache is
per-pod and disposable; the first read after deploy populates the
new table on demand.

### 6. Stampede protection: deferred to v2

If 50 users hit the same un-cached URL simultaneously, all 50 can
trigger their own fetch. Each writes the row; the last write wins,
and 49 of them are wasted. The current code accepts this as "a
cheap duplicate." We keep that stance:

- Per-process in-flight coalescing has subtle deadlock edges and
  doesn't help across pods anyway
- DB-level advisory locks add complexity for tiny benefit at our
  volume
- Reconsider if production logs show duplicate-fetch traffic
  meaningful enough to matter

### 7. Hotlinked image expiry: MVP hotlink + fallback

We store the `imageUrl` from `og:image` but **don't proxy the
bytes**. Some platforms (Instagram `scontent.cdninstagram.com`,
Facebook `fbcdn.net`) sign their CDN URLs with expiring tokens.

- MVP: render `<img src={imageUrl} onerror={…}>` and fall back to
  the no-og card style on 404. Estimated breakage rate <10% on a
  30-day window.
- v2 (only if breakage is visible): server proxy to S3 / Vercel
  Blob with rewritten URLs. Real infra work; defer until needed.

### 8. No PII

The store holds URL → public OG metadata. No member identifiers,
no group affiliations, no message bodies. The same URL fetched by
any member resolves to the same row.

## Consequences

### Storage

~750 bytes/row × ~500 new URLs/day from /network ≈ **~140 MB/year**.
The 30-day TTL keeps the working set bounded; cold rows beyond TTL
re-fetch on next request and overwrite themselves. No retention
policy needed in v1.

### Migration

- New table, no data migration required.
- No backfill: the old in-memory `Map` is per-pod and dies on
  deploy. First read on each URL after deploy populates the new
  table.
- `linkPreviewCache.get(url)` boundary preserved; consumers don't
  change.

### Test surface

- Service tests swap from "stub the Map" to "stub the Prisma model
  or use a real test DB row." Existing integration-test pattern in
  `server/services/network.test.ts` is the template.
- New cases: hit, miss, expired-row re-fetch, error-status TTL,
  normalized-URL collision (two distinct URLs sharing
  `normalizedUrl`).

### Forward compatibility

- Adding `Content-Hash` or `bytes-stored-at` columns later for the
  image-proxy v2 is additive (nullable, no migration risk).
- Adding `multiUrls` support (when Grant's `urls text[]` is read)
  is orthogonal — the spread-gallery query gets richer, the store
  schema is unchanged.
- If a future ADR introduces an L1 cache, this table becomes the
  L2; the boundary stays the same.
