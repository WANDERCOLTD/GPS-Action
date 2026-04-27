# HeaderRefreshButton

In-header soft-refresh button rendered inside the sticky `<header>` in
`app/layout.tsx`.

## Why

iOS Safari home-screen bookmarks launch the site in a standalone-ish
mode with no URL bar — so users have no native reload control. This
button is the primitive that fills the gap. The codebase has no PWA
manifest opt-in; this is iOS default behaviour, confirmed in user
testing on 2026-04-27 (D065).

## Contract

- Renders an icon button with `aria-label="Refresh page"` and
  `data-testid="header-refresh-button"`.
- On click: calls `router.refresh()` from `next/navigation` inside a
  `startTransition(...)`. Server components for the current route
  re-run; data dependencies refresh; scroll position and client
  component state are preserved. No full page reload.
- While the transition is pending, the button shows a spinner glyph
  and is `disabled`.
- No props. The button is self-contained — owner of its own router
  instance and pending state.

## Why `router.refresh()` over `window.location.reload()`

| | `router.refresh()` | `window.location.reload()` |
|---|---|---|
| Scroll preserved | yes | no |
| Client state preserved | yes | no |
| Visual flash | none | yes |
| Re-runs server components | yes | yes (full page) |
| Network cost | only changed segments | full page |

Soft refresh is strictly better for the demo audience.

## Testid

`header-refresh-button`. Stable contract for tests and a11y tools.

## Layer

Client component (`'use client'`). Lives in `/components`, may import
from `/components`, `/shared`, `/styles` only — same boundary rules as
everything else in this directory.
