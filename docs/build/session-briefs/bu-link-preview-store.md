---
slug: bu-link-preview-store
status: shipped
shipped_in: "#369"
phase: 2
priority: medium
note: "Brief v0.2 (2026-05-15, groomed for build). Foundation BU — promotes the in-memory link-preview LRU to a Postgres-backed store keyed by URL. Zero user-visible change at ship; unlocks cross-surface reuse (feed cards, compose, network spread gallery) and survives deploys. Four open decisions locked. Companion: bu-network-spread-gallery (depends on this shipping)."
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

## Decisions locked (2026-05-15)

1. **`normalizedUrl` rules** — `server/lib/url-normalize.ts`:
   - Lowercase host; drop `www.` prefix
   - Strip URL fragment (`#...`)
   - Strip `utm_*`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`, `ref`,
     `igshid`, `si` query params
   - Strip trailing slash on path (but preserve `/` for root)
   - Re-sort remaining query params alphabetically (so
     `?a=1&b=2` and `?b=2&a=1` collide)
   - Preserve scheme but normalise `http://` and `https://` to
     `https://` for storage (real fetcher follows the redirect anyway)
2. **Stampede protection** — **defer to v2.** Current behaviour
   ("cheap duplicate fetch on race") stays. Add only if production
   logs show meaningful duplicate-fetch traffic.
3. **Hotlinked image expiry** — **hotlink for MVP** with `onerror`
   fallback to a domain-coloured "no-image" card. Server-side image
   proxy (S3 / Vercel Blob) is a v2 if observed breakage > ~10% on
   30-day window.
4. **`linkType`** — **stored + indexed** on the row. Computed once
   at fetch time via `server/lib/url-type.ts` (domain-list based,
   buckets: `Social|Video|News|Action|Other`). Backfill is trivial
   since the in-memory cache is per-pod and disposable.
5. **Consumer migration** — swap call sites to read from the DB-
   backed cache directly. No L1 in-memory cache in front; one Prisma
   query per card-list render is fine at our volume (~30–60 cards per
   page × 1 query each is well within the existing Postgres budget).
6. **Test fixtures** — service-layer mocks (vi.mock the
   `linkPreviewCache` module). Integration test against a real DB
   row covers the happy-path read-through behaviour. Match the
   pattern in `server/services/network.test.ts`.

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


## Build steps (in order)

1. **ADR** — write `docs/adrs/0019-link-preview-store.md` documenting
   the new `LinkPreview` model, TTL policy, fill strategy, and the
   four locked decisions above. Schema is contract-locked (CLAUDE.md);
   ADR ships in the same PR as the migration.
2. **Prisma model + migration** — add `LinkPreview` to
   `prisma/schema.prisma`, generate migration via `pnpm prisma migrate
   dev --name add-link-preview-store`. Index on `normalizedUrl`,
   `expiresAt`, `linkType`. Unique on `url`.
3. **`server/lib/url-normalize.ts`** — pure function
   `normalizeUrl(input: string): string`. Tracking-param strip list,
   trailing-slash, alphabetised query, host lowercase, `www.` strip.
   Co-located unit tests cover ~12 canonical pairs.
4. **`server/lib/url-type.ts`** — pure function
   `classifyUrl(host: string): LinkType` where `LinkType = 'Social' |
   'Video' | 'News' | 'Action' | 'Other'`. Domain-list constants
   (see probe data table above). Suffix-match for `*.substack.com`.
   Co-located unit tests.
5. **`server/services/link-preview-cache.ts` refactor** — replace
   in-memory `Map` with Prisma read-through. Preserve the
   `linkPreviewCache.get(url)` boundary so callers don't change.
   Logic: lookup by `url` → if hit and `expiresAt > now`, return
   stored value; else fetch via `fetchLinkMetadata`, write row with
   status + TTL, return value. Failure caching: persist
   `fetchStatus = fetch_error|blocked` with 3-day TTL.
6. **Consumer migration** — `server/services/network.ts` is the only
   current caller of any consequence. Swap is invisible (same
   function signature). Verify no other call sites broke via
   `grep -rn "linkPreviewCache"`.
7. **Tests** — update `server/services/link-preview-cache.test.ts`
   to test the DB-backed path. Add 3 new integration tests:
   (a) miss → fetch → write → next-call-is-hit;
   (b) expired row triggers re-fetch;
   (c) failure caches `fetch_error` and is not refetched until
   TTL expiry.
8. **Run** `pnpm typecheck && pnpm lint && pnpm test` and commit.

## Acceptance criteria

- [x] `LinkPreview` model migrated; indexes on `normalizedUrl`,
      `expiresAt`, `linkType`.
- [x] `linkPreviewCache.get(url)` reads from DB, writes on miss
      after `fetchLinkMetadata` succeeds. In-memory `Map` removed.
- [x] `server/services/network.ts` continues to render the same
      link-preview output to /network (no visible regression).
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass.
- [x] ADR-0019 merged in the same PR.

## What's NOT in this BU

- The `/network/spread` gallery itself — that's `bu-network-spread-
  gallery`, which depends on this shipping.
- Background populate / refresher loop.
- Image proxy / S3 storage.
- Stampede coalescer.
- Multi-URL extraction from `gps_group_messages.urls text[]`.
