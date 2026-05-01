---
slug: bu-icon-strips
status: stub
phase: 2
priority: medium
note: "Stub. Unify the four word-bearing chip/tab strips below the AppNav level — FeedFilterChips, CommentList tabs, NearMeView sort — to icons-only with a shared long-press / hover tooltip primitive. Closes the tooltip TODO from BU-icon-nav. Spawned from a /feed visual-consistency review on 2026-05-01."
---

# SESSION BRIEF · bu-icon-strips — Unify second/third-order chip strips to icons-only

*Brief version: 0.1 (stub) · Author: Paul · Date: 2026-05-01*

---

## Objective

Bring every word-bearing tab/chip strip in the app into the same idiom
that AppNav (BU-icon-nav, #152) and CalendarToggle (BU-calendar-near-me)
already use: **lucide line icons with `aria-label`, plus a shared
tooltip primitive on hover (desktop) and long-press (touch).**

Three surfaces in scope; the visual outlier today is `FeedFilterChips`
(emoji + brand glyph + plain text), which prompted this BU.

---

## Inventory — every word-bearing strip in the app

| Order | Surface | Today | In this BU? |
|---|---|---|---|
| TOP | `AppNav` | Icons-only | No — already shipped (#152) |
| 2nd | `FeedFilterChips` (`/feed`) | Text + emoji + brand glyph | **Yes** |
| 2nd | `CalendarToggle` (`/calendar`) | Icons-only | No — already shipped |
| 2nd | `CommentList` filter tabs (post detail) | Text-only, **underline-tab geometry** | **Yes (open question — convert to chip geometry?)** |
| 3rd | `NearMeView` sort toggle | Text-only chips | **Yes** |

---

## UX decision — single-active vs ON/OFF (multi-select)

**Stay single-active everywhere.** Multi-select chip filters have a
specific failure mode that bites this content: chip-level intersection
(e.g. `Urgent ∩ Events`) is often empty, and an empty feed after two
taps reads as "the app is broken." Multi-select is the right pattern
when chips are *facets over a search result set* (e.g. inside the
search modal); it's the wrong pattern for top-of-feed discovery.

This decision applies to all three strips in scope. URL-driven,
single-active, one chip lit at a time. Locked unless Paul disagrees
in review.

---

## Locked picks

| Strip | Item | Icon | Tooltip |
|---|---|---|---|
| Feed | All | *(no icon — text "All" stays as the deliberate "off" outlier)* | — |
| Feed | Urgent | `Zap` | Urgent |
| Feed | AM | **Brand glyph stays** (deliberate partner-brand exception per share-taxonomy) | Activist Mailer |
| Feed | Now | `Radio` | Happening now |
| Feed | Meetings | `Users` | Meetings |
| Comments | Discussion | `MessageSquare` | Discussion |
| Comments | Activity | `Activity` | Activity |
| Comments | All | *(no icon — same outlier rule as Feed/All)* | — |
| Near-me | Distance | `Ruler` | Sort by distance |
| Near-me | Date | `CalendarDays` | Sort by date |

## Open picks (decide before starting)

- **Feed / Tick-or-cross.** Candidates: `ThumbsUp` (paired with
  `ThumbsDown`?), `Vote`, `ListChecks`, `Gavel`, `Scale`. The chip
  surfaces "boost or remove" verdict threads — feels closer to *vote*
  than *checklist*. **Lean: `Vote`.**
- **Feed / Events.** Candidates: `Megaphone`, `Flag`, `CalendarDays`.
  `CalendarDays` collides with the AppNav Calendar icon → confusion.
  **Lean: `Megaphone`** (activist-coded, distinct from nav).
- **CommentList geometry.** Today: underline tabs, not pills. Two
  options:
  (a) Convert to pill chips so all three strips share one geometry.
  (b) Keep underline tabs as a *deliberate* geometric difference —
  chips = "filter a list," tabs = "switch view of the same list" — and
  only swap text→icon within the existing tab idiom.
  **Lean: (b).** The chip geometry implies "any of these can be on,"
  whereas underline tabs say "you are in this view." Comments tabs
  switch the meaning of the comment list (Discussion vs Activity vs
  All); they're not filters in the same sense as feed filters.
  Decide before build.

---

## Pre-requisites

- **Shared tooltip primitive must ship first.** BU-icon-nav explicitly
  deferred this. Land it once, then adopt across:
  AppNav (retro-fit) + FeedFilterChips + CommentList + NearMeView sort.
- Tooltip behaviour: 600ms long-press on touch (matches BU-icon-nav
  brief's suggestion); hover-after-300ms on pointer devices; ESC
  dismisses; auto-dismisses on scroll.
- The retro-fit on AppNav is the canary — if the primitive feels right
  there, propagate; if not, revise before adopting in the other strips.

---

## Scope

### Build

- `components/IconChipTooltip.tsx` (NEW — shared primitive: hover +
  long-press, controlled-disclosure, no portal-state leaks).
- `components/AppNav.tsx` (MODIFY — adopt `IconChipTooltip`; no other
  visual changes).
- `components/FeedFilterChips.tsx` (MODIFY — swap emoji/text labels
  for lucide icons per the table; AM brand glyph stays; "All" stays
  as text).
- `shared/feed-filters.ts` (MODIFY — replace `FEED_FILTER_LABELS`'s
  emoji prefixes with plain words; introduce `FEED_FILTER_LUCIDE` map
  pointing at lucide icon component names. Keep `FEED_FILTER_ICONS`
  for the AM brand glyph URL — that's the deliberate exception.)
- `app/calendar/NearMeView.tsx` (MODIFY — sort toggle: text → icons).
- `components/CommentList.tsx` (MODIFY — text → icons within the
  existing underline-tab geometry, pending open-question decision).
- Tests:
  - Unit: each strip renders correct `aria-label` per item (verbatim
    from prior text label).
  - Unit: tooltip primitive — long-press fires, hover fires, ESC
    dismisses, scroll dismisses.
  - Existing testid invariants preserved verbatim (F14 rule).
- README updates in any directory touched.

### Do NOT touch

- Server-side filter logic (`shared/feed-filters.ts` `FEED_FILTERS` ordering,
  `FEED_FILTER_TONES`, the `FeedFilter` type) — pure presentational
  refactor.
- Route handlers, services, db.
- AppNav active-state behaviour (already locked per BU-icon-nav).

### Out of scope

- Animated icon transitions.
- Multi-select / facet UI (parked — see UX decision above).
- Promoting NearMe sort to a different geometry.
- A first-run onboarding tour for the icons (parking-lot if needed).

---

## Acceptance criteria

- [ ] FeedFilterChips renders no emoji and no text labels except "All";
      each chip has `aria-label` matching the prior text (verbatim).
- [ ] AM brand glyph still renders as `<img>` per current code path.
- [ ] CommentList filter tabs render icons-only inside the existing
      underline-tab geometry (assuming open-question (b)).
- [ ] NearMeView sort renders Distance/Date as icons.
- [ ] AppNav, FeedFilterChips, CommentList, NearMeView sort all use
      the same `<IconChipTooltip>` primitive.
- [ ] Long-press on touch (≥ 600ms) reveals tooltip; hover on pointer
      (≥ 300ms) reveals tooltip; ESC dismisses; scroll dismisses.
- [ ] Screen reader announces every chip's prior text label.
- [ ] Existing testids preserved verbatim across all four files
      (F14 rule).
- [ ] `npm run typecheck && npm run lint && npm test` green.

---

## Open questions to surface

1. **Tick-or-cross icon.** `Vote` vs `ThumbsUp` vs `ListChecks` — Paul
   to confirm. Lean: `Vote`.
2. **Events icon.** `Megaphone` vs `Flag` — confirm. Lean: `Megaphone`.
3. **CommentList geometry.** Keep underline tabs (option b) or convert
   to pills (option a)? Lean: (b).
4. **Discoverability for newer members.** Same concern as BU-icon-nav.
   Tooltips help, but a member who never long-presses won't see them.
   Two mitigations: (a) accept the cost; (b) ship a one-time first-run
   coachmark on `/feed` highlighting the chip strip. Recommend (a) —
   keep it quiet, members will explore.
5. **AM brand glyph size.** Today it's 14px to sit next to text.
   Without text neighbours, should it scale up to match the lucide
   icon size (likely 16–18px)? Probably yes; confirm during build.

---

## Definition of done

- [ ] Files modified; tests added.
- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] Manual smoke: every chip on `/feed`, every tab on a post detail
      page, every sort option on `/calendar?view=near` — both desktop
      hover and mobile long-press reveal tooltips correctly.
- [ ] Screen-reader test: each chip announces its name.
- [ ] `package.json` version bumped (PATCH min).
- [ ] Brief flipped to `status: shipped`, `shipped_in: "#NNN"`.
- [ ] `npm run trackers` run if status flipped.
- [ ] No `any`, no `@ts-ignore`.

---

## Context

- BU-icon-nav brief — `bu-icon-nav.md` — sets the AppNav precedent and
  the deferred-tooltip TODO this BU closes.
- BU-calendar-near-me brief — established the icons-only idiom on
  `CalendarToggle`.
- Share taxonomy memory — AM is a partner brand, not a kind chip;
  brand glyph is a deliberate exception.
- Lucide icons: <https://lucide.dev/icons/>
- Design philosophy: `docs/product/design-philosophy.md`.
- Affected files: `components/FeedFilterChips.tsx`,
  `components/CommentList.tsx`, `app/calendar/NearMeView.tsx`,
  `components/AppNav.tsx`, `shared/feed-filters.ts`.
