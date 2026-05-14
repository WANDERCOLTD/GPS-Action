---
slug: bu-network-spread-gallery
status: planned
phase: 2
priority: medium
depends_on: bu-link-preview-store
note: "Stub 2026-05-14. Photos-app-style gallery on /network/spread — deduped URL tiles, source chip, spread trace on tap. Depends on bu-link-preview-store landing first so dedup + tile thumbnails are cheap reads, not on-demand fetches."
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

## Open product questions

1. **Dedup window.** Two posts of the same URL three months apart —
   one "thing spreading" or two separate moments? Recommend a 30-day
   rolling window for the gallery (configurable); spread trace inside
   that window only. Lock?
2. **Tiles with no og:image.** ~14% of URLs (probe data). Options:
   (a) filter them out of gallery entirely, keeping the surface visual;
   (b) render with domain-coloured background + URL preview text.
   Recommend (a) — gallery should feel visual; the list view still
   shows them.
3. **`×N=1` badge.** Hide it (absence = "only seen once")? Or show
   `×1` for consistency? Recommend hide.
4. **Tile aspect ratio.** Square crops (Photos-feel, ~30% crop loss
   on wide OG images) vs honest aspect ratio (jagged grid).
   Recommend square — the "what's spreading" question doesn't need
   the whole image.
5. **Density toggle.** Photos has pinch-to-zoom for grid density.
   YAGNI for MVP — single density. Confirm.
6. **Trending window — 24h or 6h?** 6h is more "right now" but
   penalises overnight shares; 24h is forgiving. Recommend 24h MVP.

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

## Acceptance criteria (rough)

- `/network/spread` route renders a grid of deduped URL tiles within
  a configurable rolling window (default 30d).
- Source-chip strip filters tiles by originating group.
- Type-chip strip filters by `LinkPreview.linkType`.
- Three sort modes work; section headers swap with sort.
- Tap on tile opens detail sheet with spread-trace timeline.
- Tiles with no usable og:image are filtered out of the gallery
  (still visible on `/network` list).
- "View as gallery" entry-point sits next to sort control on
  `/network`.
- No regression on existing `/network` list view.

## Next step

Paul to confirm the six open product questions above (dedup window,
no-image policy, ×1 badge, square crops, density toggle, trending
window). Then this becomes buildable once bu-link-preview-store
has shipped.
