# SESSION BRIEF · BU-whatsapp-share — One-tap WhatsApp forward from every PostCard

_Brief version: 1.0 · Author: Paul (via Claude) · Date: 2026-04-27_

Demo-scoped slice of the broader **BU-share-out** (see
`docs/product/share-out-mechanics.md`) — the deliberate divergence
from that spec is recorded in **D065**. Ships the single
highest-leverage share-out path — WhatsApp — as a PostCard affordance,
not as the post-publish modal the full spec describes. X, Facebook,
Routes, DispatchEvent persistence, and the return-confirmation prompt
are deferred to BU-share-out proper.

---

## Why this exists / why now

The "WhatsApp-replacement loop" is the product. Every post on the feed
is a candidate for forwarding into a real WhatsApp group — that is how
the network currently coordinates, and how a member proves to a
coordinator that GPS Action is worth using over the existing thread.
Today the feed has zero outbound affordance. The demo is currently
"look at this nice post" instead of "watch me forward it to my group
in one tap."

Sharon's natural reflex on seeing a useful post is "I'll send this to
North London." A WhatsApp icon bottom-right of every PostCard converts
that reflex into one motion.

---

## Objective

Add a single WhatsApp affordance to every PostCard that, on tap, opens
WhatsApp (or WhatsApp Web on desktop) with a pre-filled message
containing the post title + the deep link back to the GPS Action post.
Member then picks the recipient inside WhatsApp and sends.

Success looks like: log in as Eddie → see the feed → tap the WhatsApp
icon on any post → WhatsApp opens with a sensible message body and the
post URL → Eddie picks a contact → sends → swipes back to GPS Action.
Works on iOS Safari, iOS home-screen-installed PWA, Android Chrome, and
desktop browsers.

---

## Scope

### Build in this session

**Component (new):**

- `components/WhatsAppShareButton.tsx` (new — small primitive: takes
  `postId`, `postTitle`, `postBody`, renders an `<a>` with
  `href={whatsAppShareUrl(...)}` and `target="_blank" rel="noopener
  noreferrer"`. Uses the **official full-colour WhatsApp brand glyph**
  (the green-bubble logomark; do not recolour — WhatsApp brand
  guidelines forbid). Sized via design tokens. No state beyond an
  analytics ping on click.)

**URL helper (new):**

- `shared/share/whatsapp-url.ts` (new — pure function
  `whatsAppShareUrl({ postId, postTitle, postBody, originUrl })` →
  returns `https://wa.me/?text=<encoded>`. Composes message as
  `<title>\n\n<body>\n\n<post URL>` so WhatsApp's link preview latches
  on the trailing URL. Body is included in full but the **complete
  encoded text param is hard-capped at 1500 characters** (well under
  WhatsApp's practical limit) — if the cap is hit, body is truncated
  with `…` and the URL is always preserved as the final line. Tests
  cover encoding edge cases (apostrophes, emoji, line breaks,
  non-ASCII) and the truncation rule.)

**Card integration:**

- `components/PostCard.tsx` (MODIFY — introduce a new dedicated
  **action row** at the bottom of the card, after the link/AM preview
  cards. Layout: comment-count on the left, `<WhatsAppShareButton>` on
  the right, `justify-content: space-between`. The existing comment-
  count `<div>` moves into this row (was previously a stacked element
  above the AM card). The reaction pill stays where it is today —
  above the action row, between body and footer — so it does not
  compete for the action-row slot. Tap precedence per D061: the WA
  button's own click handler `stopPropagation()`s; the card root
  body-tap does not fire. F14 testid required. Empty-state: if no
  comments and no WA share is renderable, do not render the action
  row at all — but in practice WA share is always available on a
  published post, so the row is effectively always present.)

**Analytics ping — plug into existing event:**

`docs/product/analytics-events.md` already specifies `post_shared_out`
with `destination: enum (whatsapp, x, email, copy_link, other)` and
properties `post_type`, `post_id_hash`. This BU fires that event with
`destination: 'whatsapp'`.

The catalogue lists the event as fired from `app/components/ShareMenu.tsx`
(future component); this BU fires it from `<WhatsAppShareButton>`
instead. Update the catalogue's "Fired from" line to read:
`components/WhatsAppShareButton.tsx (BU-whatsapp-share) →
app/components/ShareMenu.tsx (BU-share-out, future)`.

- `app/api/analytics/share-intent/route.ts` (new — accepts POST with
  `{ postId: string, destination: 'whatsapp' }` and emits the
  `post_shared_out` event. If no analytics sink is wired yet — check
  `server/lib/` for an `analytics.ts` or similar before building a new
  one — the endpoint logs to stdout with prefix
  `[ANALYTICS] post_shared_out` and that is the MVP. The endpoint is
  shaped so BU-share-out can extend `destination` to `'x' | 'email' |
  'copy_link' | 'other'` without changing the contract.)
- `docs/product/analytics-events.md` (MODIFY — update the
  `post_shared_out` "Fired from" line per above)

**Origin URL helper:**

- `shared/site-origin.ts` (new OR extend if it exists — returns the
  canonical origin for share links. Reads `NEXT_PUBLIC_SITE_ORIGIN`
  env var; falls back to `window.location.origin` client-side. Tests
  cover both branches.)

**Tests:**

- `tests/unit/whatsapp-url.test.ts` (new — 6–8 cases: basic URL
  encoding, apostrophe in title, emoji in title, multi-line body
  excerpt, body excerpt truncation cap, post URL appears as last line,
  https-only origin enforced)
- `tests/unit/whatsapp-share-button.test.tsx` (new — 4 cases: renders
  `<a>` with correct `wa.me` href, opens in new tab with secure rel,
  fires analytics ping on click, does not bubble click to parent)

**README updates:**

- `components/README.md` (MODIFY — add WhatsAppShareButton entry)
- `shared/README.md` (MODIFY — add `share/` and `site-origin.ts`
  entries)

### Do NOT touch

- `prisma/schema.prisma` (this BU adds no schema. DispatchEvent /
  Routes are explicitly out of scope; they belong to BU-share-out
  proper, behind an ADR.)
- `server/services/post.ts` (no service-layer changes needed; the
  share is client-side URL construction)
- Other share/preview surfaces:
  - `components/LinkPreviewCard.tsx` — different concern (inbound)
  - `app/compose/page.tsx` — composer is not part of this BU
- Any reactions / reaction-pill code (BU-reactions has its own brief
  and shares the bottom-right corner — see open question below)

### Out of scope for this session (BU-share-out picks these up)

- The pre-publish "Want to share it onward?" share menu modal
  (share-out-mechanics.md §"The flow")
- **Routes** (saved WhatsApp groups) — needs a `Route` table, ERD
  Slice 3, and a separate ADR
- **DispatchEvent persistence** — needs schema work, dispatch_initiated
  → dispatch_confirmed → abandoned state machine
- **Return-confirmation prompt** ("Did you send to North London?
  [Yes] [Not yet] [Skip]") — depends on DispatchEvent
- **X / Facebook / copy-link** — separate channels, BU-share-out scope
- **UTM tagging** on outbound URLs (parking-lot PARKED · UTM tagging)
- **Group picker UI** — not buildable, WhatsApp's API does not let us
  enumerate groups
- **Body excerpt design** — for now use first 140 chars of post body or
  none; richer message templating waits for share-out-mechanics.md to
  land properly

---

## Contracts

### Inputs consumed

- `Post` shape (from `shared/types/post.ts` or wherever the existing
  PostCard reads from): needs `id`, `title`, `body`
- `NEXT_PUBLIC_SITE_ORIGIN` env var (added to `.env.example` if missing;
  defaults to `http://localhost:3000` in dev)

### Outputs produced

- `<WhatsAppShareButton postId postTitle bodyExcerpt? />` component —
  reusable on the post detail page in a future iteration if wanted
- `whatsAppShareUrl(...)` pure function — usable from server too if
  ever needed
- `POST /api/analytics/share-intent` — the analytics endpoint shape:
  `{ postId: string, channel: 'whatsapp' }` → `{ ok: true }`. This
  contract is what BU-share-out (and BU-reactions, eventually) will
  extend with `'x' | 'facebook' | 'copy-link'`.

---

## Acceptance criteria

- [ ] Every published PostCard in the feed renders a WhatsApp icon in
      the bottom-right corner of the card footer
- [ ] Tap on icon opens WhatsApp with pre-filled text:
      `<post title>\n\n<post body>\n\n<post URL>`, hard-capped at
      1500 chars total (body truncated with `…` if needed; URL always
      preserved as the final line)
- [ ] Post URL is the canonical `<origin>/post/<id>` form
- [ ] Works on iOS Safari (mobile web)
- [ ] Works on iOS home-screen-installed PWA — verified manually
      against the iOS-standalone constraint (no native share-sheet API
      needed; `wa.me` is a universal link the OS routes to WhatsApp)
- [ ] Works on Android Chrome
- [ ] Works on desktop (opens WhatsApp Web in a new tab)
- [ ] If WhatsApp is not installed on mobile, the universal link
      gracefully falls through to WhatsApp Web in the browser (this is
      `wa.me`'s native behaviour — verify, don't reimplement)
- [ ] Tap on icon does NOT trigger the card's own body-tap behaviour
      (D061 tap precedence)
- [ ] `post_shared_out` event fires once per click with
      `destination: 'whatsapp'`
- [ ] Icon is the official full-colour WhatsApp brand glyph (green
      bubble), sized via design tokens. Brand-asset constraint
      respected — glyph is not recoloured. Visual weight is acceptable
      because the icon size is small enough that the brand colour
      reads as a recognisable cue, not a screaming call-to-action
- [ ] testid present per F14: `data-testid="post-share-whatsapp"` with
      `data-post-id={id}`
- [ ] Keyboard-accessible (Tab to focus, Enter activates the link)
- [ ] `npm run typecheck && npm run lint && npm test` green

---

## UI states

| State | Trigger | What user sees | What user can do |
|---|---|---|---|
| Default | Card rendered | WA icon bottom-right of card footer | Tap / Enter |
| Hover (desktop) | Pointer over icon | Cursor pointer, subtle hover background | Click |
| Focused (keyboard) | Tab to icon | Visible focus ring on the icon | Enter to activate |
| Activated | Click / Enter | New tab opens to `wa.me?text=…`, OS routes to WhatsApp | Pick contact in WhatsApp |
| Returning to GPS Action | User comes back via swipe / Cmd-Tab | Same feed, same scroll position | Continue browsing |

There is **no in-app loading or in-flight state** — the click is a
plain link navigation. This is intentional; the full BU-share-out
flow with the "Did you send?" prompt requires DispatchEvent and is
deferred.

---

## Tap-precedence (per D061)

The PostCard already follows D061 implicitly. The new icon is one
more interactive child. Rules:

- The icon is a real `<a href>`, not a JS-only handler
- The icon's `onClick` calls `event.stopPropagation()` so the
  PostCard's body-tap does not fire
- The icon's tap target is ≥ 44×44px per F14 / WCAG
- No nested interactive elements inside the icon

---

## Layout — non-clashing with reactions

The card stack from top to bottom is:

```
┌─────────────────────────────────────────┐
│ KindChip                                │
│ Hero image (if present)                 │
│ Title                                   │
│ Body                                    │
│ ReactionPill (if reactions enabled)     │ ← stays where it is today
│ AM preview card (if AM URL)             │
│ Link preview card (if linkUrl)          │
├─────────────────────────────────────────┤
│ ACTION ROW (new)                        │
│   💬 3 comments        [WA glyph]       │ ← comment-count L, WA icon R
└─────────────────────────────────────────┘
```

The **action row** is the new horizontal flex row at the bottom of
the card; comment-count moves into it from its previous standalone
position. WA share owns the right end. Reactions never enter the
action row — they remain inline above (where the existing
`<ReactionPill>` already renders today). Two affordances, two layout
zones, no contention.

The reactions brief currently flags pill placement as an open
question ("between body and footer, OR inside the footer flexbox").
This BU's action-row resolves that ambiguity for it: pill stays above
the footer (between body and footer), action row is reserved for
comment-count + WA share. Flag in the BU-reactions handoff.

---

## Tests required

- Unit: `whatsAppShareUrl` covers encoding edge cases, truncation,
  trailing-newline-then-URL ordering
- Unit: `<WhatsAppShareButton>` renders correct href, secure rel,
  analytics fires, click does not bubble
- Manual: iOS Safari, iOS standalone PWA, Android Chrome, desktop
  browser — verified by Paul before sign-off

Not required:

- E2E with real WhatsApp delivery (manual)
- Server-side share construction (client-only is fine for this slice)

---

## Scenarios to verify against

`docs/product/scenarios.md`:

- **SCN-01** (Sharon sees a Sky News bias post and boosts it) — the
  primary motion this BU enables
- **SCN-19** (Sharon shares a Guardian article) — a post created via
  BU-link-share is now WhatsApp-forwardable in one tap

The demo path: log in as Eddie → see Sharon's seeded Guardian post →
tap WhatsApp icon → WhatsApp opens with title + post URL → close →
back to feed.

---

## Known gotchas

- `wa.me` is the universal link form (works everywhere); the older
  `whatsapp://send?text=` scheme is iOS/Android only and fails on
  desktop. Use `wa.me`.
- iOS Safari opens `wa.me` links in the same tab by default; the
  `target="_blank"` is for desktop where users want to keep the feed
  tab open.
- WhatsApp's text param has practical length limits (~2000 chars
  reliably). Truncate body excerpts hard at 140 chars and let the post
  URL pull users to the full body.
- URL encoding: line breaks become `%0A`, spaces `%20`. Use
  `encodeURIComponent`, not hand-rolled escaping.
- Brand-asset note: WhatsApp's brand guidelines forbid recolouring
  their official logo. A monochrome **glyph** (a generic
  speech-bubble-with-tail) sidesteps this — it reads as "WhatsApp" in
  context without being the trademarked green logo. Use that.
- iOS standalone PWA: the in-app refresh constraint (memory:
  iPhone home-screen bookmarks have no URL bar) does NOT apply here —
  this is an outbound link, not an in-app refresh. The OS handles the
  hand-off to WhatsApp natively.
- Analytics endpoint: if a real analytics surface lands later
  (BU-analytics), this endpoint becomes a thin pass-through. Don't
  over-build for the demo.

---

## Definition of done

- [ ] All files in "Build" list created; all files in "Don't touch"
      list untouched
- [ ] TypeScript compiles with zero errors, zero `any`, zero
      `@ts-ignore`
- [ ] All acceptance criteria verified with test or manual click-through
- [ ] `npm run typecheck && npm run lint && npm test` green
- [ ] Manual click-through on iOS Safari, iOS standalone PWA, Android
      Chrome, desktop browser — recorded in PR description
- [ ] README files updated (components/, shared/)
- [ ] No TODOs left in committed code
- [ ] Commit messages follow convention (feat: / fix: / etc.)
- [ ] PR description summarises changes, links this brief, links
      `share-out-mechanics.md` and notes deliberate divergences
- [ ] `package.json` PATCH version bumped per versioning.md
- [ ] One handoff line added to BU-reactions brief noting the bottom-
      right corner is taken by WA share

---

## Decisions resolved before build (was: open questions)

All six pre-build open questions resolved by Paul on 2026-04-27:

1. **BU name:** `BU-whatsapp-share` (kept).
2. **Layout:** new bottom-of-card action row — comment-count left, WA
   icon right; reaction pill stays above. See "Layout" section.
3. **Message body:** include everything — `title \n\n body \n\n URL`,
   capped at 1500 chars total, body truncated with `…` if needed,
   URL always preserved as final line.
4. **Icon style:** full-colour official WhatsApp brand glyph (the
   green bubble). Brand-asset constraint respected — do not recolour.
5. **Analytics:** plug into existing `post_shared_out` event with
   `destination: 'whatsapp'`. Catalogue's "Fired from" line gets
   updated. Stub to stdout if no analytics sink exists yet.
6. **ADR:** D065 covers the demo-only divergences from
   share-out-mechanics.md — reconciliation belongs to the future
   BU-share-out build.

Genuine open questions remaining for the build session to surface
(none expected to block; if any do, STOP and ask):

- Whether an existing analytics sink (`server/lib/analytics.ts` or
  similar) can be reused, or this BU is the first to need one
- Whether the official WhatsApp glyph asset is already in
  `public/` / `components/icons/` from prior work, or needs sourcing
  per WhatsApp brand guidelines
- Whether `NEXT_PUBLIC_SITE_ORIGIN` is already set in `.env.example`
  or needs adding

---

## Context — read these before starting

- `docs/product/share-out-mechanics.md` — the full BU-share-out spec
  this slice intentionally narrows
- `docs/product/parking-lot.md` — sections "1-click social sharing —
  CRITICAL FEATURE" (CLAUDE.md callout) and PARKED · UTM tagging,
  PARKED · LinkedIn / Telegram / WhatsApp Channels
- `docs/architecture/decision-log.md` — D061 (tap precedence), D013
  (self-dispatch default), D018 (inbound sharing endpoint — symmetry)
- `docs/product/design-philosophy.md` — principles 1 (one-click is
  king) and 3 (no anxiety amplification)
- `docs/product/scenarios.md` — SCN-01, SCN-19
- `components/PostCard.tsx` — current footer-row layout
- `styles/tokens.css` — colour, spacing, focus-ring tokens to use
- Memory: `project_ios_standalone_constraint.md` (does not apply here
  but worth understanding the broader iOS PWA story)

---

## Related

- `docs/product/share-out-mechanics.md` — parent spec
- BU-reactions (brief exists) — bottom-right corner contention
- BU-link-share (shipped) — produces the link-share posts that this
  BU's WhatsApp affordance forwards
- D013 — self-dispatch default
- D061 — global tap interaction pattern
- Future: BU-share-out (full menu, Routes, DispatchEvent, X/FB)
- Future: B12 (parking-lot UTM tagging) — extends this BU's URL
  construction
