# Navigation system — design plan

_Doc version: 0.1 · Author: Paul (via Claude) · Date: 2026-04-29_

This is the design plan for navigation primitives — every "Back to X",
"Open →", "Read post →", breadcrumb, edge-swipe-back gesture, and any
other affordance whose job is "move the member from page A to page
B." It records what to build, when to build it, and which industry
patterns it copies. The first piece — `<ArrowLink>` — shipped in
`bu-feed-card-affordances` (#147). The rest are catalogued here so
when a future BU needs to ship a navigation primitive, the principle
is already settled.

This is research / planning, not a session brief. Promote individual
items to a brief when they're about to ship.

---

## Principles

1. **Every navigable destination has a real `<Link>` underneath.** No
   `<article onClick>` or `<div role="link">` shortcuts. iOS Safari
   fires native anchor taps reliably; synthesised click handlers on
   non-anchor elements are the source of the "tap doesn't fire" bug
   class (`bu-feed-card-affordances` exists because of it).
2. **Affordances must be visible.** A tap target that's invisible
   isn't an affordance, it's a guess. Every navigable card has at
   least one labelled link the eye can find.
3. **Multiple aligned affordances beat a single hero.** A feed card
   is the canonical case: title link + thumbnail link + "Read post →"
   all do the same thing. Wherever the finger lands, it works.
4. **Direction-of-travel is signalled by the arrow glyph.** `←` for
   "back to a parent surface", `→` for "forward to a deeper detail
   or external destination". Never both on the same affordance.
5. **Hover should reward the cursor.** Underline on hover, arrow
   shifts 2px in its direction, focus ring on Tab. Static-coloured
   text without hover treatment looks unfinished — Stripe / Vercel /
   Linear all do this; we should match.
6. **Reduced motion respected.** Every transition gated by
   `@media (prefers-reduced-motion: reduce)`. Honest UX includes
   honest motion.
7. **Standalone PWA constraints are real.** iPhone home-screen
   bookmarks lose the URL bar AND the back-swipe gesture (D065).
   Every navigation primitive that the platform would normally
   provide needs an in-app fallback for standalone mode.
8. **Permission to close.** We don't trap members in deep navigation
   trees. Every page has a one-tap path back to the canonical list
   surface (feed, requests, drafts, etc.).

---

## Inventory of navigation primitives

| Primitive | Status | Industry reference | When |
|---|---|---|---|
| `<ArrowLink>` (back / forward inline link) | **Shipped** in #147 | Stripe docs, Vercel, Linear | Now |
| Visible affordances on tappable cards (title link + thumb link + "Read post →") | **Shipped** in #147 | Twitter, Reddit, Bluesky | Now |
| Breadcrumbs (multi-level "X > Y > Z" trail) | Not built; not yet needed | GitHub, Linear, Notion | When admin / data pages get >2 levels deep |
| Edge-swipe-back gesture (iPhone PWA standalone) | Not built; planned | TikTok PWA, native iOS | `BU-edge-swipe-back` (next nav BU) |
| Keyboard `Esc` to back | Not built | macOS apps, some web apps | Mid-priority polish |
| Focus management on route change (autofocus on `<h1>` after nav) | Not built | a11y best practice | When ratchet hits a11y |
| Scroll restoration on back-nav | Next.js default behaviour | All major frameworks | Already partially correct |
| App-wide bottom-tab nav (`AppNav`) | **Shipped** | Twitter / Threads / Bluesky | Now |
| Sticky top-nav (`AppNav` upper) | **Shipped** | All major mobile web apps | Now |
| Header refresh button (iOS PWA fallback) | **Shipped** | None — bespoke per D065 | Now |
| Tab persistence (e.g. feed filter survives back-nav) | Partially built (URL-driven) | Reddit | Iterate as needed |
| Forward-nav prefetch | Next.js default for `<Link>` | All major frameworks | Already correct |

The five **not built** items — breadcrumbs, edge-swipe, Esc-to-back,
autofocus, scroll polish — are the runway for follow-up nav BUs.

---

## Detailed spec — by primitive

### 1. `<ArrowLink>` (shipped in #147)

The visible inline link with directional arrow. Used everywhere a
member is invited to navigate to a peer or parent surface.

**Component contract:**

```tsx
<ArrowLink
  href="/feed"
  direction="back"   // 'back' | 'forward' | 'none'
  size="sm"          // 'sm' | 'md'
  testIdArea="post"  // canonical area prefix for the testid
  testIdSuffix="back"
>
  Back to feed
</ArrowLink>
```

**Visual contract:**

- Default: `var(--colour-text-link)` colour, no underline
- Hover: underline (1px, 3px offset), colour shifts 80% toward
  `--colour-text-primary`, arrow translates 2px in its direction
- Focus: `outline: 2px solid var(--colour-text-link)`, no underline
- Reduced-motion: arrow stays put

**Copy rules:**

- "Back to {parent}" — never "Go back" or "Return"
- "Open" / "Read post" / "View profile" — verb-first, never "Click here"
- One arrow per link, never both directions
- Arrow direction must match the conceptual direction of travel —
  `←` for parents (up the tree), `→` for children or external

**Testid rule:**

`{area}-arrow-link[-{suffix}]` — area is one of the canonical area
prefixes per F14 (feed, post, requests, data, compose, admin,
settings).

### 2. Visible card affordances (shipped in #147)

Every tappable card in a feed has multiple aligned affordances:

| Affordance | Visual treatment | Tap action |
|---|---|---|
| Card title | Real `<Link>`, inherits text colour | Navigate to detail |
| Card thumbnail (when present) | Wrapped in same `<Link>` | Navigate to detail |
| "Read post →" | `<ArrowLink direction="forward">` bottom-right of body | Navigate to detail |
| Reactions / share buttons | `<button>` with `e.stopPropagation()` | Action, never navigate |

**Rule:** the tap-anywhere-on-the-card `onClick` is *not allowed* on
any new card type. Every navigation must originate from a real anchor.

### 3. Breadcrumbs (planned)

When admin / data pages exceed 2 levels of nesting, breadcrumbs
become valuable. Today's deepest path is `/data/{entity}/{id}/edit`
which is 3 levels — already at the threshold. The current
"Back to detail" link works but doesn't show context.

**Industry reference:** GitHub repo browser
(`org / repo / path / file`), Linear (`Project · Issue`), Notion
(`Workspace › Page › Subpage`).

**Build sketch (when needed):**

```tsx
<Breadcrumbs>
  <BreadcrumbItem href="/data">Data</BreadcrumbItem>
  <BreadcrumbItem href="/data/post">Posts</BreadcrumbItem>
  <BreadcrumbItem href="/data/post/abc-123">Post abc-123</BreadcrumbItem>
  <BreadcrumbCurrent>Edit</BreadcrumbCurrent>
</Breadcrumbs>
```

**Trigger to build:** the first time an admin opens a 4-level-deep
URL and asks "where am I?" — or a future BU surface adds a third
nesting level (e.g. `/data/group/{id}/members/{userId}`).

### 4. Edge-swipe-back gesture (planned — `BU-edge-swipe-back`)

The iOS-PWA-standalone gap. iPhone home-screen bookmarks lose
Apple's native back-swipe. ~24px-from-left-edge horizontal swipe
fires `router.back()`.

**Build sketch:**

- New client component `<EdgeSwipeBack />` mounted in `app/layout.tsx`
- Listens to `touchstart` globally, only activates for touches
  starting within ~24px of the left screen edge (avoids hijacking
  horizontal scroll containers — the feed-filter chip strip is
  outside that zone)
- Tracks `touchmove` horizontal delta
- On `touchend`, if delta > 80px AND gesture was clearly horizontal
  (not diagonal), calls `router.back()`
- Visible 100ms hint as the user starts swiping (a soft "← back"
  pill that fades in) — the difference between a hidden gesture and
  a discoverable one
- Falls back to `router.push('/feed')` if `window.history.length === 1`
  (deep-linked entry)
- Honours `prefers-reduced-motion` — the hint snaps in instantly
  rather than fading

**Industry reference:** TikTok PWA does its own gesture system.
Most major PWAs (Twitter / Bluesky / Threads / Reddit) skip this.
The skew-iPhone-PWA-heavy nature of GPS Action makes it more
valuable here than for a general-purpose web app.

**Caveat documented:** Won't peel like the native iOS gesture.
That's a tradeoff we accept; the alternative is shipping nothing,
which is worse.

**Tests:** unit tests with synthesised touch events for the threshold
logic; manual smoke on iPhone for the visual feel.

**Trigger to build:** any time. Independent of the publish-router
stack.

### 5. Keyboard `Esc` to back (planned — small)

A `useEffect` hook (`useEscapeBack()`) that listens for Esc on the
document and calls `router.back()`. Mounted once in `app/layout.tsx`.
Skips when an input or textarea has focus (don't hijack form-cancel).

**Industry reference:** macOS apps, some web apps (GitHub modal
dismiss).

**Trigger to build:** bundle with `BU-edge-swipe-back` — same theme
("provide nav fallbacks for surfaces that don't have them by
default"), tiny addition.

### 6. Focus management on route change (planned — a11y polish)

When `router.push()` lands on a new page, screen readers shouldn't
be left hanging on the old page's focus point. After route change,
move keyboard focus to the page's `<h1>` (or the first heading) and
announce it.

**Build sketch:** a `<RouteFocusReset />` hook that listens for
pathname changes and, after the next paint, focuses
`document.querySelector('main h1')` if it exists.

**Industry reference:** Stripe docs, GOV.UK.

**Trigger to build:** when the project's next a11y ratchet pass runs.

### 7. Scroll restoration (mostly correct already)

Next.js App Router restores scroll on back-nav by default. There
are two known gaps:

- After publishing a post via `<PostPublishModal>`, the redirect to
  `/feed` should land at the top (not at whatever scroll position
  the form had). Already correct because `revalidatePath('/feed')`
  forces a fresh load.
- Filter changes on `/feed` (chip taps) reset scroll. Already
  correct because each filter is its own URL.

**No build needed.** Verify by manual smoke on iPhone after each
new feed-affecting BU lands.

### 8. Cross-cutting: the "where do I sit on the navigation tree?"
   problem

Every page has an implicit position in the tree:

```
feed (root)
├── post/{id}
├── compose
│   └── /share (inbound)
├── requests
│   └── requests/{id}
├── data
│   ├── data/{entity}
│   │   ├── data/{entity}/new
│   │   └── data/{entity}/{id}
│   │       └── data/{entity}/{id}/edit
├── settings
└── dev/login
```

The tree informs:

- **Where does "Back to X" land?** Always one level up the tree.
- **What does the page H1 say?** The page's role in the tree.
- **What's the App Bar look like?** Ideally tells the member where
  they are without reading the URL.

We don't need to formalise this as a routing config (Next.js handles
the routing). But every new page brief should answer: "what's my
parent? what's my children? what's my back-link?"

---

## Sequence of follow-up BUs

The next nav-themed BUs in priority order:

| BU | Trigger | Effort |
|---|---|---|
| `BU-edge-swipe-back` (with `Esc` to back bundled) | Any time | Small (~half day) |
| `BU-route-focus-reset` (a11y polish) | Next a11y pass | Tiny (~2h) |
| `BU-breadcrumbs` | First 4-level-deep page | Medium (~1 day) |
| `BU-route-loading-states` (skeleton on slow nav) | If Vercel Analytics shows nav-pause complaints | Medium |

None block each other. Most can ship in parallel with feature work.

---

## What this doc is NOT

- A routing-config spec (Next.js handles routes)
- A URL-pattern guide (URLs follow Next.js conventions)
- A list of every existing route (the routing tree above is for
  navigation-affordance planning, not the canonical route list)

This is a **navigation-affordance** plan: how members move between
surfaces, what the affordances look like, and what gestures /
keyboard / focus / motion patterns we ship to support that.

---

## Related

- `D065` — sticky nav + iOS PWA standalone refresh button
- `BU-feed-card-affordances` (#147) — the first nav-affordance BU
  shipping `<ArrowLink>` and the visible-card-affordances pattern
- `docs/product/design-philosophy.md` — the priority-ordered design
  principles (Sharon-warmth, no-anxiety, permission-to-close)
- `docs/process/testid-convention.md` — F14 testid rule
- `styles/components.css` — `.gps-arrow-link` styles
- `components/HeaderRefreshButton.README.md` — the iOS-PWA-refresh
  primitive that pairs with edge-swipe-back
