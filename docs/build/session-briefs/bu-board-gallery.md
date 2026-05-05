---
slug: bu-board-gallery
status: ready
phase: 2
priority: medium
note: 'Replaces the bu-coordination-board PR-4c picker with a snapshot gallery. Consumes <GroupBadge /> from bu-group-identity (which must ship first). Decided 2026-05-05 in conversation with Paul.'
---

# SESSION BRIEF · bu-board-gallery — `/board` snapshot gallery + filters

_Brief version: 1.0 (ready) · Author: Paul (via Claude) · Date: 2026-05-05_

## Why this exists / why now

The `/board` landing shipped in `bu-coordination-board` PR-4c
(`v0.2.93`, #224) is a vertical list of text-only cards: name + kind
chip + admin badge + description. It functions, but Paul (looking at
http://localhost:3001/board on 2026-05-05) flagged that as the
network grows past a handful of groups it becomes a wall of grey rows
— there's no signal about *which* board needs attention, no visual
identity per group, no filtering for "my teams" vs the rest. The ask
is a gallery of board *snapshots* in the spirit of the share-this
picker but full-page, with sort/filter that scales to users with 0,
1, or many group memberships.

This BU replaces the picker. It is **not** additive — the existing
`BoardGroupPicker` component is removed (or repurposed for a denser
in-modal switcher in a later BU; not this one).

## Objective

Ship a `/board` page that:

1. Shows each accessible board as a tile carrying the group's
   identity badge (from `bu-group-identity`) and a *snapshot* —
   column titles + card counts.
2. Defaults to filter `Mine` and sort `Recent activity`.
3. Handles the 0/1/many-teams cases gracefully.
4. Caches snapshots lazily to keep the page fast.

Success: open `/board` with multiple group memberships → see
recognisable, colour-coded tiles → glance and know which boards have
recent activity / unbalanced columns → tap a tile → land on the
specific board.

## Decisions locked (from conversation 2026-05-05)

1. **Snapshot freshness:** lazy cache, write-bumped staleness.
   - New table `BoardSnapshot` keyed by `boardId`, columns:
     `payload Json` (column titles + counts), `cachedAt`,
     `lastWriteAt`.
   - Every kanban write (card add/move/edit/delete; column rename;
     column add/remove) bumps `lastWriteAt` on the row.
   - On `/board` load, per board: serve cached if
     `cachedAt > lastWriteAt` AND `cachedAt > now − 15min`; else
     regenerate inline, write back, serve.
   - The 15min "quiet-time" threshold is a SystemSetting
     (`board_snapshot_quiet_minutes`, default 15), so it can be
     tuned without a deploy.
2. **Tile layout — Option A** (whole-tile link + read-only column
   strip; no card-title previews in v1).
   - Click target = whole tile → `/board/[slug]`.
   - Snapshot is read-only signal: column titles + card counts.
   - Card titles are **not** exposed (resolves access-leak risk;
     keeps anchor-in-anchor concern moot).
3. **Group identity:** `<GroupBadge size="md" />` from
   `bu-group-identity` is the visual anchor of each tile.
4. **Filter chips:** `Mine` (default) · by kind: `Team`,
   `Workstream`, `Region`, `Network`, `Topic`. No "all accessible"
   chip until a "browse network-public boards" path exists (out of
   scope here).
5. **Sort:** `Recent activity` (default — by `BoardSnapshot.lastWriteAt`)
   · `A→Z` (by displayName). `My involvement` deferred to a later BU.
6. **User-state handling:**
   - **0 boards:** retain existing empty-state copy + an explicit
     hint about how groups invite members (don't auto-redirect).
   - **1 board:** show the gallery (single tile). No auto-redirect
     — consistency wins; tomorrow's 2-board user uses the same
     mental model.
   - **N boards:** filter chips earn their keep; default chip
     `Mine`.
7. **Layout (responsive):** 2-up on viewports ≥ 720px,
   1-up below. No masonry — uniform tile height for scannability.

## Scope

### Build in this session

- **Schema:** `BoardSnapshot` table (Prisma migration). One row per
  group with a board (i.e. per Group with `boardColumns.length > 0`).
  Backfill: empty payloads, `cachedAt = NULL`, `lastWriteAt = now()`
  → first read regenerates.
- **SystemSetting:** seed `board_snapshot_quiet_minutes` (default
  `15`).
- **Service:** `server/services/boardSnapshot.ts` —
  - `getOrRegenerateSnapshot(boardId)` — the lazy-cache logic
  - `bumpLastWrite(boardId)` — called from every kanban mutation
  - `regenerate(boardId)` — internal, queries columns + counts
- **Wire `bumpLastWrite`** into every existing kanban mutation
  (`server/services/groupKanban.ts` and similar — locate at build
  time). This is the boring-but-essential plumbing pass.
- **Router:** extend `groupKanban.listMine` → return
  `{ group, access, snapshot }` per row, where `snapshot` comes
  from `getOrRegenerateSnapshot`. Keep the response shape additive
  (downstream code that ignores `snapshot` keeps working).
- **Page:** `app/board/page.tsx` — replace `BoardGroupPicker` with
  `<BoardGallery groups={...} />`.
- **Components:**
  - `components/board/BoardGallery.tsx` — grid + filter chips +
    sort selector
  - `components/board/BoardGalleryTile.tsx` — single tile (badge,
    name, kind label, last-activity timestamp, column strip)
  - `components/board/ColumnStrip.tsx` — the read-only horizontal
    strip: column title + count per column, capped at 5 visible
    with "+N more" if exceeded
- **Filter/sort state:** URL-addressable via query string
  (`?filter=mine&sort=recent`) so links are shareable.
- **Empty state:** retain current copy from `BoardGroupPicker` for
  the 0-board case (extract to `BoardGalleryEmpty` component).
- **Tests:**
  - service: snapshot cache hit/miss/quiet-time logic
  (fake-timer for the 15min window)
  - service: `bumpLastWrite` invalidates correctly
  - component: gallery filters & sorts
  - integration: `/board` renders correct tile count + badge per
    user role
- **Scenario:** add SCN-N "Eve scans her boards" — three groups,
  one with recent activity, gallery surfaces it first.

### Out of scope

- Card-title previews on tiles (the Option B layout). Defer to a
  follow-on BU once usage shows users want column-level deep-links.
- "All accessible" filter / network-public board browsing.
- "My involvement" sort (cards assigned to me).
- Admin re-pick of group colour from the `/board` page (lives in
  group admin surface).
- A dense in-modal board switcher (e.g. for the kanban view itself
  to switch boards). Separate BU.

## Definition of done

- `BoardSnapshot` migration deployed; every existing
  group-with-board has a row
- `bumpLastWrite` called from every kanban mutation; verified by
  test
- `/board` renders the gallery with `<GroupBadge />` and column
  strips
- Filter chips work; URL persists state
- Sort dropdown works; URL persists state
- 15min quiet-time cache behaviour verified by fake-timer test
- 0-board, 1-board, and many-board states all render correctly
- New scenario added to `docs/product/scenarios.md`
- `npm run typecheck && npm run lint && npm test` all green
- Brief flipped to `status: shipped` per D068 on PR merge
- Version bumped (PATCH minimum)

## Depends on

- **bu-group-identity** must ship first. Tiles consume
  `<GroupBadge size="md" />` and the `Group.colourKey` field. Do
  not start this BU until that one is on `main`.

## Open questions to surface

- Does `BoardSnapshot.payload` need a schema versioning field for
  future shape changes? (Lean: yes — add `payloadVersion: 1`.)
- The "card add/move/edit/delete" set — confirm the exact mutation
  list when wiring `bumpLastWrite`; missing one means stale
  snapshots forever for that mutation type.
- Sort by `Recent activity` when many boards have never been
  touched (their `lastWriteAt` defaults to `now()` at backfill —
  initial UX is "they're all 'recent'"). Acceptable for v1; flag
  if it bites.
