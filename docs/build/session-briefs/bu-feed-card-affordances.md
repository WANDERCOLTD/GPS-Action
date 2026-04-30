---
slug: bu-feed-card-affordances
status: shipped
shipped_in: '#147'
phase: 2
priority: medium
note: 'Spun out from bu-publish-router (PR #146). Two themes: feed-card tap targets + the project-wide arrow-link styling pass.'
---

# SESSION BRIEF · bu-feed-card-affordances — feed card tap targets, type chip, reaction styling, project-wide ArrowLink

_Brief version: 0.1 · Author: Paul (via Claude) · Date: 2026-04-29_

---

## Why this exists / why now

Two related problems surfaced while smoke-testing `bu-publish-router`
on iPhone:

1. **Cards in `/feed` don't reliably navigate to detail on tap, and
   the reaction button doesn't fire either.** Root cause: `<article
   onClick>` is a brittle iOS pattern when the article carries
   nested interactive children (link previews, reaction pill,
   reviewed-by badge). iOS Safari cancels marginal taps on non-
   anchor elements; native `<Link>` taps don't have this problem.
2. **The "Open →" / "← Back to feed" / "Send email →" links across
   the app are bare inline-styled `<Link>` instances.** No hover
   state, no transition, no shared component, no consistency. They
   work but they look unfinished.

These are best-practice problems both fixed by adopting industry-
standard patterns: real `<Link>` elements as the primary tap target,
a small kind chip (Reddit-flair style) next to the title for
category visibility, the smiley+plus lozenge (Slack/Discord) for the
"add reaction" affordance, reactions in their own bordered cluster
right-justified at the bottom of the card, and a shared
`<ArrowLink>` component everywhere those text+arrow links live.

---

## Objective

Three deliverables, one PR:

1. **Feed card tap reliability + visible affordances.** Title is a
   real `<Link>` to `/post/{id}`. Optional thumbnail wraps the same
   `<Link>`. A "Read post →" link sits below the body. The article-
   level `onClick` is removed (no longer load-bearing). Result:
   every iOS tap that lands on a real link target fires natively;
   marginal taps in dead zones simply don't navigate (acceptable —
   the affordances are visible).
2. **Card type as a small chip beside the title.** Reddit-flair
   pattern. One small monochrome-tinted pill that sits inline with
   or just before the post title, present for every kind. Replaces
   the existing standalone `<KindChip>` row beneath the title. The
   left-edge coloured border idea is rejected as a colour-only
   accessibility risk.
3. **Reaction row redesigned and project-wide ArrowLink component.**
   Reactions cluster right-justified at the bottom of the card,
   wrapped in a single rounded container with its own border. The
   "React" word is replaced with a `🙂+` smiley-plus icon (Slack
   pattern). A new shared `<ArrowLink>` component wraps the bare
   inline-styled back/forward links currently scattered across the
   app — proper hover, arrow-shift transition, accessible focus
   ring. Apply consistently.

Success looks like: tap any feed card on iPhone — title link or
thumbnail or "Read post →" — and `/post/{id}` opens. Tap a reaction
emoji, never accidentally navigate. Tap the smiley+plus, the tray
opens. Tap "← Back to feed" anywhere in the app, get the same hover
treatment.

---

## Scope

### Build in this session

- `components/ArrowLink.tsx` (new) — shared component. Props:
  `{ href, direction: 'forward' | 'back' | 'none', children, size? }`.
  Renders a real `<Link>` with the arrow as a separate `<span>` so a
  CSS transition can shift it 2px on hover. Includes focus-visible
  ring per the project's design philosophy. `data-testid="arrow-link"`
  + `data-direction`.
- `components/PostCard.tsx` — title becomes `<Link href="/post/{id}">`.
  Thumbnail wraps same Link (when present). "Read post →" `<ArrowLink
  direction="forward">` below the body. Article-level `onClick`,
  `role="link"`, `tabIndex` removed. `cursor: pointer` removed from
  the article (no longer accurate). Kind chip moves to inline-with-
  title (Reddit flair). Reaction row repositioned to bottom-right
  with a single bordered container.
- `components/ReactionPill.tsx` — "React" word replaced with `🙂+`
  in the same pill. Outer container border + right-justified flex
  alignment. `e.stopPropagation()` defensively on the toggle button.
- `components/PostShareGroup.tsx` — verify share-group placement
  doesn't collide with the new bottom-right reaction cluster.
- All existing inline arrow-links across `/app` and `/components`
  refactored to use `<ArrowLink>`. Inventory: `/post/[id]`,
  `/requests`, `/requests/[id]`, `/data/[entity]`, `/data/[entity]/new`,
  `/data/[entity]/[id]/edit`, `/settings`, `EntityDetailPage`,
  `LinkPreviewCard` (CTA labels stay the same).
- `tests/unit/post-card.test.tsx` — extended assertions for title
  link, thumbnail link, Read-post link, reaction-cluster container.
- `tests/unit/arrow-link.test.tsx` (new) — shape, direction, testids.

### Deliberately out of scope

- Tap-to-expand-inline behaviour (rejected per design philosophy —
  detail page is the canonical "expand")
- New post types or kind taxonomy changes (separate concern)
- Reaction tray UX changes beyond removing the "React" word
- Audit of any other shared component patterns

---

## Contracts to honour

- **F14 testid rule** — every interactive element has a stable
  static `data-testid` from the canonical `compose` / `feed` / `post`
  area prefixes. New testids:
  - `feed-card-title-link`
  - `feed-card-thumb-link`
  - `feed-card-read-post-link`
  - `feed-card-reaction-cluster`
  - `arrow-link`
- **Layer boundaries** — `ArrowLink` lives in `/components`,
  importable from `/app` + `/components`.
- **Design tokens only** — no hex literals; no hardcoded colours.
  Hover treatment uses `color-mix()`.
- **Per-PR PATCH version bump.**
- **Sharon-warmth voice** — every bit of copy stays plain English;
  "Read post →" not "View this post" or "Continue reading".
- **No tap-to-expand** — detail page is the expand.

---

## Tests

**Unit:**

- `tests/unit/arrow-link.test.tsx` — renders correct anchor, arrow
  position per `direction`, testid, accessible name.
- `tests/unit/post-card.test.tsx` — title link points at
  `/post/{id}`; "Read post" link present; reaction cluster wraps
  pill + smiley-plus.

**Manual smoke (DoD):**

- iPhone: every card tap navigates to detail. Reaction pill fires
  without navigating. "Read post →" arrow shifts on hover (desktop)
  and is still tappable on mobile.
- Desktop: hover treatment on every `<ArrowLink>` instance — arrow
  shifts, underline appears.
- Keyboard: tab through a card, Enter on the title link navigates.

---

## Definition of done

- Every place an arrow-link existed now uses `<ArrowLink>`
- Cards tap reliably on iOS
- Type chip visible on every feed card next to the title
- Reaction row right-justified, bordered cluster, smiley+plus replaces "React"
- All gates green; full suite passes; trace + ref-data clean
- Brief flipped to `status: shipped` + `shipped_in: "#NNN"` on PR open
