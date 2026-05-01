---
slug: bu-postcard-share-polish
status: in-progress
phase: 2
priority: low
---

# SESSION BRIEF · bu-postcard-share-polish — three small layout/icon polishes on the PostCard share + reaction surfaces

_Brief version: 0.1 · Author: Paul (via Claude) · Date: 2026-04-30_

Three tiny polish items on the PostCard share + reaction surfaces. One
PR, three logical commits. No new behaviour, no new contracts — purely
layout and brand-icon corrections so the card reads as it should.

---

## Why this exists / why now

After #166 made `<ReactionPill>` horizontal, the right rail in
`<PostCard>` carried two concepts at once: outbound shares (WhatsApp +
socials) and inbound interactions (reactions + comments). The reaction
pill never had room to breathe, the share rail floated toward centre
because nothing pinned it to the right edge, and the WhatsApp glyph
was a generic phone receiver that read as "voice call" rather than
"WhatsApp". Three small fixes ship together so the card is honest
about its anatomy.

---

## Scope

### 1. Reactions on a dedicated bottom row

In `components/PostCard.tsx`:

- Move `<ReactionPill />` out of the right rail into a full-width row
  at the bottom of the article, separated from the body by a
  `1px solid var(--colour-border-subtle)` top border.
- Padding `var(--space-3)` top and bottom.
- Reactions still render via the existing `ReactionPill` (already
  horizontal post-#166).
- Existing `post-reaction-*` testids and aria-labels preserved.
- CommentItem and the post-detail page keep their original placement.

### 2. Pin social rail to the card's right inner edge

In `components/PostCard.tsx` (the rail's parent is a flex row):

- `align-self: flex-start` + `margin-left: auto` on the `<aside>`
  pushes the rail flush to the right padding.
- Mobile collision: byline content has `flex: 1, minWidth: 0` so its
  text wraps before crowding the ~32px-wide rail. No need to shrink
  the rail icons or wrap them below the byline.

### 3. WhatsApp brand glyph (replaces lucide `Phone`)

In `components/WhatsAppShareButton.tsx`:

- Inline SVG `<WhatsAppGlyph>` component renders the WhatsApp brandmark
  at the previous Phone-icon size (18px compact / 20px pill).
- `currentColor` fill so the existing white-on-green logic still works.
- Path data from simple-icons.org. whatsapp.com/brand permits the
  glyph on share-to-WhatsApp buttons.
- Icon span carries `data-testid="whatsapp-share-icon"`; outer
  `post-share-whatsapp` testid unchanged.

### Do NOT touch

- `<CommentItem>` reaction placement — comments keep the inline pill.
- `app/post/[id]/page.tsx` reaction placement — detail page is owned
  by its own surface logic.
- `<ReactionPill>` itself — the horizontal layout is shipped as of #166.
- Any analytics, share contract, or reaction state machine.

---

## Acceptance criteria

- [x] Reactions render in a full-width bottom row with a top-border
      separator and `var(--space-3)` vertical padding.
- [x] Right rail anchors flush to the card's right inner edge.
- [x] WhatsApp button shows the brand glyph (not a phone receiver) at
      the previous icon size, white on green.
- [x] All existing testids and aria-labels preserved.
- [x] `npm run typecheck && npm run lint && npm test &&
      npm run trace:check && npm run trackers:check` all green.
- [x] `package.json` PATCH bumped 0.2.44 → 0.2.45.

---

## Tests required

- Existing `tests/unit/post-card.test.tsx` continues to pass (tests
  walk testids, all preserved).
- Existing `tests/unit/whatsapp-share-button-analytics.test.tsx`
  continues to pass (component contract unchanged).

No new tests; no new behaviour to cover.

---

## Definition of done

- [x] Three commits per the scope above (one per item) plus this
      brief stub + version bump + trackers/trace.
- [x] All quality gates green.
- [x] PR opened; brief flipped to `status: shipped` with
      `shipped_in: "#<PR>"` after the PR is up.
