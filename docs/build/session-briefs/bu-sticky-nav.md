---
slug: bu-sticky-nav
status: shipped
shipped_in: "#106"
phase: 2
---
# SESSION BRIEF · BU-sticky-nav — Sticky app header + soft-refresh button

_Brief version: 1.0 · Author: Paul + Claude · Date: 2026-04-27_
_Priority: Demo polish. Single-purpose BU. Pairs with BU-user-menu (next),
which lands the production user-identity affordance in the same header._
_Branch: `feat/bu-sticky-nav`._

---

## Objective

Consolidate the dev `LoggedInAs` strip and per-page `AppNav` strip into a
single sticky `<header>` rendered once in the root layout. Page content
scrolls underneath. Add a small refresh button to the header so users on
iOS Safari home-screen bookmarks (which run in standalone-ish mode with no
URL bar) can refresh the page — calls Next.js' `router.refresh()` so it's a
soft refresh (no full page reload, scroll preserved, server components
re-run).

Success: on `/feed`, `/requests`, `/data`, `/settings`, etc., the header
stays pinned at the top while the body scrolls; the active link highlights
correctly per route; the refresh button re-fetches server-rendered content
on tap; pages no longer import or render `AppNav` themselves.

---

## Scope

### Build in this session

**Layout (the consolidation):**

- `app/layout.tsx` (MODIFY)
  - Resolve nav data once: extend the `createTRPCContext()` call to also
    compute `hasReviewerAccess` (same expression currently used in
    `app/requests/page.tsx:204–210`) and `unreadNotificationCount` (same
    `getUnreadNotificationCount` call currently in
    `app/requests/page.tsx:212–224`, but only for authenticated users).
  - Render a single sticky `<header data-testid="app-header">` containing:
    - `<LoggedInAs user={ctx.user} />` (stays a server component, dev-only
      rendering preserved)
    - `<AppNav hasReviewerAccess={...} unreadNotificationCount={...} />`
      (now without `active` prop — derived client-side from `usePathname`)
    - `<HeaderRefreshButton />` (new — see below)
  - Header CSS: `position: sticky; top: 0; z-index: var(--z-sticky-header)`
    plus a subtle bottom border. Z-index must sit above page content but
    below `<IntentFab />` (FAB is fixed-position, separate stacking).
  - When `ctx.user` is null (unauthenticated viewer), still render the
    sticky header but with only `<LoggedInAs />` inside (no AppNav links,
    no refresh button — those require a session).

**AppNav (becomes client component):**

- `components/AppNav.tsx` (MODIFY)
  - Add `'use client'` directive.
  - Drop the `active` prop. Replace with `usePathname()` from
    `next/navigation`; derive the same five-value union (`'feed' |
    'compose' | 'requests' | 'data' | 'settings' | null`) inside.
  - Keep `hasReviewerAccess` and `unreadNotificationCount` as props.
  - All existing `data-testid` values preserved verbatim
    (`nav-app-strip`, `nav-feed-link`, `nav-requests-link`,
    `nav-requests-unread-dot`, `nav-data-link`, `nav-settings-link`).
  - Keep the visible link set unchanged: Feed | Requests | Data | Settings
    (the existing component already omits Compose; do not add).
  - Visual: drop the strip's own `borderBottom` (the parent `<header>`
    owns the border now) and the `background` (header owns it). Strip
    becomes a transparent flex row inside the header.

**LoggedInAs (no behaviour change, visual integration):**

- `components/auth/LoggedInAs.tsx` (MODIFY)
  - Drop the strip's own `borderBottom` (header owns it).
  - Otherwise unchanged: production no-op via `NODE_ENV` guard, dev-only
    contents identical.
  - Existing testids preserved (`nav-switchuser-link`, `nav-login-link`).

**Header refresh button (new):**

- `components/HeaderRefreshButton.tsx` (new)
  - Client component. Renders a small icon button with `aria-label="Refresh
    page"`, `data-testid="header-refresh-button"`.
  - On click: call `router.refresh()` from `next/navigation`. Show a brief
    spinner state while a `useTransition()` is pending (so the user gets
    visual feedback that something happened — important on iOS standalone
    where there's no native reload chrome).
  - Icon: a circular-arrow / refresh glyph. Use an inline SVG (project
    convention — see `components/IntentFab.tsx` for an example of inline
    SVG in this codebase). No new icon dependency.
  - Sized to match existing nav-link padding so it sits inline.
- `components/HeaderRefreshButton.README.md` (new) — purpose, contract,
  why `router.refresh()` over `window.location.reload()` (soft vs hard).

**Z-index token:**

- `styles/tokens.css` (MODIFY) — add a `--z-sticky-header` token if not
  already present. Pick a value above default content but below modal /
  toast layers. Reuse the existing scale; do not invent a new one.

**Page-level cleanup (remove the per-page AppNav):**

For each of the following pages, remove the `import { AppNav }` line and
the `<AppNav ... />` render. Adjust any wrapping div so the page renders
its content directly. Pages that currently compute `hasReviewerAccess` or
`unreadCount` _solely_ for the `AppNav` prop also drop that local
computation (it now lives in the layout). Pages that use those values for
other purposes (e.g. `app/requests/page.tsx` uses `isReviewer` further
down for queue rendering at line 344) keep the local computation —
duplication is fine; layout still resolves its own copy for the nav.

- `app/feed/page.tsx` (MODIFY)
- `app/settings/page.tsx` (MODIFY)
- `app/requests/page.tsx` (MODIFY — keep local `isReviewer` for line 344
  usage; only the AppNav render is removed)
- `app/requests/[id]/page.tsx` (MODIFY — same — keep local `isReviewer`
  for line 260 usage)
- `app/data/page.tsx` (MODIFY)
- `app/data/[entity]/page.tsx` (MODIFY)
- `app/data/[entity]/new/page.tsx` (MODIFY)
- `app/data/[entity]/[id]/page.tsx` (MODIFY)
- `app/data/[entity]/[id]/edit/page.tsx` (MODIFY)

**Tests:**

- `tests/unit/AppNav.test.tsx` (MODIFY if exists, NEW if not)
  - Verify `usePathname`-driven active highlighting for each route.
  - Verify reviewer / unread-count props still drive the existing visuals.
- `tests/unit/HeaderRefreshButton.test.tsx` (new)
  - Renders an accessible button with the canonical testid.
  - Calling click invokes `router.refresh()` (mock the router).
  - Pending state renders the spinner glyph.
- One integration / smoke test that renders the layout with a mock user
  and asserts the header is present once and the page testid is below it.

**README updates:**

- `components/README.md` (MODIFY) — add `HeaderRefreshButton`; note that
  `AppNav` is now a client component used only by the root layout.
- `app/README.md` (MODIFY if exists, ADD if not) — note that the sticky
  header is owned by `app/layout.tsx`; pages should not render their own
  nav strip.

### Do NOT touch

- Existing route map / link set in `AppNav` — Feed | Requests | Data |
  Settings remain. Adding a Compose link here is BU-FAB-intent-picker
  scope, not this BU.
- `components/IntentFab.tsx` — the FAB stays separate, fixed-position.
- Any router or service code beyond the small lift of nav-data resolution
  into the layout.
- `prisma/schema.prisma` and any migration files.
- `LoggedInAs`'s production no-op behaviour — it stays dev-only.
- The auth flow, sign-out behaviour, or anything user-menu-shaped — that's
  BU-user-menu (next brief).
- Custom pull-to-refresh gestures, PWA manifest, `apple-mobile-web-app-*`
  meta tags — explicitly out of scope; the in-header refresh button is the
  whole answer.

### Out of scope for this session

- BU-user-menu (avatar dropdown with Settings + Sign out via cookie-clear
  — separate brief, lands second so it slots into this header).
- A PWA manifest or any iOS web-app meta tags. We're not opting into
  standalone mode; we're just ensuring the header works well even when
  iOS treats a home-screen bookmark as standalone-ish.
- Custom pull-to-refresh on `/feed`. The header button is sufficient; if
  user testing later disagrees, it's a follow-up.
- A "scrolled" elevation style on the header (subtle shadow when content
  has scrolled under it). Nice-to-have; not required for this BU.
- Refactoring `AppNav` to surface a Compose link. Out of scope; existing
  link set preserved verbatim.

---

## Contracts

### Inputs consumed

- `createTRPCContext()` from `server/routers/context.ts` — already used
  by `app/layout.tsx`. Layout will additionally read `activeRoles` and
  `activeScopes` from it, same fields already consumed by
  `app/requests/page.tsx`.
- `getUnreadNotificationCount` (or whatever helper currently sits behind
  the `unreadCount` resolution in `app/requests/page.tsx:212–224`).
  Confirm its location during build; if it requires a service-layer
  import that violates the layout's allowed-imports list, surface as an
  open question rather than reaching across the boundary.
- `usePathname` from `next/navigation` (client side).
- `useRouter().refresh()` from `next/navigation` (client side).

### Outputs produced

- A single sticky `<header data-testid="app-header">` rendered by
  `app/layout.tsx`. Other components can rely on the testid for
  layout-level assertions.
- `<HeaderRefreshButton>` — `data-testid="header-refresh-button"`,
  `aria-label="Refresh page"`. Stable contract for tests and a11y tools.
- `--z-sticky-header` design token. Anyone adding new sticky / fixed
  surfaces should layer relative to this.

---

## Acceptance criteria

- [ ] On `/feed`, `/requests`, `/data`, `/settings`, scrolling the page
      keeps the header pinned to the top of the viewport.
- [ ] Page content scrolls _under_ the header (no double-scroll, no
      content peeking through above it).
- [ ] The active route is correctly highlighted on every page (driven by
      `usePathname`, not per-page prop).
- [ ] Reviewer-access label (`(reviewer)` suffix on Requests link) renders
      whenever the logged-in user has reviewer scope, on every page —
      not just `/requests`.
- [ ] Unread-notification dot on the Requests link renders whenever the
      count > 0, on every page — not just `/requests`.
- [ ] Tapping the header refresh button calls `router.refresh()` and the
      page re-renders without a full reload (scroll position retained).
- [ ] Refresh button shows a brief pending state while the transition is
      in flight.
- [ ] Header refresh button works when the page is launched as an
      iOS Safari home-screen bookmark (manual test required).
- [ ] No page in `app/**/page.tsx` imports or renders `AppNav` directly.
- [ ] `LoggedInAs` continues to be dev-only (production renders nothing).
- [ ] All existing testids preserved verbatim. New testids
      (`app-header`, `header-refresh-button`) added.
- [ ] No layout shift on page navigation; header height stable.
- [ ] `npm run typecheck` clean; `npm run lint` clean; `npm test` passes.
- [ ] Manual click-through: load `/feed`, scroll, header stays pinned;
      tap a nav link, active state updates; tap refresh, content
      re-fetches; on iPhone standalone bookmark, refresh works.

---

## UI states

| State | Trigger | What user sees | What user can do |
|---|---|---|---|
| Header — anonymous | No `ctx.user` | Sticky strip with only the `LoggedInAs` "Not logged in — pick a user" link (dev) or empty (prod) | Click to log in (dev); otherwise nothing |
| Header — logged in | `ctx.user` present | `LoggedInAs` strip (dev only) + nav links + refresh button | Navigate, refresh, switch user (dev) |
| Active link | Current pathname matches a link's route | That link has the existing `activeStyle` (sunken background, semibold) | — |
| Refresh — idle | Default | Refresh icon visible, button enabled | Tap to refresh |
| Refresh — pending | After tap, transition in flight | Icon swapped for a spinner glyph, button disabled | Wait |
| Refresh — done | Transition resolved | Icon returns; new server-rendered content visible | — |
| Reviewer suffix | `hasReviewerAccess === true` | Requests link reads "Requests (reviewer)" | — |
| Unread dot | `unreadNotificationCount > 0` | Red pill with count next to Requests link | — |

---

## Tests required

- Unit: `<AppNav>` driven by `usePathname` — each route highlights
  correctly; reviewer suffix and unread dot render per props.
- Unit: `<HeaderRefreshButton>` — invokes `router.refresh()` on click;
  pending state renders.
- Integration / smoke: layout renders the header once; pages render
  underneath; testids resolve.

Not required:

- Visual regression tests for the sticky positioning.
- E2E across real iOS Safari standalone (manual click-through is enough
  for this BU; future BU could add a Playwright iOS profile).

---

## Scenarios to verify against

`docs/product/scenarios.md`:

- Scenario 1 (Sky News bias post) — load `/feed`, scroll a long feed,
  confirm header stays pinned; tap refresh; verify the post list
  re-renders without scroll loss.
- Any reviewer scenario (e.g. queue-management flows) — verify the
  reviewer suffix and unread dot render on pages other than `/requests`
  (since they're now globally surfaced via the layout).

iOS standalone manual test:

- Add `/feed` to iPhone home screen, launch from the icon, verify the
  header is visible, the refresh button works, scroll behaviour is
  correct (header pinned, content scrolls underneath).

---

## Known gotchas

- **Layout import boundaries.** `app/layout.tsx` is in `/app` which can
  import from `/components`, `/shared`, `/server/routers` (types only),
  and `/styles`. Resolving `unreadCount` in the layout may require a
  helper currently exposed as a server-action or service call; if its
  current location forces a boundary violation, lift the helper to an
  acceptable surface (e.g. a tRPC procedure called from the layout via
  `createCaller`) rather than bypassing ESLint. Surface the choice as an
  open question if it's not obvious.
- **Server vs client split.** `LoggedInAs` is a server component;
  `AppNav` becomes a client component; `HeaderRefreshButton` is a client
  component. They can sit side-by-side inside a server-rendered
  `<header>`; React Server Components composes this fine. Don't make the
  whole header a client component — that'd force the dev-only check to
  shift to the client.
- **`router.refresh()` semantics.** It re-runs server components for the
  current route segment, refreshes data fetched in those components, and
  preserves client component state and scroll position. It does _not_
  reload the page. This is the desired behaviour for the demo audience —
  they get fresh data, not a flash.
- **iOS standalone caveat.** `router.refresh()` works in standalone-mode
  iOS Safari just as it does in the regular browser — it's a Next.js
  client-side mechanism, not a browser-chrome thing. Verify in manual
  test.
- **Testid stability.** Existing tests rely on `nav-app-strip`,
  `nav-feed-link`, etc. Do not rename. The new `app-header` testid wraps
  the nav strip; the nav strip's own testid remains.
- **Z-index against `<IntentFab>`.** The FAB is `position: fixed`. The
  sticky header is `position: sticky`. They occupy different stacking
  contexts but if a user scrolls so the FAB visually overlaps the
  header, the FAB should remain on top (it's an action affordance). The
  `--z-sticky-header` token should be lower than whatever the FAB uses.

---

## Definition of done

- [ ] All files in "Build" list created or modified; nothing in
      "Don't touch" list touched.
- [ ] TypeScript compiles with zero errors, zero `any`,
      zero `@ts-ignore`.
- [ ] All acceptance criteria verified.
- [ ] `npm run test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes (no boundary-plugin violations introduced).
- [ ] Manual click-through completed (desktop + mobile-emulated; iPhone
      standalone bookmark optional but recommended for the demo).
- [ ] README files updated where touched.
- [ ] No TODOs left in committed code.
- [ ] Commit messages follow convention (`feat:` / `refactor:` / etc.).
- [ ] `package.json` `version` PATCH-bumped (CI gate).
- [ ] PR description summarises changes, links this brief and (if
      created) the relevant decision-log entry.

---

## Open questions to surface

These are judgement calls that should land with the user before / during
build, not be made silently:

- **Refresh button position.** Right of the nav links (likely), or left
  of `LoggedInAs`, or absolute top-right of the header? Default
  proposal: right-aligned inside the AppNav row, after the last link, so
  it sits with the other "navigation actions" group.
- **Decision-log entry?** A new D-entry capturing "sticky header in root
  layout + soft refresh button as the iOS-standalone-safe primitive"
  feels worth recording. Is the decision-log the right home, or is this
  too small? Default proposal: append `D065 · Sticky app header + soft
  refresh button (BU-sticky-nav)` with a one-paragraph rationale.
- **`unreadCount` resolution location.** If lifting it into the layout
  forces an awkward import path, fall back to: keep `AppNav` accepting
  the prop, but make `unreadNotificationCount` optional and default to
  `0`; pages that need to surface it (i.e. `/requests`) keep their local
  fetch and pass it down via a context the layout can read. Surface the
  trade-off if encountered.
- **Compose link in nav.** Currently absent; the FAB is the entry point.
  Should this BU add it for desktop-only (where there's no FAB) or
  defer? Default: defer — out of scope for sticky-nav.

(Claude Code, at session end, list what you encountered that needed a
judgement call.)

---

## Context

- Codebase notes: `CLAUDE.md` (root) — read sections on layer boundaries,
  session hygiene, and the BU naming convention (D051).
- Design tokens: `styles/tokens.css` — z-index scale, spacing, colours
  for the header background and border.
- Existing components: `components/AppNav.tsx`,
  `components/auth/LoggedInAs.tsx`, `components/IntentFab.tsx`.
- Decision log: `docs/architecture/decision-log.md` — D054, D061
  (current AppNav scope), D051 (BU naming).
- Pairs with: BU-user-menu (next brief, lands the avatar / sign-out
  affordance into this same header).

---

## Trace tags

```
@bu BU-sticky-nav
@adr D065 (proposed)
@parents D054 D061
@pairs BU-user-menu
```
