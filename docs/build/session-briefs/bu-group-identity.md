---
slug: bu-group-identity
status: ready
phase: 2
priority: medium
note: 'Substrate BU. Adds Group.colourKey + initials + <GroupBadge /> + 5 kind glyphs. Consumed by bu-board-gallery (next), and longer-term by feed bylines, comments, notifications, search. Decided 2026-05-05 in conversation with Paul; locked alongside bu-board-gallery.'
---

# SESSION BRIEF · bu-group-identity — coloured group badges across the app

_Brief version: 1.0 (ready) · Author: Paul (via Claude) · Date: 2026-05-05_

## Why this exists / why now

Groups today have `displayName`, `slug`, `kind`, optional `logoUrl` —
no visual identity. Every surface that mentions a group (feed bylines,
comments, search results, the upcoming coordination-board gallery,
notifications) renders text only. As the app grows past a handful of
working groups, members can't scan-and-recognise — every surface needs
to be re-read. The board-gallery work (`bu-board-gallery`) makes the
gap acute: a wall of grey tiles with the group name spelled out is
exactly the lossy picker we're trying to escape.

This BU lays the substrate — a coloured chip with initials (and a
small kind-glyph at larger sizes) — so every downstream surface can
consume `<GroupBadge group={...} size="sm" />` and inherit consistent
identity for free. Without doing this *first*, board-gallery would
either ship without group identity (regressing the design intent) or
ship a one-off implementation that drifts from feed/comments later.

## Objective

Ship `<GroupBadge />` plus the schema + tokens it needs, mounted in
the two highest-leverage existing surfaces (the feed byline if a post
is group-affiliated, and the current `/board` picker). Every other
surface migrates incrementally — that's not in this BU's scope.

Success looks like: open `/board`, see each group's tile carrying a
recognisable coloured chip with initials + kind glyph; open `/feed`,
see the same chip in any group-affiliated post's byline.

## Decisions locked (from conversation 2026-05-05)

1. **Schema:** add `Group.colourKey` (Postgres enum, palette below).
   `initials` is **derived** at render time from `displayName` (no
   schema column — first 1-2 chars, accent-stripped, uppercased).
2. **Palette:** ~12 curated accent colours added to
   `styles/tokens.css` as `--colour-group-<name>` (and matching
   `--colour-group-<name>-text` for WCAG-AA contrast). Names TBD in
   build but indicative: `slate · rust · moss · plum · ochre · teal ·
   indigo · coral · sage · amber · rose · stone`. Each must pass AA
   against `--colour-text` overlaid AND be distinguishable from its
   neighbours for protanopia/deuteranopia.
3. **Assignment policy:** auto-assign at group create from a
   round-robin rotation (least-recently-used colour wins). Admins
   can re-pick from the curated palette via the existing admin
   surface (`app/admin/groups/[id]/page.tsx` — confirm scope when
   building). **Never** freeform hex.
4. **Glyph register:** add 5 kind glyphs to
   `docs/product/design-philosophy.md` register in the same commit
   they ship (per global rule). Suggested lucide mappings:
   `Workstream → workflow`, `Region → map-pin`, `Network → network`,
   `Team → users`, `Topic → hash`. Confirm with the register before
   locking.
5. **`<GroupBadge />` sizes:**
   - `xs` — initials only, 16px chip; for inline byline / dense lists
   - `sm` — initials + corner kind glyph, 24px chip; default
   - `md` — initials + corner kind glyph, 40px chip; gallery tiles
   - `lg` — initials + corner kind glyph, 64px chip; board headers
6. **Accessibility:** `<GroupBadge />` always renders an
   `aria-label` of `<displayName> (<kind label>)` when used
   icon-only; when paired with a visible name, the chip is
   `aria-hidden`. Colour is reinforcement, never the sole signifier.
7. **`logoUrl` interaction:** if a group has `logoUrl` set, the chip
   renders the logo at sizes ≥ md, falling back to initials
   otherwise. Colour ring still applies as a frame. (xs/sm always
   use initials — logos don't read at small sizes.)

## Scope

### Build in this session

- **ADR** at `docs/adrs/0007-group-colour-identity.md` (or next
  free number) — palette, assignment policy, contrast methodology,
  the "no freeform hex" rule. Status: Accepted.
- **Prisma migration:** `Group.colourKey` enum + nullable→default
  backfill (assign existing groups round-robin in the migration).
- **Tokens:** `styles/tokens.css` adds the 12 group accents (bg +
  text). Document the contrast method inline.
- **Glyph register:** add the 5 kind glyphs to
  `docs/product/design-philosophy.md`.
- **Component:** `components/group/GroupBadge.tsx` — pure
  presentational, four sizes, takes `{ group: { displayName, kind,
  colourKey, logoUrl? } }`.
- **Test:** `components/group/GroupBadge.test.tsx` — renders
  initials, applies colour token, kind glyph at ≥ sm, logo fallback,
  aria-label correctness.
- **Mount points:**
  - `app/board/page.tsx` (current picker) — replace text
    `KIND_LABEL` chip with `<GroupBadge size="sm" />`
  - Feed byline component (locate in build) — render `<GroupBadge
    size="xs" />` if the post is group-affiliated
- **Service helper:** `server/services/group.ts` — add
  `assignNextColourKey()` used by group create (round-robin). Unit
  tested.
- **Seed:** existing seed groups get colours via the migration
  backfill (deterministic order). No code change to `scripts/seed.ts`.

### Out of scope

- Migrating *every* group reference across the app. Only the two
  mount points above. Other surfaces (comments, notifications,
  search, AppNav crumbs) consume `<GroupBadge />` in their own BUs.
- Admin re-pick UI. Add the schema + service capability; the
  re-pick form lands when the admin surface is next touched.
- Per-group themes (groups colouring more than just the chip). Out.

## Definition of done

- ADR-0007 (or next) merged, Accepted status
- `Group.colourKey` migration deployed locally, every existing group
  has a colour assigned
- 12 accent token pairs in `tokens.css`, visible in DevTools
- 5 kind glyphs added to glyph register
- `<GroupBadge />` renders correctly at all 4 sizes; tests green
- `/board` picker shows the badge per row
- Feed byline shows the badge for group-affiliated posts
- `npm run typecheck && npm run lint && npm test` all green
- Brief flipped to `status: shipped` per D068 on PR merge
- Version bumped (PATCH minimum)

## Depends on

- Nothing prior. Substrate BU.

## Consumed by

- **bu-board-gallery** — the immediate consumer; this BU must ship
  first (it consumes `<GroupBadge size="md" />` for the gallery tiles).
- Future: comments, feed bylines (xs everywhere), notifications,
  search-surface results grouping, admin surfaces.

## Open questions to surface

- Confirm 5 lucide kind-glyph picks against current register before
  locking (some may already be claimed for another concept — one
  concept = one glyph rule applies).
- Confirm the `logoUrl` fallback policy with Paul — the brief
  assumes logo wins at ≥ md; a counter-argument is "logos are
  busy, initials are clearer at a glance" (always-initials variant).
