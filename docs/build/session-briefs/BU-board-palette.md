---
slug: bu-board-palette
status: shipped
shipped_in: "#313"
phase: 2
priority: medium
note: "Visual polish — ~40 LoC, token + component layers only, no schema, no ADR."
---

# SESSION BRIEF · bu-board-palette — pastel column backgrounds for the Active board

_Author: Paul + Claude · Created: 2026-05-08_
_Type: visual-polish extension. Reuses the existing `MoveCardSheet` palette
on the actual board columns to replace the flat "magnolia" tile wall._

---

## 1 · Business Analyst — why this matters

### The problem in plain language

Bette opens her Writers board on a Friday afternoon. Four columns —
Recruitment, Preparation, Implementation, Monitoring — render side-by-
side as a wall of cream tiles. Every column shares the same flat
`var(--colour-surface-sunken)` (`#ede9df`). Cards are visually
indistinguishable until she reads the column header. She wants to scan
"what's in Implementation right now?" and finds her eye dragging across
the whole board to land on the third heading.

A tester last week put it bluntly: _"shades of magnolia"_. The active
board does the heavy mental-routing work in coordination — and right
now it offers no visual help.

### What we already have, half-built

The **"Move to active" modal** (`MoveCardSheet`) already solves this.
When Bette taps a card's tag-pill to move it, the destination sheet
shows each active column tinted with a distinct pastel — orange,
lavender, blue, mint — using `color-mix(... 14%, transparent)` against
the existing `--colour-warning / -info / -primary / -success` tokens.
The colours are already designed, accessible, and shipped. They just
don't extend to the columns themselves.

This BU extends that exact pattern from the modal to the board. No new
palette work. No new tokens beyond surfacing the modal's palette as
named CSS variables. The fix the eye expects, finally landing where the
eye actually scans.

### Before / after

| Surface | Today | After this BU |
| --- | --- | --- |
| Active board, column 1 | flat `#ede9df` | pastel orange (warning at 14%) |
| Active board, column 2 | flat `#ede9df` | pastel lavender (info at 14%) |
| Active board, column 3 | flat `#ede9df` | pastel blue (primary at 14%) |
| Active board, column 4 | flat `#ede9df` | pastel mint (success at 14%) |
| Active board, column 5+ (rare) | flat `#ede9df` | neutral pastel fallback |
| "Move to active" modal | already pastel | unchanged (already correct) |
| Backlog list | neutral | unchanged (intentionally neutral) |
| Done / Abandoned lanes | neutral | unchanged |
| Cultural-marker post (bordeaux `#6B3045`) | stands out | still stands out — pastels live in non-conflicting hue families |

### User stories

| As a … | I want to … | So that … |
| --- | --- | --- |
| Coordinator | Spot "Implementation" cards in under a second of eye-scan | I can mentally route my Friday afternoon without re-reading headers |
| Coordinator | See the same colour for column 3 in the modal and on the board | "Move to Implementation" feels like the same place I'm looking at |
| Member | Read every card on every column without contrast strain | the visual lift doesn't cost me legibility |
| Author of a cultural-marker post | Have my bordeaux post still feel quiet and dignified | the pastels don't drown out the cultural-marker treatment |

### Success criteria

- Visual differentiation under a 1-second eye-scan on a 4-column active board (light + dark themes).
- WCAG AA passes for 14px body text on every column background (target 4.5:1+).
- Bordeaux `#6B3045` cultural-marker post remains visually distinct on every column — pastels are warm/cool variants in different hue families, no conflict.
- Modal column tints and board column tints match by position (the modal at index 0 = the leftmost board column).
- Backlog list, Done lane, Abandoned lane, and the inside-card tint (currently `--colour-surface-raised` + 8% warning) are explicitly unchanged.

### What this is NOT

- Not a wholesale theme overhaul. Tokens added, none removed or renumbered.
- Not a rebrand. Brand colours are unchanged; we're just deriving pastel surfaces from them via `color-mix`.
- Not a backlog redesign. The backlog list stays neutral — different visual purpose (one continuous list, no horizontal differentiation needed).
- Not a card-interior change. Tickets stay on `--colour-surface-raised`, including the urgent +8% warning tint.
- Not a >4-column redesign. A 5th-and-beyond column lands on a neutral pastel fallback; the build session can pick the exact 5th colour.
- Not an ADR-worthy change. Token-layer evolution within the existing design system; D0xx not required.

---

## 2 · Tech Lead — how to build it

### Surfaces touched

| Layer | File | Change |
| --- | --- | --- |
| Tokens | `styles/tokens.css` | Add 8 new tokens (4 bg + 4 tint) for light theme; matching tints for dark theme using the dark-mode brand hexes already defined in `[data-theme='dark']`. |
| Component | `components/board/Column.tsx:48–50` | Replace static `var(--colour-surface-sunken)` with a position-keyed lookup against the new `--colour-stage-*-bg` tokens. Hover/drop highlight (`isOver`) keeps the existing primary-tint outline; the underlay just shifts from sunken to the column's pastel. |
| Component (optional) | `components/board/BoardList.tsx` | Apply the matching tint to the section-header underline / dot, so the list view gains the same colour cue as the grid. Single-column visual reinforcement; safe to defer if scope tightens. |
| Component (optional) | `components/board/lane-icons.ts` or a new `board-palette.ts` co-located helper | Co-locate a small `paletteForBoardColumnIndex(index)` helper that returns the matching `--colour-stage-*-bg` / `-tint` pair, mirroring `paletteForActiveIndex` in `MoveCardSheet.tsx`. Lets future surfaces (e.g. column-header dots) reuse the mapping without re-deriving it. |

### Schema impact

None. No Prisma touch, no migration, no seed change.

### Layer boundaries

- `/styles` (tokens) — leaf layer, no upstream consumers care.
- `/components/board/*` — component layer; imports from `/components`, `/shared`, `/styles`. No router or service touched.
- ESLint boundary plugin sees no violations.

### Tokens to add

Light theme (under `:root` next to existing `--colour-surface-*`):

```css
--colour-stage-recruitment-bg: color-mix(in srgb, var(--colour-warning) 14%, transparent);
--colour-stage-preparation-bg: color-mix(in srgb, var(--colour-info) 14%, transparent);
--colour-stage-implementation-bg: color-mix(in srgb, var(--colour-primary) 14%, transparent);
--colour-stage-monitoring-bg: color-mix(in srgb, var(--colour-success) 14%, transparent);
--colour-stage-recruitment-tint: var(--colour-warning);
--colour-stage-preparation-tint: var(--colour-info);
--colour-stage-implementation-tint: var(--colour-primary);
--colour-stage-monitoring-tint: var(--colour-success);
```

Dark theme (under `[data-theme='dark']` and the `prefers-color-scheme: dark` media block — there are two dark blocks in `tokens.css`; both must update):

```css
--colour-stage-recruitment-bg: color-mix(in srgb, var(--colour-warning) 22%, transparent);
--colour-stage-preparation-bg: color-mix(in srgb, var(--colour-info) 22%, transparent);
--colour-stage-implementation-bg: color-mix(in srgb, var(--colour-primary) 22%, transparent);
--colour-stage-monitoring-bg: color-mix(in srgb, var(--colour-success) 22%, transparent);
```

Tints in dark theme inherit from the redefined dark-mode brand tokens automatically — no separate dark `--colour-stage-*-tint` declarations needed.

### Naming note — stage-keyed vs position-keyed

⚠️ **The naming above (`recruitment / preparation / implementation / monitoring`) is *aspirational*, not literal.**

In `shared/board-column-defaults.ts` those names are the seeded defaults for `GroupKind = workstream | team` only. Other kinds seed different names (`region` → New / Active / Resolved; `network` → New / Open / Done). And per ADR-0006, group admins rename freely after seed — the runtime column name on Bette's board is whatever she set it to.

So the **runtime mapping is position-keyed**, exactly mirroring `paletteForActiveIndex` in `MoveCardSheet.tsx`. The token names are descriptive labels for the *default workstream board's* visual identity; the lookup function maps `column index 0..3 → token`, with index 4+ falling back to a neutral pastel.

The build session may rename the tokens to `--colour-stage-1-bg` … `--colour-stage-4-bg` if "1/2/3/4" feels less misleading than the workstream-flavoured names. Locked direction: **position-keyed lookup + descriptive-or-numbered token names** — pick in the build session, not now.

### Fallback for >4 columns

If a group admin adds a 5th column (rare but supported), it renders on a neutral pastel — derived from `--colour-text-tertiary` or a new `--colour-stage-default-bg` at 14%. The exact 5th colour is a build-session decision; this brief locks the *strategy* (position-keyed with a neutral default fallback), not the precise hex.

### Tests required

- **Unit / component:** snapshot or assertion test that `<Column>` applies the correct `--colour-stage-N-bg` for index 0..3 and the fallback for index 4. Cheap; no DOM render needed beyond the existing test setup.
- **Visual regression:** if the codebase already has visual-regression infra (Playwright + percy/chromatic, or Storybook + screenshot diff), capture a 4-column board on light and dark themes. **If not present**, manual sign-off is acceptable — and this BU should add a follow-up note to `engineering-roadmap.md` recommending visual-regression as a future investment.
- **Accessibility:** axe-core check on a 4-column board confirms WCAG AA contrast for body text on every pastel. Run on light + dark themes.

### Risks and gotchas

1. **Modal-to-board ordering parity.** `paletteForActiveIndex` in `MoveCardSheet.tsx` is keyed by the index in the destinations array passed by the caller. The build session must confirm: caller index 0 = leftmost board column, 1 = next, etc. If the modal is ever ordered by column ordinal but rendered in a different order, the colours will desync. Smoke-test by tapping a card on column 3 and verifying the modal's third row is the same blue as the column.
2. **Drop highlight.** `Column.tsx` currently overlays the `isOver` state by mixing `--colour-primary 14%` _into_ `--colour-surface-sunken`. With the new pastel underlay, the overlay should mix _into the pastel_ instead — otherwise dropping onto the primary-blue column produces a no-op-looking transition. Build session: re-derive the `isOver` background as `color-mix(in srgb, var(--colour-primary) 14%, var(--colour-stage-N-bg))`.
3. **Cultural-marker check.** Drop a bordeaux post into each of the four columns in dev and confirm visual weight is preserved. The hue-family separation (warm orange, cool lavender, blue, mint vs deep wine) is what makes this work — but verify it on the actual rendered surface, not just in theory.
4. **Card-interior tint stack.** A ticket card sits *inside* the column. The card uses `--colour-surface-raised` (white-ish) and an additional 8% warning tint when urgent. Confirm in dev that an urgent card on the orange column doesn't muddy into "double-orange" — should still read as a clearly-elevated card on a pastel field.

### Permission matrix

| Action | All users |
| --- | --- |
| See the new pastel columns | ✓ |

Visual change. Every authenticated user who can see the active board sees the new palette. No permission gating.

### Acceptance checklist

- [ ] Eight new tokens added to `styles/tokens.css` (4 bg + 4 tint, light theme); matching dark-theme bg overrides in both dark blocks.
- [ ] `components/board/Column.tsx` renders position-keyed pastel backgrounds for active columns (index 0..3) with a neutral fallback for index 4+.
- [ ] `isOver` drop highlight composes correctly _on top of_ the column's pastel — not on top of `surface-sunken`.
- [ ] Modal column tints (`MoveCardSheet`) and board column tints match by position on a 4-column workstream board.
- [ ] Backlog list (`/board/<slug>/backlog`), Done lane, and Abandoned lane are unchanged — confirmed by spot check.
- [ ] Inside-card tints unchanged — urgent cards still show the 8% warning tint over `surface-raised`.
- [ ] axe-core / manual contrast check passes WCAG AA at 14px body text on each column, light + dark themes.
- [ ] Bordeaux `#6B3045` cultural-marker post remains visually distinct on every column.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] `package.json` PATCH bumped.

### Out of scope (park)

- Theming the section-header underline in `BoardList.tsx` may land here as a polish; if scope tightens, defer to a follow-up `bu-board-list-tint`.
- A `--colour-stage-default-bg` token for >4-column boards: locked strategy, build session picks the exact hex.
- Visual-regression test infra (no project-wide tooling exists yet — investment-level, not a BU-scope decision).
- Dark-mode contrast tuning beyond the proposed 22% mix factor — if it fails AA in dark mode, the build session may bump to 26% or adjust per-channel; flag back if so.
- Backlog colour treatment, cultural-marker tint, urgent-card tint: explicitly unchanged.

### Estimate

~40 LoC, ~half a session. Low complexity; reuses an in-tree pattern; no schema, no router/service touched, no novel UX.

### Scenarios to verify against

- The "Friday afternoon Bette" scenario above (manual click-through on a workstream board with cards in each column).
- The "drop a bordeaux post on each column" check (cultural-marker resilience).
- The "drag a card from column 3 to column 1" check (drop-highlight composition).

### Open questions to surface at session-end

- Should the 5th-and-beyond column use a neutral grey pastel, or recycle the 4-colour cycle?
- Token names: keep workstream-flavoured (`recruitment`, `preparation`, …) or switch to numeric (`stage-1`, `stage-2`, …)?
- Dark-mode mix factor: 22% holds AA in synthetic checks — confirm on a real device under both ambient and night-shift display modes.

---

## Status

Ready.
