---
slug: bu-page-header-system
status: ready
phase: 2
priority: medium
note: 'App-wide chrome refresh. Introduces reusable <PageHeader>, consolidates AppNav identity/refresh/settings into a <UserMenu> avatar, lands directional sticky behavior so chrome cohabits cleanly, AND mounts a per-page help integration (HelpSheet + UserMenu entry, no per-page content) as the scaffold for a follow-up content-authoring BU. Pairs with the BU-user-menu hand-off left in bu-sticky-nav (#106).'
---

# SESSION BRIEF · bu-page-header-system — consistent page chrome across all routes

_Brief version: 0.1 (stub) · Author: Paul + Claude · Date: 2026-05-12_
_Priority: cross-cutting polish — every member-facing page touched._

---

## Why this exists / why now

Grant flagged two things from the field:

1. **Pages lack a clear "what is this surface" header.** Titles exist
   ad-hoc per page but aren't sticky, copy is inconsistent, and on
   `/network` specifically the chrome above the feed is row-heavy —
   2–3 wrapping rows of source chips + sort pills + freshness text +
   refresh button on mobile before any content shows.
2. **AppNav has no identity affordance.** Dev-only `<LoggedInAs />`
   chip, Settings cog, and `<HeaderRefreshButton>` each occupy
   separate slots in the sticky header. Production has no surface for
   the logged-in member's identity at all.

Both are local pain points, but the structural fix is one app-wide
change: a single reusable `<PageHeader>` mounted at the top of every
route, a `<UserMenu>` avatar that consolidates identity + refresh +
settings into AppNav, and a directional-sticky behavior the two
surfaces share so they cohabit cleanly on scroll.

The prior `bu-sticky-nav` (#106) explicitly anticipated this:

> "Pairs with **BU-user-menu** (next), which lands the production
> user-identity affordance in the same header."

Done piecemeal, each page would land its own header shape — done as
one BU, the app gains a consistent feel across `/feed`, `/network`,
`/board`, `/calendar`, `/requests`, `/search`, `/settings`,
`/compose`, `/post/[id]`.

A separate ask from Grant — **per-page instruction overlays /
coachmarks** — is intentionally deferred to its own BU. Chrome must
stabilise first or the overlay anchors keep moving.

---

## Objective

Ship four things, designed independently but rolled out as one PR:

1. **`<PageHeader>`** — one reusable component (title slot, optional
   description slot, optional actions slot). Mounted at the top of
   every member-facing route. Sticky directly under the AppNav.

2. **`<UserMenu>`** — avatar control at the right end of AppNav.
   Popover contains: who's logged in, switch user (dev only), refresh
   data, settings link, **"Help with this page"** (when the route has
   authored help content). Retires the `<LoggedInAs />` strip, the
   standalone `<HeaderRefreshButton>`, and the Settings nav icon —
   three controls collapse into one.

3. **Directional sticky behavior** — AppNav hides on sustained
   scroll-down (>12px threshold to survive iOS rubber-band),
   re-appears on scroll-up. `<PageHeader>` stays pinned at the top of
   the viewport throughout. Both visible at page load.

4. **`<HelpSheet>` scaffold (integration only — no content)** —
   page-aware help drawer (Radix Dialog, side-sheet on desktop /
   bottom-sheet on phone). Triggered exclusively from the UserMenu
   "Help with this page" entry (single anchor — no `?` icon scattered
   in page chrome) and from a `?` keypress on desktop. Mounts in the
   root layout, reads `usePathname()`, looks up help content from
   `shared/help/registry.ts`. Registry ships **empty** in this BU; per-
   page content is the follow-up `bu-page-help-content` BU.

**Success looks like:** open any member-facing route → the page's
identity and one-line description are unambiguous and stay pinned →
scrolling reveals more content as AppNav slides out of the way →
scrolling up brings AppNav back → the avatar in the nav replaces
three separate chrome controls and gives a real surface for future
identity affordances (profile, sign out, theme).

---

## Scope (sketch)

### Components to build

| File | Purpose |
|---|---|
| `components/PageHeader.tsx` | Title (`<h1>`) + optional description (`<p>`) + optional actions slot + optional children sub-row. Sticky styles. Testids: `page-header`, `page-header-title`, `page-header-description`, `page-header-actions`. |
| `components/UserMenu.tsx` | Avatar button + radix `Popover` content. Reuses dev-user-switcher logic absorbed from `<LoggedInAs />`. Testids: `nav-user-menu-trigger`, `nav-user-menu-content`, `nav-user-menu-switch-user`, `nav-user-menu-refresh`, `nav-user-menu-settings`, `nav-user-menu-help`. |
| `components/HeaderShell.tsx` | Sticky wrapper around the header content. Measures rendered height into `--app-nav-height`; transforms out on sustained scroll-down. Testid: `nav-header-shell`. |
| `components/HelpSheet.tsx` | Radix Dialog drawer. Side-sheet on desktop, bottom-sheet on phone. Reads `usePathname()` + `HELP_REGISTRY`. Mounted once in root layout. Testid: `help-sheet`. |
| `shared/hooks/use-scroll-direction.ts` | Sustained-threshold scroll-direction detector. Returns `'up' \| 'down' \| null`. Threshold default 12px; rAF-debounced to survive iOS standalone rubber-band. |
| `shared/help/emitter.ts` | Module-level event emitter. `openHelpSheet()` dispatches; UserMenu entry + `?` keypress fire it; HelpSheet subscribes. No React context plumbing required. |
| `shared/help/registry.ts` | `HELP_REGISTRY: Record<string, HelpEntry>` + a `matchHelpEntry(pathname)` lookup. Ships empty in this BU. Each entry has `title`, `summary`, `actions: string[]`, optional `shortcuts: {key, label}[]`. |

### Per-page rollout matrix

| Route | Title | Description | Actions slot |
|---|---|---|---|
| `/feed` | "Feed" | "Posts from your network" | — |
| `/network` | "Network" | "Live from WhatsApp" | source chip rail + sort + refresh-with-freshness (consolidated into one row, horizontal-scroll) |
| `/board` | "Coordination" | "Live ops, owners, status" | (board-specific filters, TBD) |
| `/calendar` | "Calendar" | "What's happening near you" | view-mode toggle (existing) |
| `/requests` or `/notifications` | "Notifications" or "Requests" (depending on flag) | (contextual one-liner) | — |
| `/search` | "Search" | "Find posts, people, regions" | — |
| `/settings` | "Settings" | — | — |
| `/compose` | "New post" | (kind-specific subtitle) | — |
| `/post/[id]` | post title | author · posted-at | post action row moves here (decision needed — see Q3) |
| `/capabilities` | "Capabilities" | "What this app can do" | — |

Final per-page copy gets a separate copy pass — the table above is the
starting point, not the locked text.

### `/network` chrome consolidation (specific to this BU)

The current 2-row header (chip strip + sort on row 1, h1 + freshness +
refresh on row 2) collapses into the new `<PageHeader>`:

- **Title row** — "Network" + "Live from WhatsApp" + refresh button
  (with freshness folded into its label: "Refresh", "Refreshing…",
  "Refreshed 5s ago"). Honest copy per the project tone guide.
- **Actions row** — single horizontal-scroll chip rail: `[All] [Source A]
  [Source B] … [Sort: Newest ▾]`. Sort sits pinned at the rail's right
  end. No wrapping. Edge-fade gradient hints scrollability.

### Retirements (in the same PR)

- `<LoggedInAs />` strip removed from root layout — logic absorbed into `<UserMenu>`.
- `<HeaderRefreshButton>` removed from root layout — action moved into `<UserMenu>`.
- Settings nav icon removed from `AppNav` — link moved into `<UserMenu>`.
- `<DevBannerToggle />` + `<DevBannerWrapper />` removed from root layout — they only existed to show/hide the `<LoggedInAs />` strip. Component files stay in the codebase until orphans are confirmed.
- Per-page ad-hoc title rendering (e.g. `/network`'s `<h1 className="gps-title">Network</h1>`) replaced by `<PageHeader>` mounts.

### Out of scope

- **Per-page help content authoring** — `HELP_REGISTRY` ships empty.
  `bu-page-help-content` adds the actual summaries / action lists /
  shortcut tables one route at a time, behind the integration this BU
  lands. Pages with no entry never render the menu item.
- **Coachmark sequences** — the spotlight/arrow pattern is explicitly
  rejected (anchor-brittle). HelpSheet covers the same ground at
  far lower maintenance cost.
- New page-level descriptions for routes that don't currently warrant
  one (final copy lives with content owners).
- Theme / avatar-image upload (UserMenu shows initials + role only).
- Mobile bottom-tab variant of AppNav — separate UX question.
- Search trigger relocation — magnifier stays where it is (per
  `bu-search-surface`).

---

## Decisions to lock before build

1. **Directional sticky on `<PageHeader>`?** Brief proposes
   always-pinned (only AppNav hides on scroll). If we want PageHeader
   to slide with AppNav, that's a different feel — more content space,
   less constant orientation. Default: pin PageHeader, hide AppNav.

2. **Active-state + title — redundant?** AppNav's active icon already
   tells you which page you're on. On very narrow screens the title
   row could collapse into an icon-only state. Default: keep both —
   the title doubles as the description anchor and the place to mount
   actions, regardless of nav state.

3. **`/post/[id]` actions slot.** Today the post-actions row sits with
   the card. Move it into the sticky PageHeader actions slot? Pros:
   actions stay reachable as user reads long posts. Cons: shifts
   visual gravity, possible double-affordance with card-level reactions.
   Default: leave the post-action row on the card; PageHeader on
   `/post/[id]` is title + author only.

4. **Avatar fallback.** Initials? Generated mark? Lucide `User` icon?
   Production needs a real strategy; dev-mode can use seeded initials.
   Default: seeded initials in dev; lucide `User` icon as production
   placeholder until a real avatar story lands.

5. **Refresh semantics from UserMenu.** Same as current
   `<HeaderRefreshButton>` (`router.refresh()`) or broader
   (cache-purge + revalidate-all)? Default: keep current behaviour —
   honest, low-blast-radius, matches the button it replaces.

---

## Definition of done (sketch)

- `<PageHeader>` mounted on every route listed in the rollout matrix.
- `<UserMenu>` replaces `<LoggedInAs />`, `<HeaderRefreshButton>`, and
  the Settings nav icon in one PR — no orphaned references.
- AppNav hides on >12px sustained scroll-down, reveals on scroll-up.
  iOS-standalone tested manually for rubber-band false positives.
- `/network` filter chips + sort + refresh land inside the new
  PageHeader — 1 row on mobile (horizontal scroll), no wrap.
- All checks green: `pnpm typecheck && pnpm lint && pnpm test`.
- F14 testids present (`page-header*`, `nav-user-menu-*`).
- Scenario added or updated covering "Sharon sees consistent chrome
  across pages" (next SCN-NN).
- `pnpm trackers` run if any `@spec` annotations change.
- D068: brief flipped to `status: shipped` on PR merge.
- Post-merge note: restart-needed? (likely yes — root layout change);
  smoke-test list covering each of the rolled-out routes.

---

## Depends on

- Nothing blocking. `bu-sticky-nav` (#106) is the foundation this
  builds on; this BU is the explicitly-anticipated follow-up.

---

## Follow-up BUs this unlocks

- **bu-page-help-content** — Grant's second ask, content half.
  Per-page `HELP_REGISTRY` entries: summary, what-you-can-do list,
  shortcut table. One PR per route (or a small batch) so review stays
  scoped. Integration points already mounted by this BU mean those
  PRs touch only `shared/help/registry.ts`.
- **bu-user-profile** — real avatar-image story, profile route,
  sign-out, theme toggle. UserMenu is the natural mount point.

---

## Notes

- **Sharon-warmth:** page descriptions stay plain-English. "Live from
  WhatsApp" not "Network feed source". "Posts from your network" not
  "Member-generated content stream".
- **Permission to close:** directional-hide on AppNav respects this —
  when reading, get out of the way; when navigating, be there.
- **Honest copy:** refresh state reflects what's happening
  ("Refresh", "Refreshing…", "Refreshed 5s ago"), never "Up to date!"
  or similar reassurance theatre.
- **F14 testids:** all new affordances tested by data-testid, not
  text content — copy is expected to iterate.
