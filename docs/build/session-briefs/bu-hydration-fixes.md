---
slug: bu-hydration-fixes
status: shipped
shipped_in: "#PR_PLACEHOLDER"
phase: 2
priority: high
note: "Two SSR/CSR mismatches surfaced on phone (mba.local) — share-button href and relative timestamps. One BU, two component fixes."
---
# SESSION BRIEF · BU-hydration-fixes — kill SSR/CSR mismatches in PostCard + share button

_Brief version: 0.1 · stub · Author: Paul (via Claude) · Date: 2026-04-27_

Two distinct hydration mismatches were surfaced testing the dev server
from a phone over mDNS (`http://mba.local:3001`). Both are deterministic
SSR/CSR mismatches, not cache lag, and both will reproduce in any
context where the server-rendered string differs from the first
client-rendered string. This BU fixes both with a single architectural
pattern: **defer values that depend on either the browsing context or
"now" until after mount**, render a stable SSR-safe placeholder, swap to
the live value in `useEffect`.

The share-button `href` mismatch was the one breaking the feed in the
overlay screenshot. The relative-timestamp mismatch is also live but
quieter (only triggers across a "X-ago" bucket boundary, often
non-deterministic).

---

## Why this exists / why now

- **Production risk:** if `NEXT_PUBLIC_SITE_ORIGIN` isn't set on the
  Vercel deploy, every share button on every member's page will throw a
  hydration error in production. Even with the env var set, the
  pattern (server falls back to a constant) is brittle.
- **Dev friction:** dev access from a phone via mDNS hits this every
  time. Members increasingly expect to test on real devices; the dev
  setup must accommodate.
- **One pattern, two payoffs:** a small `<ClientOnly>` / deferred-render
  primitive solves both. Small, contained, doesn't touch business logic.

---

## Objective

Eliminate the two hydration mismatches without losing the user-facing
behaviour. After this BU:

- `<WhatsAppShareButton>` renders a stable `href` server-side that does
  not depend on the request host, then swaps to the full origin-aware
  `wa.me/?text=…` URL after mount.
- Relative timestamps ("2m ago") render as a stable absolute time
  server-side and on first client paint, then swap to the relative
  string after mount.
- Console shows zero hydration warnings on the feed, post detail,
  request rows, request detail, and comment threads.

Success looks like: load `http://mba.local:3001/feed` from the phone in
dev mode → no overlay, no console hydration warnings → tapping the
WhatsApp button still shares the correct URL → the timestamp on each
card still says "2m ago" / "yesterday" / etc.

---

## Scope

### Build in this session

**Shared primitive (new):**

- `components/ClientOnly.tsx` (new — small `useEffect`-gated wrapper.
  Renders `fallback` (a prop) on the server and on first client paint;
  renders `children` after mount. Pattern matches a number of well-known
  Next.js community implementations — keep it ~20 lines, no
  dependencies.)
- `components/RelativeTime.tsx` (new — wraps `ClientOnly`. Renders a
  stable `<time dateTime={iso}>{absoluteFallback}</time>` server-side
  and switches to `formatDistanceToNow(date, { addSuffix: true })`
  after mount. The `<time>` element gets the ISO timestamp on the
  `dateTime` attribute regardless of branch, so accessibility is
  preserved.)

**Share button (modify):**

- `components/WhatsAppShareButton.tsx` (MODIFY — defer the `href`
  computation to after mount. Server-rendered `<a>` either omits the
  `href` and adds an `aria-disabled` until mount, or renders a stable
  origin-free fallback (e.g. `https://wa.me/?text=…` without the post
  URL component, then enriches client-side). Pick whichever yields the
  cleaner accessibility story — the implementer should justify the
  choice in the PR. Click handler from BU-whatsapp-share continues to
  fire `pingShareIntent()` analytics correctly.)

**Replace timestamp call sites:**

- `components/PostCard.tsx` (MODIFY line ~226 — replace inline
  `formatDistanceToNow` with `<RelativeTime date={post.createdAt} />`)
- `components/CommentItem.tsx` (MODIFY line ~55 — same replacement)
- `components/RequestRow.tsx` (MODIFY line ~162 — same replacement)
- `components/RequestDetailPanel.tsx` (MODIFY line ~121 — same
  replacement)
- `app/post/[id]/page.tsx` (MODIFY line ~94 — same replacement)
- `app/requests/[id]/page.tsx` (MODIFY line ~211 — same replacement)

**Tests:**

- `tests/unit/relative-time.test.tsx` (new — renders fallback on
  server-style render; renders relative string after mount; preserves
  ISO `dateTime` attribute throughout.)
- `tests/unit/client-only.test.tsx` (new — fallback on first render;
  children after `act()`-flushed effects.)
- `tests/unit/whatsapp-share-button-hydration.test.tsx` (new — server
  render output is origin-independent; client render after mount uses
  full origin; analytics ping still fires.)

**Docs:**

- `docs/architecture/decision-log.md` (APPEND — D070 records: (a) the
  hydration-safe deferred-render pattern, (b) why it's preferred over
  `suppressHydrationWarning`, (c) the two specific bugs this fixes,
  (d) prod-config implication: `NEXT_PUBLIC_SITE_ORIGIN` is now
  belt-and-braces — the architectural fix doesn't depend on it being
  set, but production should still set it for correctness on the
  first paint.)
- `package.json` (PATCH bump — bug fix.)
- README updates in `components/` for the two new primitives.

### Do NOT touch

- `shared/site-origin.ts` — the function stays. The mismatch is in how
  `<WhatsAppShareButton>` consumes it, not in the function itself. If
  the implementer believes the function should change too, surface
  that — don't expand scope.
- `prisma/schema.prisma` — no schema change.
- The `wa.me` URL builder in `shared/share/whatsapp-url.ts` — its
  contract stays. Only the timing of when it's called changes.
- All other `Date` / `formatDistanceToNow` usages outside the listed
  files (e.g. server-only logging, audit timestamps) — those don't
  hydrate, no fix needed.

### Out of scope (separate BUs)

- BU-tick-or-cross's planned send-on-publish flow (the
  `<SendToNetworkConfirm>` modal will reuse the deferred-render pattern
  but isn't built here).
- WhatsApp Channel Business API integration (D016, Phase 2).
- Production env var setting on Vercel — that's a Vercel-dashboard
  task, not a code change. Verify in the Vercel session that the env
  var is set even though it's now belt-and-braces.

---

## Contracts

### Inputs consumed

- `<WhatsAppShareButton>` props (unchanged from BU-whatsapp-share)
- `formatDistanceToNow` from `date-fns` (unchanged)
- `getSiteOrigin()` from `shared/site-origin.ts` (unchanged)
- `Post`, `Comment`, `Request` row types (unchanged)

### Outputs produced

- `<ClientOnly fallback={…}>{…}</ClientOnly>` — generic deferred-render
  primitive. Stable contract; future hydration fixes use this.
- `<RelativeTime date={Date} />` — relative-time primitive. Stable
  contract; new code rendering "X ago" should use this, not inline
  `formatDistanceToNow`.

---

## Acceptance criteria

- [ ] Loading `/feed` on `http://mba.local:3001` from a phone in dev
      mode shows no hydration overlay and no console warnings
- [ ] Same for `/post/[id]`, `/requests/[id]`, and request rows
- [ ] WhatsApp share button still produces a correct, fully-qualified
      `wa.me/?text=…` URL when tapped (verify with browser devtools or
      manual click-through)
- [ ] Relative timestamps still display the relative form ("2 minutes
      ago") in the eventual rendered output, with the ISO date as the
      `<time dateTime>` attribute throughout
- [ ] `pingShareIntent()` still fires on share-button tap (no
      regression in BU-whatsapp-share analytics)
- [ ] All call sites listed in scope are migrated; no inline
      `formatDistanceToNow` remains in components that hydrate
- [ ] `npm run typecheck && npm run lint && npm test &&
      npm run trace:check` all green
- [ ] Lighthouse / browser-extension hydration audit (manual) passes
      on the feed
- [ ] D070 appended to decision log
- [ ] `package.json` PATCH bumped per `docs/process/versioning.md`

---

## Tests required

- Unit: `<ClientOnly>` fallback/swap behaviour; `<RelativeTime>`
  fallback/swap; `<WhatsAppShareButton>` server render is
  origin-independent and client render is correct
- Integration: feed page renders without hydration warnings (jsdom
  approximation — use React Testing Library's `act()` to ensure no
  warnings logged during render)

Not required:

- E2E with real device (manual verification on phone is the
  acceptance criterion)

---

## Scenarios to verify against

- **SCN-01** (Sharon boosts a Sky News bias post) — share button must
  still produce a correct URL and the analytics ping must still fire
- **SCN-19** (Sharon shares a Guardian article) — same
- Any scenario that displays a relative timestamp (essentially all
  feed and detail scenarios) — timestamps still render correctly

---

## Known gotchas

- **Don't reach for `suppressHydrationWarning` as the fix.** It
  silences the symptom but the underlying mismatch remains; the user
  still sees a flicker on first paint. Use deferred render.
- **`<time>` element accessibility.** The ISO date should be on the
  `dateTime` attribute on every render path (server, fallback, post-
  mount) so screen readers and indexers always have a stable handle.
- **Date-fns is already a dependency** (used at the existing call
  sites). No new install.
- **Production env var stays.** `NEXT_PUBLIC_SITE_ORIGIN` should still
  be set on Vercel. The architectural fix means a misconfig there is
  no longer fatal (no hydration error), but the first-paint URL would
  still be wrong without it. Belt and braces.
- **iOS standalone (memory `project_ios_standalone_constraint`)** —
  the deferred-render pattern works there; `useEffect` fires after
  hydration regardless of standalone vs browser context.

---

## Definition of done

- [ ] D070 appended to decision log
- [ ] All files in "Build" list created or modified per scope
- [ ] All files in "Don't touch" list untouched
- [ ] No `suppressHydrationWarning` introduced; the fix is structural
- [ ] `npm run typecheck && npm run lint && npm test &&
      npm run trace:check` all green
- [ ] `package.json` PATCH bumped
- [ ] Manual click-through on phone via mDNS: feed, post detail,
      request row, request detail, comments — zero hydration warnings
- [ ] PR description summarises both bugs, links this brief + D070

---

## Pre-brief decisions (locked)

1. **One BU, two fixes.** They share an architectural pattern
   (deferred render via `useEffect`); shipping them together produces
   a single coherent "kill hydration mismatches in feed components" PR.
2. **`<ClientOnly>` is the primitive.** Not `dynamic({ ssr: false })`
   — that's heavier (creates a chunk), wrong tool for these tiny
   inline cases.
3. **Don't drop relative time in favour of absolute.** Relative is the
   member-facing affordance; the bug is timing of computation, not
   the format itself.
4. **Don't change `getSiteOrigin()` semantics.** The function still
   returns origin via the documented order; the fix is at the consumer
   site (the share button), where the origin actually gets baked into
   rendered HTML.

## Open questions (surface if encountered)

- **Should `<WhatsAppShareButton>` render a disabled-looking shell on
  the server (no `href`, `aria-disabled="true"`, lower opacity) and
  enable on mount?** Or render a "neutral" full URL like
  `https://wa.me/?text=…` minus the post URL fragment, then enrich
  on mount? The first is more honest, the second flickers less.
  Implementer's call — justify in the PR.
- **Other components that might be hydration-mismatch-prone but
  haven't surfaced yet** — any audit findings beyond the 6 timestamp
  sites should be flagged but not fixed in this BU (separate scope).

---

## Related

- BU-whatsapp-share / PR #111 / PR #114 — the share machinery this BU
  hardens (no contract change to those PRs)
- D070 (new) — this BU's ADR
- D067 — BU-whatsapp-share's ADR (this BU does not touch its
  divergences)
- Memory: `project_ios_standalone_constraint` — phone-as-dev-target
  context for why this surfaced
- BU-tick-or-cross — will reuse `<ClientOnly>` in its
  `<SendToNetworkConfirm>` modal (clipboard + channel-open flow needs
  the same client-only treatment)
- Vercel deploy env vars — verify `NEXT_PUBLIC_SITE_ORIGIN` is set
  in the parallel Vercel session (defence in depth, but no longer the
  sole defence after this BU lands)
