---
slug: bu-link-preview-store
status: planned
phase: 2
priority: medium
note: "Stub 2026-05-14. Foundation BU — promotes the in-memory link-preview LRU to a Postgres-backed store keyed by URL. Zero user-visible change at ship; unlocks cross-surface reuse (feed cards, compose, network spread gallery) and survives deploys. Precondition for bu-network-spread-gallery."
---

# SESSION BRIEF · bu-link-preview-store — persist link-preview cache to Postgres

_Stub · Created: 2026-05-14. Foundation for bu-network-spread-gallery
and any future cross-surface preview reuse._

---

## Why

`server/services/link-preview-cache.ts` is an in-process LRU+TTL map.
Per-pod, lost on every deploy, not shared across users or surfaces.
Today that's fine — `/network` is the only consumer at meaningful
volume — but it doesn't scale to the next surfaces that need the same
data:

- **`/network/spread`** (bu-network-spread-gallery) — tile thumbnails
  for every URL ever seen, dedup-keyed by `normalizedUrl`. Cold-pod
  re-fetch of every URL on each deploy is the wrong shape.
- **`/compose`** — when a member pastes a URL that someone else
  already shared on `/network`, the preview should appear instantly,
  not trigger another upstream fetch.
- **`/feed` post link cards** (D060) — same reuse.

Promote the cache to a Prisma model. Single shared store, write-once,
serves every surface. The function boundary (`linkPreviewCache.get`)
stays the same; only the storage backend changes.

## Probe data justifying the move

Sampled 120 recent URLs from the top 4 platforms (X, FB, IG, YT)
in `/network`. ~86% have a usable og:image. Gallery is feasible
*if* we don't re-fetch every URL on every cold-pod boot. Persistent
store removes that tax.

Per-platform usable og:image rate (1MB read cap, matches existing
`fetchLinkMetadata.MAX_BYTES`):

| Platform   | Usable | Notes |
|------------|-------:|-------|
| Instagram  |  100%  | scontent.cdninstagram.com — signed-token URLs (may expire) |
| YouTube    |   97%  | i.ytimg.com/vi/{id}/maxresdefault.jpg |
| X / Twitter |  73%  | rest are connection-blocked (rate limit / bot detection) |
| Facebook   |   73%  | rest are private posts → no og:image |
| **Total**  | **86%** | |

## Proposed shape

```prisma
model LinkPreview {
  id            String   @id @default(uuid())
  url           String   @unique          // canonical key
  normalizedUrl String                    // for spread-gallery groupBy
  title         String?
  description   String?
  imageUrl      String?
  siteName      String?
  faviconUrl    String?
  linkType      String?                   // Social|Video|News|Action|Other (lib/url-type.ts)
  fetchStatus   String                    // ok|no_og|fetch_error|blocked
  fetchedAt     DateTime
  expiresAt     DateTime
  @@index([normalizedUrl])
  @@index([expiresAt])
  @@index([linkType])
}
```

Storage cost: ~750 bytes/row × ~500 new URLs/day from network feed
≈ **~140 MB/year**. Trivial.

Fill pattern: **lazy** (read-through on miss). Same as today, just
persisted. Background populate / refresher = v2.

TTLs:
- `fetchStatus = ok` → 30d
- `fetchStatus = fetch_error|blocked` → 3d (retry sooner)
- `fetchStatus = no_og` → 30d (page exists, just no metadata; don't keep retrying)

## Open product / engineering questions

1. **`normalizedUrl` rules.** Strip `utm_*`, fragments, lowercase host,
   strip trailing slash, drop `www.`. Anything else? Sharon-style
   "share the same article from different paths" requires this to
   be tight enough that two readers' copies of one article collide.
2. **Stampede protection on cold URL.** Today: accepted as a cheap
   duplicate. Worth a tRPC-level in-flight Promise-coalescer in this
   BU, or defer to v2 if logs show it matters?
3. **Hotlinked image expiry.** Instagram/FB signed-token URLs can
   expire. Render with `onerror` fallback to text-only card for MVP;
   server-side proxy + S3/Blob storage is a v2 if breakage is visible.
   Lock this MVP-only stance now?
4. **`linkType` stored vs computed.** Storing avoids per-read regex
   but requires a one-time backfill on the existing in-memory misses.
   Recommend stored + indexed.
5. **Migration of existing consumers.** `server/services/network.ts`
   uses the LRU directly. Swap to new service, or keep LRU as an L1
   in front of the DB read? L1 is overkill at our volume; one query
   per card list is fine.
6. **Test fixtures.** Existing tests stub the in-memory LRU directly.
   New test surface = a Prisma model — need an integration fixture or
   a service-layer mock?

## Surface this BU depends on

- `server/services/link-preview-cache.ts` (existing — boundary stays,
  backend swaps).
- `server/services/link-metadata.ts` (existing — `fetchLinkMetadata`
  unchanged).
- New: `server/lib/url-normalize.ts` (~20 lines).
- New: `server/lib/url-type.ts` (~50 lines, domain-list based — buckets
  from probe data: Social, Video, News, Action, Other).
- Prisma migration adding `LinkPreview` model.

## Not in scope

- Background populate / refresher loop (v2).
- Server-side image proxy to S3 / Blob (v2 if hotlink breakage > ~10%).
- Stampede coalescer (deferred unless this BU's reviewer decides
  otherwise).
- Multi-URL extraction from a single message (Grant ships `urls text[]`
  upstream; consuming it is a separate BU).

## Acceptance criteria (rough)

- `LinkPreview` model migrated; index on `normalizedUrl`, `expiresAt`,
  `linkType`.
- `linkPreviewCache.get(url)` reads from DB, writes on miss after a
  successful `fetchLinkMetadata`. In-memory LRU removed.
- All four surfaces (`/network`, `/compose`, `/feed`, anywhere
  preview-card data is rendered) read from the same store.
- Existing tests still pass; new integration test verifies a URL
  fetched on one surface is instantly available on another.
- No user-visible change beyond "previews appear faster after the
  first user warms them."

## Next step

Paul to confirm the four locked-questions above (normalize rules,
stampede stance, hotlink stance, linkType storage) and approve this
as a foundation BU. Once locked, this is a one-PR build — schema +
service swap + tests.
