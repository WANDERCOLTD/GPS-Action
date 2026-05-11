---
slug: bu-network-card-layout
status: shipped
phase: 2
priority: medium
shipped_in: "#337"
note: "UX redesign of NetworkCard: reactions move to bottom, share rail becomes vertical RHS column with subtle background, most-used-first ordering. Mobile collapses to single column with horizontal share rail."
---

# SESSION BRIEF · bu-network-card-layout — RHS share column + bottom reactions

_Author: Paul + Claude · Created: 2026-05-11_
_Type: UX layout refactor on a single card component. No schema, no service, no new dep. Two new style classes + one component prop._

---

## 1 · Business Analyst — why this matters

The just-shipped engagement layer (reactions + share rail) currently
puts both controls inline between body and triage. That's the simplest
mount but it doesn't reflect the hierarchy Paul wants:

- **Sharing is the primary call-to-action** for network cards — the
  whole reason coordinators triage and Promote is so members
  amplify the content. Sharing should be the most visible, constantly-
  accessible affordance.
- **Reactions are sentiment, not action** — they belong as a closing
  beat near the bottom of the card, not competing with the share rail
  for attention.

The redesign:

- **RHS vertical share column** — always visible alongside the body.
  Counter pill at the top, then WhatsApp (most-used), then X / IG / FB.
  Subtle background tint distinguishes the column as a "tray".
- **Reactions at the bottom** — directly above the triage row, so the
  reading flow is hero → body → reactions → triage.
- **Mobile (<720px)** — collapses to single column. Share rail goes
  horizontal under the body (matches the live `/feed` pattern).

### Success looks like

- Coordinator-eye-test: glancing at a card, the share column draws
  attention without crowding the body.
- Member-eye-test: tap-targets for share remain ≥44×44.
- No regression: every reaction and share still fires its existing
  intent / verified flow; counter pill still renders at 0 grey.
- A11y: tab order top-to-bottom matches the visual reading order
  (LHS body first, then RHS share column).

---

## 2 · Tech Lead — the design

### Component surface

**ShareGroup.tsx** — two new props (both backwards-compatible):

```ts
interface ShareGroupProps {
  ...existing...
  /** 'horizontal' (default) or 'vertical'. Vertical = column with
   *  counter pill on top, X/IG/FB icons stacked below. */
  orientation?: 'horizontal' | 'vertical';
  /** When true, suppress the internal counter pill so the caller can
   *  render its own and intersperse other items (e.g., WhatsApp button
   *  between counter and icons). */
  hideCounter?: boolean;
}
```

**ShareCountPill.tsx** (new) — extracted from ShareGroup's internal
counter render. Same styling and tooltip. Lets NetworkCard compose
the column independently from the rail.

**NetworkCard.tsx** — restructure the body into LHS + RHS:

```
┌── article ──────────────────────────────────────┐
│ (header — title link, when no preview)          │
│ meta row                                        │
│ ┌─ main (LHS) ──────────┬─ share col (RHS) ──┐  │
│ │ link preview hero     │ ★ counter           │  │
│ │ body text             │ WhatsApp            │  │
│ │ reactions tray        │ X                   │  │
│ │ triage row            │ IG                  │  │
│ │                       │ FB                  │  │
│ └───────────────────────┴────────────────────┘  │
└─────────────────────────────────────────────────┘
```

Mobile (<720px): main + share column stack vertically. Share column
flips back to horizontal (counter+WhatsApp+X+IG+FB in a row), matches
existing `/feed` rail pattern.

### CSS

Add to `styles/components.css`:

- `.gps-network-card-layout` — flex container.
  - Default: `flex-direction: column`
  - `@media (min-width: 720px)`: `flex-direction: row; align-items: stretch`
- `.gps-network-card-main` — flex: 1; min-width: 0 (so long URLs wrap)
- `.gps-network-card-share-column`:
  - Default: `flex-direction: row; gap: var(--space-2); flex-wrap: wrap`
  - `@media (min-width: 720px)`: `flex-direction: column; gap: var(--space-2); width: 80px; flex-shrink: 0; background: color-mix(in srgb, var(--colour-surface-sunken) 60%, transparent); border-radius: var(--radius-md); padding: var(--space-3) var(--space-2)`

720px matches the existing tablet/desktop breakpoint in `components.css`.

### Layer boundaries

All edits are within enforced layer boundaries:
- `components/NetworkCard.tsx` (view)
- `components/ShareGroup.tsx` (view — new props)
- `components/ShareCountPill.tsx` (view — new)
- `styles/components.css` (style)

No router, service, or schema changes.

### Tests

- **Component** — `tests/unit/network-card.test.tsx`: assert the
  share column wrapper renders, contains counter / WA / X / IG / FB
  in the expected order. Reactions land in the LHS main column
  alongside body and triage.
- **Component** — `tests/unit/share-group.test.tsx`: extend with a
  case for `orientation='vertical'` and a case for `hideCounter=true`.
- **Component** — `tests/unit/share-count-pill.test.tsx` (new):
  rendering with zero / non-zero counts, tooltip content.
- **Existing** — no regression on `/feed` PostCard or any other
  ShareGroup caller (the default `orientation` stays horizontal and
  `hideCounter` defaults false).

### Rollback

Pure UI revert — drop the wrapper classes from `NetworkCard.tsx`,
delete the CSS rules, remove the two new ShareGroup props. No data
implication.

---

## Scope

### Build in this session

- `components/NetworkCard.tsx` (restructure body into LHS+RHS, mount classes)
- `components/ShareGroup.tsx` (add `orientation` + `hideCounter` props)
- `components/ShareCountPill.tsx` (new — extract counter rendering)
- `styles/components.css` (add `.gps-network-card-layout` + descendants)
- `tests/unit/network-card.test.tsx` (extend for new layout)
- `tests/unit/share-group.test.tsx` (extend for orientation + hideCounter)
- `tests/unit/share-count-pill.test.tsx` (new)
- `package.json` (version bump, patch)

### Do NOT touch

- `ShareEvent` schema or share-event service (orthogonal)
- `Reaction` service / schema
- `app/network/network-feed.tsx` (data wiring is unchanged; only the card layout shifts)
- `components/PostCard.tsx` and the `/feed` rail (the default ShareGroup behaviour stays horizontal — no regression)

### Out of scope

- Animation transitions for the column on resize (defer to a polish BU)
- A11y refinements beyond tab order (existing rail already has aria labels)
- Hero image resize when share column is alongside (hero stays full-width inside the LHS main column)

## Acceptance criteria

- [ ] On viewport ≥720px: share column renders on the RHS, vertically
      stacked, with counter on top, WhatsApp second, then X / IG / FB
- [ ] On viewport <720px: share column appears below the body,
      horizontally arranged, same items in the same order
- [ ] Reactions tray sits directly above the triage row in both layouts
- [ ] Counter pill greys at zero, highlights non-zero, same as today
- [ ] No regression: `/feed` PostCard's share rail layout is unchanged
- [ ] Tab order top-to-bottom: hero → body → reactions → triage (LHS),
      then counter → WhatsApp → X → IG → FB (RHS)

## Open questions to surface

(Locked before starting per Paul's direction:)

- Counter pill: part of vertical stack? **Yes — top of column**
- Share rail order: **most-used first → WhatsApp before X/IG/FB**
- Background: **subtle surface-sunken tint, rounded, padded**

## Context

- `components/NetworkCard.tsx` — the mount surface
- `components/ShareGroup.tsx` — the rail component being made orientation-aware
- `styles/components.css` — existing 720px breakpoint precedent
- Memory: share taxonomy — share = socials rail + WhatsApp separate, NOT email
- Memory: no anxiety amplification — share column is prominent but not aggressive (subtle tint, not bordered or shadowed)
