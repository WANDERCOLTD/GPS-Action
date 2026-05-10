---
slug: BU-network-link-previews
status: in_progress
phase: 2
priority: medium
note: "Hero/title/description previews for /network cards. Reuses existing fetchLinkMetadata + LinkPreviewCard. New FF network_link_previews."
---

# SESSION BRIEF · bu-network-link-previews — hero images on /network cards

_Author: Paul + Claude · Created: 2026-05-10_
_Type: Read-side enrichment. No schema change. Reuses `fetchLinkMetadata` and `<LinkPreviewCard>` from the post composer._

---

## Objective

`/network` cards today render plain text — title (or hostname) +
sender + body. The upstream Supabase view exposes no image. Make them
nice: fetch OpenGraph metadata server-side for each card's URL, cache
it in-process, and render the existing `<LinkPreviewCard size="large">`
hero block inside `<NetworkCard>`. Behind a new feature flag,
default ON in dev (auto-flipped by `seed.ts`), default OFF in prod
per D036.

## Scope

### Build in this session

- `server/services/link-preview-cache.ts` (new — URL-keyed LRU+TTL
  wrapper around `fetchLinkMetadata`)
- `server/services/network.ts` (modified — enrich each card via cache,
  parallel, gated by FF)
- `shared/network-card.ts` (modified — add `linkPreview` field on
  `NetworkCard` + `SerializedNetworkCard`)
- `components/NetworkCard.tsx` (modified — render `<LinkPreviewCard>`
  when `linkPreview` present)
- `prisma/migrations/<ts>_seed_feature_flag_network_link_previews/migration.sql`
  (new — seed `network_link_previews` flag, default OFF in prod per D036)
- `docs/product/feature-flag-register.md` (modified — register the new flag)
- `tests/unit/link-preview-cache.test.ts` (new)
- `tests/unit/network-card.test.tsx` (modified — assert preview render)
- `tests/integration/network-service.test.ts` (modified — assert
  enrichment with FF on; absence with FF off; failure swallowed)
- `package.json` (version bump, patch)

### Do NOT touch

- `prisma/schema.prisma` (no schema change — reuse existing types)
- `server/services/link-metadata.ts` (already shipped, reused as-is)
- `components/LinkPreviewCard.tsx` (already shipped, reused as-is)
- `server/lib/supabase.ts` (upstream contract is fixed)
- `server/routers/network.ts` (no router-level change; FF gate is
  evaluated inside the service for this enrichment, not blocking the
  whole list)

## Contracts

### Inputs consumed

- `fetchLinkMetadata({url})` from `server/services/link-metadata.ts`
- `isFeatureEnabled(name)` from `server/services/flags.ts`
- `GpsGroupMessageRow.url` from `server/lib/supabase.ts`

### Outputs produced

- `NetworkCard.linkPreview: { title, description, imageUrl, siteName } | null`
- `SerializedNetworkCard.linkPreview` (same shape, wire-serialised)

## Acceptance criteria

- [ ] FF on: each card with a fetchable URL renders a
      `<LinkPreviewCard>` hero with title + image + description
- [ ] FF off: cards render exactly as before — no fetcher hit, no
      preview block
- [ ] Fetch failures (timeout / 4xx / 5xx / non-html) silently fall
      back to today's plain render — no error spinner, no console noise
- [ ] Cache: a second `list` call within TTL hits the cache, no
      duplicate upstream fetches
- [ ] Cache: LRU evicts oldest entry past max size
- [ ] No regressions in existing `network-service.test.ts`
- [ ] Per-card fetch is parallel; total list latency bounded by the
      slowest single fetch (not the sum)

## Tests required

- Unit: `link-preview-cache.test.ts` — TTL expiry, LRU eviction, hit /
  miss, failure caching (negative cache so a broken URL doesn't
  re-fetch on every list)
- Component: `network-card.test.tsx` — preview present → render
  `<LinkPreviewCard>`; preview null → no preview block
- Integration: `network-service.test.ts` — FF on with stubbed fetcher
  enriches; FF off skips fetcher entirely; fetcher rejection leaves
  `linkPreview: null`

## Definition of done

- [ ] All files in "Build" list created or modified; nothing else
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all pass
- [ ] Manual click-through on `/network` in dev — heroes render for
      the three real cards (YouTube, Facebook reel, archive.ph)
- [ ] Status flipped to `shipped`, `shipped_in: "#NNN"` added
- [ ] `pnpm trackers` run, `bu-sequence.md` AUTOGEN refreshed
- [ ] Feature-flag register updated
- [ ] Version bumped (PATCH)
- [ ] PR description names the new flag explicitly (D036 §6)

## Open questions to surface

(Answered before starting per user direction:)

- Library: hand-roll? **No — reuse `fetchLinkMetadata`**.
- Cache: persistent? **No — in-process LRU+TTL, mirrors network cache**.
- FF: on by default? **Dev ON via existing seed.ts auto-flip; prod OFF
  per D036, coordinator flips via /data when ready.**

## Context

- `server/services/link-metadata.ts` — fetcher + SSRF guard
- `components/LinkPreviewCard.tsx` — render component
- `server/services/network.ts` — existing in-process LRU+TTL pattern
  to mirror (lines 40–86)
- D036 — feature-flag discipline
- D070 — flag rows seed via migration, not seed.ts
- ADR-0017 — NetworkCardState (read-side surface this enriches)
