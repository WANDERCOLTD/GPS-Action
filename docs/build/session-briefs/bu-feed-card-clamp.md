---
slug: bu-feed-card-clamp
status: shipped
shipped_in: "#141"
phase: 2
priority: medium
note: "Slice 1 of the feed-card density redesign. Slice 2 (chip variant + user-selected density toggle) is bu-feed-density-variants."
---

# SESSION BRIEF · bu-feed-card-clamp — body clamp + thumbnail compact variant

_Brief version: 0.1 · Author: Paul (via Claude) · Date: 2026-04-28_

Slice 1 of the feed-card density redesign. Lands a 3-line body clamp and a
96px right-thumbnail layout as a new `compact` variant on `PostCard`,
defaulted on. Slice 2 (`bu-feed-density-variants`) adds a `chip` variant
plus a list-vs-chip toggle in `AppNav` that persists to localStorage.

This BU also lands the variant-prop scaffolding (`'full' | 'compact'`) the
toggle BU will extend to `'chip'`. Per the agent's RT-001 reuse note: one
component, three layouts — not three components.

---

## Why this exists / why now

Surfaced by RT-001's reference-app survey of long-content cards (X /
LinkedIn / Reddit / Medium / Substack / news aggregators). Every
mainstream feed clamps the body to 2–4 lines when a title, image, or CTA
is present. `components/PostCard.tsx` renders the **full unclamped body**
of every post — 2000 words on the feed if a 2000-word post lands. That's
a genuine outlier vs. modern UX, and it works against design-philosophy
principle 3 (no anxiety amplification, "permission to close" the app
after acting).

The full RT-001 investigation lives in `docs/random-thoughts.md`. This
BU is the standalone-shippable subset: clamp + thumb only, no toggle UI,
no chip layout, no schema work.

---

## Objective

Add a `variant: 'full' | 'compact'` prop to `PostCard`. The `compact`
variant clamps the body to 3 lines via `-webkit-line-clamp` (already
used in `LinkPreviewCard.tsx:205,216`) and renders the hero image as a
96 × 96 right-square thumbnail next to title + body, instead of the
current full-width 16:9 above the title. Default flips to `compact`.

Tap-anywhere navigates to `/post/[id]` (D061's global tap contract);
no inline expand on the card. The detail page renders the unclamped
body, so nothing is hidden — the clamp is purely a feed-density move.

Success = `/feed` on a 1000-word post shows ~3 lines of body + a small
thumb to the right + the existing primary CTA + reactions + comment
count. Tapping the card lands on `/post/[id]` with the full body
visible, exactly as it does today.

---

## Scope

### Build in this session

- `components/PostCard.tsx` (MODIFY)
  - Add `variant?: 'full' | 'compact'` prop, default `'compact'`.
  - In `compact`: wrap the existing body `<div>` in a flex row with the
    body on the left (`flex: 1`) and the hero thumbnail on the right
    (`width: 96`, `height: 96`, `objectFit: 'cover'`,
    `borderRadius: var(--radius-md)`). Body inner `<div>` gets
    `-webkit-line-clamp: 3` + `display: -webkit-box` +
    `-webkit-box-orient: vertical` + `overflow: hidden`. The
    `\n\n`-paragraph split collapses into a single inline body string
    in `compact` (clamp doesn't span block elements). In `full`, the
    paragraph split + full hero render unchanged.
  - When no hero is present in `compact`, body spans full width (no
    empty thumb slot, no placeholder).
  - `linkImageUrl` precedence is unchanged: it already renders inside
    the top-of-card primary `LinkPreviewCard` and is not duplicated as
    a right thumbnail. If the post has no `heroImageUrl`, no right
    thumb. Per RT-001 Q3.
  - Tap-anywhere semantics unchanged. Existing `data-testid` values
    unchanged.
  - Add `data-testid="post-card-thumb"` on the right thumbnail (when
    rendered) and `data-testid="post-card-body"` + `data-variant`
    attribute on the body wrapper for test addressability.
- `app/feed/page.tsx` and any other call sites of `<PostCard>` —
  no changes; they inherit the new default.
- `tests/unit/post-card.test.tsx` (new) — render snapshots for both
  variants, assert clamp class applied in `compact` only, assert thumb
  rendered when `heroImageUrl` set in `compact` and not in `full`,
  assert body wrapper carries `data-variant`. Reuse the no-RTL pattern
  established in `app-nav.test.tsx` / `intent-fab-starter.test.tsx`.

### Deliberately out of scope

- **Chip variant (`'chip'`)**, 2-column grid, AppNav toggle UI,
  localStorage persistence — all in `bu-feed-density-variants`.
- **Cultural-marker always-full override** (Shabbat / remembrance) —
  deferred to the toggle BU; nothing currently flags those posts as
  variant-locked.
- **Multi-CTA `Action[]` schema work** — the parking-lot entry is the
  parent of the chip work but doesn't gate the clamp. RT-001 Q1 stays
  open and unblocked.
- **Share rail repositioning** — `<PostShareGroup variant="card-rail">`
  stays where it is. Modern feeds tend to put share in a horizontal
  bottom row, but moving it is its own design conversation.
- **Detail page `/post/[id]`** — unchanged. Always-full there.

---

## Contracts to honour

- **D061 (global tap pattern)** — tap-anywhere navs to detail; no
  inline expand on the card. Chevron / "Show more" affordances are
  out — the clamp is silent and tapping reveals the full body via
  navigation.
- **D050 / D052 (reactions, comments)** — the reaction pill and
  comment-count link continue to render below the body in both
  variants.
- **D060 / D066-proposed (primary CTA at top)** — `primaryCta`
  (LinkPreviewCard) stays at the top of main content above the
  title in both variants.
- **D064 (heroImageUrl wins over linkImageUrl for top-of-card)** —
  precedence preserved. In `compact`, hero becomes the right thumb.
- **F14 testid rule** — every new interactive element carries a
  `data-testid`. New ids use the existing `post-` prefix (already in
  the canonical area list).
- **Voice/tone** — no copy added in this BU. Clamp is silent; no
  "Read more" link.

---

## Risks / known gotchas

- **Visual regression on feed for long bodies.** Anyone reading long
  bodies inline today loses the inline view. Mitigated by the detail
  page being one tap away (D061 contract). Document in PR body so
  pilot reviewers know this is the new default.
- **`-webkit-line-clamp` cross-browser support.** Mainstream now
  (Chromium, WebKit, Firefox 68+) — same primitive `LinkPreviewCard`
  already relies on. No regression risk.
- **Single-line collapse of `\n\n` paragraphs in `compact`.** The
  existing post bodies are split on `\n\n` into separate `<p>`s; in
  compact we render as one `<div>` so the clamp can span. Means a
  post with three paragraphs shows the first ~3 lines of paragraph 1
  only, not "first line of each paragraph". Acceptable: the detail
  view shows the full structure. Document as a known limitation.
- **Hero aspect ratio mismatch.** Some hero images are 16:9 widescreen;
  cropping to 96 × 96 with `objectFit: 'cover'` will lose context.
  This is the intended Medium / Reddit-card behaviour and is noted
  in RT-001's reference-app survey.

---

## Definition of done

- `npm run typecheck && npm run lint && npm test` all clean.
- Default render of `/feed` shows clamped body + right thumbnail (when
  hero present) on every card.
- Detail page `/post/[id]` renders unchanged.
- Manual smoke:
  - `/feed` on a long-body post → clamp visible, thumb rendered.
  - Tap card → lands on `/post/[id]` with full body visible.
  - `/feed` on a no-hero post → body spans full width, no empty
    thumb slot.
  - `/feed` on a tick_or_cross post → signal badge row renders ahead
    of title in both variants.
  - `/feed` on an alert (urgency) post → alert chip + clamp both
    render.
- PR title uses `feat(feed): BU-feed-card-clamp — …` (uppercase
  `BU-` so the brief-status gate fires); brief flips to
  `status: shipped` + `shipped_in: "#NNN"` in the same PR; trackers
  refreshed.
- `package.json` PATCH bump (current main: 0.2.11 → 0.2.12 or higher).
- RT-001 stays in `random-thoughts.md` flagged
  `promoted to bu-feed-card-clamp + bu-feed-density-variants`. (The
  promotion edit lands in this BU's PR or the Slice 2 PR — track
  in the trackers refresh.)

---

## Files this BU touches (summary)

| File | Action | Notes |
|---|---|---|
| `components/PostCard.tsx` | modify | Add `variant` prop, compact layout, body clamp wrapper |
| `tests/unit/post-card.test.tsx` | new | Variant snapshot + clamp/thumb assertions |
| `docs/random-thoughts.md` | modify | RT-001 status flip to `promoted` |
| `package.json` | modify | PATCH bump |
| `docs/build/session-briefs/bu-feed-card-clamp.md` | new | This brief; flip to shipped at PR open |

---

## Promotion notes

After this lands, `bu-feed-density-variants` is the natural follow-up:

- Adds `'chip'` to the `variant` union: 2-col grid on `/feed` ≥ 480px,
  64px thumb, primary-CTA pill, body hidden, share moves to detail.
- Adds the list ↔ chip toggle in `AppNav`, persisted to localStorage.
- Picks up the cultural-marker "always-full" override deferred from
  this BU.
- Resolves RT-001 Q2 (reach: feed-only vs. /me / requests / vetting).
