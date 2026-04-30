---
slug: bu-icon-nav
status: shipped
phase: 2
priority: low
shipped_in: "#152"
note: "Stub. Convert AppNav from text-or-text+icon to icons-only across all five tabs. Two of five icon picks already locked (Feed, Calendar); three open. Spawned out of bu-calendar Q4 walkthrough on 2026-04-30."
---

# SESSION BRIEF · BU-icon-nav — Convert AppNav to icons-only

*Brief version: 0.1 (stub) · Author: Paul · Date: 2026-04-30*

---

## Objective

Replace text labels in `AppNav` with icons across all five tabs:
**Feed · Calendar · Requests · Data · Settings**. Tab strip becomes a
row of icons; the active tab indicator stays. Accessibility: each
icon retains an `aria-label` matching the prior text label.

This BU emerged from the bu-calendar walkthrough (Q4): user wants
icons-only nav across the whole strip, not just for the new Calendar
tab. bu-calendar-view ships Calendar in the existing icon+label idiom
to avoid scope creep; this BU does the strip-wide conversion.

---

## Pre-requisites

- **bu-calendar-view should ship first.** It's safer to add the new
  Calendar tab in the existing nav idiom, then convert all five tabs
  in one move, than to land a partial conversion mid-BU.
- **Pick the remaining three icons** (open questions below). Cannot
  start until those are decided.

---

## Locked picks (from bu-calendar Q4)

- **Feed** → `home` (lucide)
- **Calendar** → `calendar-clock` (lucide). *(Distinct from the `event`
  PostKind icon `calendar-days`, so kind-level vs nav-level read
  cleanly.)*

## Open picks (decide before starting)

- **Requests** → candidates: `inbox`, `mail-question`, `hand`,
  `helping-hand`, `flag`, `megaphone`. Tone: action / ask. Not
  `bell` (notification-y, not requests-y).
- **Data** → candidates: `bar-chart-3`, `line-chart`, `database`,
  `gauge`, `trending-up`. Currently a private-ish surface; pick
  what matches its content.
- **Settings** → candidates: `settings`, `sliders-horizontal`,
  `cog`, `user-circle`. `settings` is the safest universal pick.

---

## Scope

### Build

- `components/AppNav.tsx` (MODIFY — drop text labels; render icons
  with `aria-label`. Active state via existing indicator only,
  not text colour.)
- Tests for accessibility (`aria-label` present per tab; keyboard
  focus order preserved).
- README in `components/` updated.

### Do NOT touch

- Routes, route handlers, page components — nav is presentational.
- Permission gates — unchanged.
- Other navigation surfaces (footer, breadcrumbs if any) — out of
  scope.

### Out of scope

- Tooltips / long-press labels on touch devices. (Accessibility
  is via `aria-label` for screen readers; sighted users learn icons.
  If discoverability is a concern, file a follow-up for tooltips.)
- Animated active-state transitions.
- Bottom-nav vs top-nav layout shift.

---

## Acceptance criteria

- [ ] All five tabs render icon-only; no visible text.
- [ ] Each tab has `aria-label` matching its prior text label.
- [ ] Active state visually distinguishable.
- [ ] Keyboard navigation order unchanged.
- [ ] Mobile + desktop both look intentional (no awkward gaps).
- [ ] Screen reader announces tab name correctly.

---

## Open questions to surface

1. **Discoverability concern.** Activist members vary in
   tech-fluency. Icons-only may confuse newer members. Two
   mitigations: (a) accept the cost, lean on familiar icons +
   tooltips; (b) keep text labels and skip this BU.
   Recommend confirming with at least 2 non-tech members before
   landing.
2. **Tooltip on long-press / hover?** If discoverability is a
   concern, a 600ms-hold tooltip showing the tab name covers
   touch devices. Recommend deferring to a follow-up if not
   needed.
3. **Notification badges.** When notifications land (separate BU),
   they'll attach to nav tabs. Confirm icons-only doesn't fight
   badge placement.

---

## Definition of done

- [ ] Files modified; tests added.
- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] Manual click-through: each tab activates correctly.
- [ ] Screen-reader test: each tab announces its name.
- [ ] `package.json` version bumped.
- [ ] Brief flipped to `status: shipped`, `shipped_in: "#NNN"`.
- [ ] No `any`, no `@ts-ignore`.

---

## Context

- bu-calendar-view brief — sets the precedent of "Calendar tab
  with current idiom; full conversion happens here."
- Lucide icons: <https://lucide.dev/icons/>
- Design philosophy: `docs/product/design-philosophy.md`.
- AppNav: `components/AppNav.tsx`.
