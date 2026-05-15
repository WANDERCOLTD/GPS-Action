---
slug: bu-network-spread-gallery
status: shipped
shipped_in: "#369"
phase: 2
priority: medium
depends_on: bu-link-preview-store
note: "Brief v0.2 (2026-05-15, groomed for build). Photos-app-style gallery on /network/spread — deduped URL tiles, source chip overlay, spread-trace timeline on tap. Six product decisions locked. Depends on bu-link-preview-store landing first (foundation BU) so tile thumbnails and dedup are cheap DB reads, not on-demand fetches. Companion mock: /tmp/spread-mock.html in session 2026-05-14."
---

# SESSION BRIEF · bu-network-spread-gallery — visual "what's spreading" gallery on /network

_Stub · Created: 2026-05-14. Depends on bu-link-preview-store. Triggered
by user observation that the same media circulates in many groups; a
gallery view answers "what's everyone sharing" faster than the text feed._

---

## Why

`/network` shows messages one per row in chronological order. That
buries the key activist-relevant signal: **what's actually spreading
right now.** A clip shared into 5 groups in two hours matters more
than 5 unrelated posts from one chat.

A Photos-app-style gallery answers a different question than the list
view, with the same underlying data:

- Tiles are deduped by URL (one tile per "thing being shared").
- Tile thumbnail = OG image from `bu-link-preview-store`.
- Tile overlay = source chip of *first-seen* group + `×N` badge when
  shared into 2+ groups.
- Tap → detail sheet with **spread trace** timeline (who carried it
  across groups, in what order, how fast).

This is genuinely useful intel for activists: at-a-glance "what's
circulating," and per-item "how did this travel."

## Surface

- New route: `/network/spread` (sub-route, not a tab — IA stays light)
- Entry: "View as gallery" affordance next to the sort control on
  `/network`.
- Reuses existing `NetworkSourceChipStrip` above the grid (same
  `?source=` URL state, same chips).
- New `<FilterChipStrip type>` for Social · Video · News · Action ·
  Other (`?type=` URL state). Extract a generic component if
  `NetworkSourceChipStrip` can be parameterised cleanly.

## Layout

- CSS grid: 3 col mobile / 4 tablet / 6 desktop, 2–4px gaps (Photos-
  tight), square crops via `object-fit: cover`.
- Tile overlays:
  - Bottom-left: **micro source chip** — coloured dot + emoji, no
    label. Tooltip on hover.
  - Top-right: `×N` pill on subtle dark gradient — only when N ≥ 2.
- Sticky section headers driven by active sort:
  - **Most spread** (default) → `5+ groups · 2–4 · once`
  - **Trending** (24h velocity) → `Picking up · Steady · Cooling`
  - **Most recent share** → `Today · Yesterday · This week · Earlier`

## Sort options (3 only)

| Sort | Formula | Answers |
|------|---------|---------|
| Most spread (default) | `count(occurrences)` desc | "What's everyone been sharing?" |
| Trending | `count_24h / hours_since_first_seen` desc | "What's going viral right now?" |
| Most recent share | `max(sentAt)` desc | "What's still circulating?" |

Dropped from initial proposal: "First seen" (overlaps with recent),
"Most forwarded" (correlates with most-spread; save as a filter
toggle if requested in v2).

## Filter chips (2 axes)

| Axis | Mechanism | Source |
|------|-----------|--------|
| Source | Multi-select chips (existing) | `gps_chat_labels` |
| Type | Multi-select chips (new) | `LinkPreview.linkType` (Social/Video/News/Action/Other) |

Probe data (last 500 URLs): Social 74% · Video 13% · News ~7% ·
Action ~3% · Other ~3%. The five buckets are empirically grounded.
Domain mapping list lives in `server/lib/url-type.ts` (built in
`bu-link-preview-store`).

## Detail sheet (tap on tile)

Full-screen overlay, swipe-down-to-close:

```
[ swipe down to close ]

╔══════════════════════════════╗
║       OG image hero          ║
╚══════════════════════════════╝

  og:title
  domain.example.com  →  Open link

  ─── Spread trace ──────────────
  🎯 GPS Action Network!  09:14
      Sharon · original
   ↓  17m
  🟣 Hendon WhatsApp       09:31
      Anna · forwarded
   ↓  31m
  🟢 North London Action  10:02
      David · forwarded
  ───────────────────────────────

  [ Open link ]  [ Share ]
```

Reuses `NetworkSourceChip` component inline in the timeline.

## Implementation sketch

- 1 new tRPC procedure: `network.spread.list` — groupBy
  `LinkPreview.normalizedUrl` (or `gps_group_messages.url` joined
  via store), return `{ url, firstSeenAt, lastSeenAt, occurrences:
  [{ chat, sender, sentAt, isForwarded }] }[]`. Sorting + filtering
  applied SQL-side where possible.
- 1 new route: `app/network/spread/page.tsx`.
- 1 new component: `<SpreadTile>` — image + 2 overlay pills, ~30 lines.
- 1 new component: `<SpreadDetailSheet>` — hero + timeline.
- 1 new component (or generic refactor): `<FilterChipStrip type>`.
- No schema changes — all reads against `gps_group_messages` (Grant's
  view) + `LinkPreview` (from bu-link-preview-store).

## Decisions locked (2026-05-15)

1. **Dedup window: 30 days rolling.** Configurable via
   `NETWORK_SPREAD_WINDOW_DAYS` env (default 30). Spread trace only
   counts occurrences inside the window.
2. **No-og tiles: hybrid.** Default = **render** with domain-
   coloured background + og:title text (the mock's "no-og" tile
   pattern). This honours the "what's spreading" semantic — a
   change.org petition shared 5× is *more* gallery-worthy than a
   tweet with a pretty image shared once. (Decision changed from
   stub recommendation after reviewing the mock: filtering would
   silently hide high-spread Action items.)
3. **`×N=1` badge: hidden.** Absence of badge = "only seen once."
   Less visual noise; high-spread items stand out.
4. **Tile aspect ratio: square crops.** `object-fit: cover` on a
   `aspect-ratio: 1/1` tile. Accepts ~30% crop loss on wide OG
   images for grid tidiness.
5. **Density toggle: not in MVP.** Single density: 3 cols mobile,
   4 tablet, 6 desktop. Revisit only if requested post-ship.
6. **Trending window: 24h.** Formula `count_within_24h /
   hours_since_first_seen`. Configurable via
   `NETWORK_SPREAD_TRENDING_WINDOW_HOURS` env (default 24).
7. **Entry point** (added on groom): single sub-route `/network/
   spread` — entered from a "View as gallery" affordance next to
   the sort control on `/network`. No deep-link from feed cards in
   MVP.
8. **Type-bucket source of truth** (added on groom):
   `LinkPreview.linkType` from `bu-link-preview-store`. The gallery
   query joins on `normalizedUrl` and reads the cached classification;
   we do not re-classify per render.

## Surface this BU depends on

- **`bu-link-preview-store` MUST ship first.** Without it, dedup-
  groupBy + tile thumbnails require per-request upstream fetches —
  unacceptably slow at gallery scale.
- `bu-network-source-chips` (#343 — chip strip + first-seen group label).
- `server/services/network.ts` (existing list-fetch service).
- `lib/url-type.ts` from bu-link-preview-store.

## Not in scope

- Video playback inline (tiles are still-image thumbnails only).
- Cross-tile-multiselect bulk actions (v2 if used).
- Saved-gallery / favourites (per-tile state via `NetworkCardState`).
- "Forwards only" / "Originals only" filter — v2 toggle.
- Multi-URL messages (Grant ships `urls text[]` upstream; consuming
  it is a separate BU).
- "Events" type bucket (Zoom/Eventbrite/Tickettailor) — v2 if Other
  becomes cluttered.
- Image proxy / S3 storage — hotlink for MVP (covered in
  bu-link-preview-store, not here).


## Build steps (in order)

1. **tRPC procedure** — `server/routers/network.ts`: add
   `network.spread.list({ sources?, types?, sort, windowDays })`.
   Service in `server/services/network-spread.ts`:
   - Pull `gps_group_messages` within window (reuses
     `listGpsGroupMessages`)
   - Join with `LinkPreview` on `url` (left join — rows with no
     cached preview fall through to "no-og" tile path)
   - `groupBy(normalizedUrl)` in-memory; aggregate
     `{ firstSeenAt, lastSeenAt, occurrences[] }`
   - Apply source and type filters
   - Sort:
     - `mostSpread` → `occurrences.length DESC`
     - `trending` → `count_in_24h / hours_since_first_seen DESC`
     - `mostRecent` → `lastSeenAt DESC`
   - Limit 200 tiles (cap UI scroll)
2. **Shared types** — `shared/network-spread.ts`:
   `SpreadTile`, `SpreadOccurrence`, `SpreadSort`, plus zod
   input schema for the tRPC procedure.
3. **Components** — under `components/network-spread/`:
   - `SpreadGrid.tsx` — CSS grid container + section headers
     (driven by active sort)
   - `SpreadTile.tsx` — image | no-og fallback, source chip
     overlay, `×N` badge (only N≥2)
   - `SpreadDetailSheet.tsx` — full-screen drawer with hero +
     spread-trace timeline
   - `SpreadFilterControls.tsx` — source chip strip (reuses
     existing `NetworkSourceChipStrip` data) + new type chip strip
     + sort dropdown
4. **Route** — `app/network/spread/page.tsx`:
   - Server component reads URL state (`?sources=`, `?types=`,
     `?sort=`) and calls `trpc.network.spread.list`
   - Client component handles tile-tap → detail sheet open
5. **Entry-point on `/network`** — add a "View as gallery" link
   button next to the sort control. URL: `/network/spread` (carries
   over `?sources=` if present).
6. **Tests**:
   - `network-spread.test.ts` — service tests for dedup, sort,
     filter logic with fixture data
   - `SpreadTile.test.tsx` — renders image tile, no-og fallback,
     `×N` badge only when ≥2
7. **Run** `pnpm typecheck && pnpm lint && pnpm test`.

## Acceptance criteria

- [x] `/network/spread` renders deduped URL tiles within a 30-day
      window, default sort = most spread.
- [x] Source-chip strip filters by originating chat (reuses
      existing data + URL state pattern).
- [x] Type-chip strip filters by `LinkPreview.linkType` (Social /
      Video / News / Action / Other).
- [x] Three sort modes work; section headers swap with sort.
- [x] Tap on tile opens detail sheet with full spread-trace timeline.
- [x] No-og tiles render with domain-coloured fallback (not filtered).
- [x] `×N` badge only when N ≥ 2.
- [x] "View as gallery" entry-point sits next to sort control on
      `/network`.
- [x] No regression on `/network` list view.
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass.
