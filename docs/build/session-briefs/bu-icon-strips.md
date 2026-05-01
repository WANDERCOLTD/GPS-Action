---
slug: bu-icon-strips
status: stub
phase: 2
priority: medium
note: "Unify the word-bearing chip/tab strips below the AppNav level — FeedFilterChips, CommentList tabs, NearMeView sort — to icons (mostly) with a shared long-press / hover tooltip primitive. Two deliberate non-lucide exceptions on the Feed chip strip: AM brand glyph and the ✅❌ emoji on tick-or-cross. Closes the tooltip TODO from BU-icon-nav. All picks locked 2026-05-01. Spawned from a /feed visual-consistency review."
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
| Feed | AM | **Brand glyph stays** (deliberate partner-brand exception per share-taxonomy). Lucide `Megaphone` is reserved for AM and **must not be used elsewhere** in the app, in case we ever swap brand glyph → lucide. | Activist Mailer |
| Feed | Tick-or-cross | **Keep `✅❌` emoji** — deliberate semantic exception. The chip's identity *is* the tick-and-cross visual; no single lucide line icon mirrors that pair, and the alternatives (Gavel / Scale / Stamp) shift the meaning toward "judgement" or "verdict" rather than the literal yes/no decision. | Promote / Report |
| Feed | Now | `Radio` | Happening now |
| Feed | Meetings | `Users` | Meetings |
| Feed | Events | `Ticket` — universal "live event" mental model. (`CalendarDays` already represents the Event PostKind in `KindPickerSheet`; using it again on the chip would conflate kind-picker semantics with filter semantics. `Megaphone` reserved for AM. `Flag` taken by the disabled "Flag a problem post" kind.) | Events |
| Comments | Discussion | `MessageSquare` | Discussion |
| Comments | Activity | `Activity` | Activity |
| Comments | All | *(no icon — same outlier rule as Feed/All)* | — |
| Near-me | Distance | `Ruler` | Sort by distance |
| Near-me | Date | `CalendarDays` | Sort by date |

**CommentList geometry: keep underline tabs (locked).** Underline tabs
say "you are in this view"; chip pills say "filter the list." Comments
tabs switch the *meaning* of the comment list (Discussion vs Activity
vs All), so they should retain the tab idiom — only the text→icon
swap happens here, not a geometry change.

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
- `components/FeedFilterChips.tsx` (MODIFY — render lucide icons per
  the table. Two deliberate exceptions: AM keeps its brand `<img>`,
  tick-or-cross keeps the `✅❌` emoji. "All" stays as plain text.)
- `shared/feed-filters.ts` (MODIFY — `FEED_FILTER_LABELS` keeps "All"
  / "Urgent" / "Now" / "Meetings" / "Events" as plain words, drops
  the `⚡` prefix, retains `✅❌` verbatim for tick-or-cross. Introduce
  `FEED_FILTER_LUCIDE` map pointing at lucide icon component names
  for the chips that get one — `tick_or_cross` and `activist_mailer`
  are absent from this map by design. `FEED_FILTER_ICONS` keeps its
  AM brand-glyph URL.)
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

1. **AM brand glyph size.** Today it's 14px to sit next to text.
   Without text neighbours, should it scale up to match the lucide
   icon size (likely 16–18px)? Probably yes; confirm during build.
2. **Discoverability for newer members.** Same concern as BU-icon-nav.
   Tooltips help, but a member who never long-presses won't see them.
   Accepted cost — keep it quiet, members will explore. (No coachmark.)

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
