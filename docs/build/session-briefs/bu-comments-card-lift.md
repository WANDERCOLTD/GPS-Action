---
slug: bu-comments-card-lift
status: planned
priority: medium
phase: 2
---
# SESSION BRIEF · BU-comments-card-lift — fix reactions row + lift comment cards

_Brief version: 1.0 · Author: Paul + Claude · Date: 2026-04-30_
_Priority: medium. One PR, three logical commits._

---

## Objective

Two visible polish fixes on the post-detail discussion surface:

1. The reaction rail rendered vertically — every emoji stacked on top
   of the next — because both empty-state and populated-state reused
   the same `flex-direction: column` container. Restore the intended
   horizontal layout.
2. Each comment rendered as a flat row with a thin underline. Lift
   it into a mini-card with a raised surface, subtle border, and an
   avatar-byline pattern that matches PostCard, so the discussion
   thread reads as a thread of mini-cards rather than a list.

## Scope

### 1. `components/ReactionPill.tsx`

- Empty-state quick-rail container → `flex-direction: row`,
  `flex-wrap: wrap`, `gap: 4`, `align-items: center`.
- Populated-state stack container → same horizontal row.
- Outer container that wraps trigger + rail/stack → also horizontal.
- Picker emoji buttons → ghost styling: `opacity: 0.55`, transparent
  ground, transparent border. Lift to `opacity: 1` + sunken
  background on hover/focus, with a 120ms transition. Inline styles
  can't carry pseudo-classes, so the lift is mirrored via React
  state on a per-emoji basis.
- testid invariants preserved (F14): `post-reaction-quickrail-<emoji>`
  remains a static literal at each call site.

### 2. `components/CommentItem.tsx`

- Wrap the comment in a card-style article: `--colour-surface-raised`
  background, `1px solid --colour-border-subtle`, `--radius-md`
  rounded corners, padded `--space-3 --space-4`.
- Layout: 36px avatar on the left (via `<UserAvatar />`) + content
  column on the right with byline / body / reactions stacked.
- Byline mirrors PostCard idiom: bold display name, role chips,
  "new member" chip when applicable, right-aligned timestamp.
- Body bumps from `--text-sm` to `--text-base`.
- Reaction pill sits below the body (now horizontal per Commit 1).
- testid `comment-item` preserved.

### 3. Brief + version bump

- This brief, status flipped to `shipped` after the PR opens.
- `package.json` 0.2.43 → 0.2.44.
- `npm run trackers` to refresh BU sequence.

## Out of scope

- Changing the reaction tray (the picker that appears when 🙂+ is
  tapped). Only the rail / stack containers and ghost styling.
- Changes to system-comment rendering (`post_review_attribution`
  branch keeps its D072 treatment).
- Edit/delete UI on comments — still out of MVP per D052.

## Tests required

- `tests/unit/reaction-pill.test.tsx` — assert that both containers
  use `flex-direction: row` + `flex-wrap: wrap` and the picker
  emoji default to `opacity ≤ 0.6` on a transparent ground.

## Definition of done

- typecheck / lint / test all green under `CI=1 TZ=UTC`.
- `package.json` bumped to `0.2.44`.
- Brief flipped to `status: shipped` / `shipped_in: "#<PR>"` and
  trackers regenerated.
