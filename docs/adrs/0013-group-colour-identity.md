# ADR-0013 · Group colour identity — palette, assignment, and badge substrate

**Status:** Accepted
**Date:** 2026-05-06
**Deciders:** Paul (product), Claude Code Session B (build)

## Context

Groups today carry `displayName`, `slug`, `kind`, optional `logoUrl` —
no visual identity. Every surface that mentions a group renders text
only. As the network grows past a handful of working groups, members
can't scan-and-recognise — every byline, comment header, search hit,
and board picker has to be re-read from scratch.

The upcoming `bu-board-gallery` work makes this gap acute: a wall of
grey tiles with the group name spelled out is exactly the lossy
picker we're trying to escape. We need a single substrate — a
`<GroupBadge />` chip — that every surface can consume so identity
stays consistent without each surface re-implementing it.

## Options considered

- **Option A — schema-level `colourKey` enum + curated palette + auto-
  assign at create.** Twelve curated accents, round-robin LRU at group
  creation, admin can re-pick from the same palette. Schema-locked,
  no freeform hex. **Picked.**
- **Option B — derive colour deterministically from slug.** Hash the
  slug, mod 12, pick from the palette. No schema column. Cheaper.
  Rejected: same slug always gets the same colour even after
  collisions, admin can't override without renaming, and the
  distribution clusters poorly for small N.
- **Option C — freeform hex per group.** Most flexible, worst for
  consistency / contrast / colour-blind accessibility. Rejected: the
  whole point of the substrate is recognisability, which depends on
  the palette being bounded and curated.

## Decision

Add a `Group.colourKey` enum column (12 named accents). Auto-assign
at group creation via a least-recently-used round-robin. Admins can
re-pick from the same palette via the admin surface — never freeform
hex. `<GroupBadge />` consumes `{ displayName, kind, colourKey,
logoUrl? }` and renders four sizes.

### Palette

Twelve curated accents, named:

`slate · rust · moss · plum · ochre · teal · indigo · coral · sage ·
amber · rose · stone`

Each name maps to a `--colour-group-<name>` (background) and
`--colour-group-<name>-text` pair in `styles/tokens.css`, defined for
both light and dark themes.

### Contrast methodology

- Background tints sit at ~80–90% lightness (light theme) or ~20–30%
  lightness (dark theme).
- Text sits at ~25–30% lightness (light theme) or ~80–90% lightness
  (dark theme), in the same hue family.
- Each pair was hand-checked to clear **WCAG AA 4.5:1** for normal
  body text.
- Hues are spaced ≥ 25° around the wheel where the gamut allows; near
  neighbours (e.g. `rust` and `coral`, `ochre` and `amber`) are kept
  distinguishable by saturation/lightness offset.
- **Colour-blindness honesty:** with twelve hues, full distinguishability
  for protanopia / deuteranopia is not achievable. Colour is
  **reinforcement**, never the sole signifier. The kind glyph
  (corner overlay at sizes ≥ sm) plus the visible group name carry
  the identity; the chip's colour is the recognition shortcut.

### Assignment policy

- **Auto-assign at create:** the new group's colour is the
  least-recently-used name in the palette — i.e. the one that has
  not been used by any non-soft-deleted group, breaking ties by
  lexical order. Implementation: `assignNextColourKey()` in
  `server/services/group.ts`.
- **Admin re-pick:** schema + service helper land in this BU. The
  admin form re-pick lands when the admin group surface is next
  touched (out of scope here per the brief).
- **Never freeform hex.** Picker is a 12-swatch grid.
- **Backfill of existing groups:** the migration assigns colours
  round-robin in `createdAt` order. Deterministic and re-runnable
  in dev.

### Glyph register additions

Five `lucide` glyphs for the `GroupKind` enum, registered alongside
this BU per the global "one concept, one glyph + same-commit
register update" rule:

| Kind         | Glyph       |
| ------------ | ----------- |
| `workstream` | `workflow`  |
| `region`     | `map-pin`   |
| `network`    | `network`   |
| `team`       | `briefcase` |
| `topic`      | `hash`      |

`map-pin` was previously claimed for **Location** (PostCard meta
row). Per Paul (2026-05-06), the concept is broadened to
"geographic place / region" — `map-pin` covers both post location
text and group `region` kind. The register is updated to reflect
the broadened concept.

### `<GroupBadge />` sizes

| Size | Diameter | Content                                    | Use                         |
| ---- | -------- | ------------------------------------------ | --------------------------- |
| `xs` | 16px     | initials only                              | inline byline / dense lists |
| `sm` | 24px     | initials + corner kind glyph               | default                     |
| `md` | 40px     | initials + corner kind glyph (logo if set) | gallery tiles               |
| `lg` | 64px     | initials + corner kind glyph (logo if set) | board headers               |

### `logoUrl` interaction

If a group has `logoUrl` set, the chip renders the logo at sizes
≥ md, falling back to initials otherwise. The colour ring still
applies as a frame so identity stays consistent. `xs` and `sm`
always use initials — logos don't read at small sizes.

### Accessibility

`<GroupBadge />` always renders an `aria-label` of
`<displayName> (<kind label>)` when used icon-only. When paired
with a visible group name in the same row, the chip is
`aria-hidden="true"` to avoid double-announcement. Colour is
reinforcement, never the sole signifier (see contrast methodology).

## Reasoning

The palette is the defensible boundary: schema-locked, curated,
admin-overridable but not freeform. Hash-the-slug (Option B) was
tempting for its zero-storage cost but gives up the override path
the moment two important groups collide. Freeform hex (Option C)
abandons the whole point of the substrate — that downstream
surfaces inherit consistent identity for free.

Auto-assigning LRU at create keeps the distribution flat for
small N (the regime we're actually in) without any manual curation
on the admin's part. They only intervene when they want to.

The `map-pin` concept-broadening (Paul, 2026-05-06) is a Rule 2
exception by re-definition rather than violation: the underlying
concept _is_ "geographic place" — the post-location text and the
group `region` kind are both instances of it.

## Consequences

- **Easier:**
  - Every downstream surface (feed bylines, comments, notifications,
    search results, admin lists, board gallery) consumes one
    component and inherits identity for free.
  - Adding a new group kind in future = one register row + one new
    glyph + one switch case in the badge component. No palette work.
  - Admin re-pick lands in any future admin-form session by adding
    a 12-swatch picker bound to the existing `colourKey` field.

- **Harder:**
  - Twelve named accents now appear in `tokens.css` for both themes
    — token surface area grows. Mitigated by keeping the names
    semantic-neutral (palette positions, not roles).
  - Adding a 13th colour means a Prisma enum migration. We expect
    this very rarely (the curated set is the point).

- **Out of scope (deferred):**
  - **Feed-byline mount.** The brief listed `/feed` byline as a
    second mount point "if a post is group-affiliated". `Post` has
    no `groupId` relation in the schema today, so there is no
    group-affiliated post to render against. Deferred to a future
    BU that adds Post→Group affiliation. This BU mounts only on
    `/board` picker.
  - Admin re-pick UI.
  - Per-group themes (groups colouring more than just the chip).

## Notes

- Brief: `docs/build/session-briefs/bu-group-identity.md`
- Kickoff handoff: `docs/build/session-handoffs/board-gallery-kickoff-2026-05-05.md`
- Consumed first by `bu-board-gallery` (`<GroupBadge size="md" />`
  for gallery tiles).
- Future surfaces (each in its own BU): comments, feed bylines,
  notifications, search-surface result grouping, admin surfaces.
