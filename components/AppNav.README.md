# AppNav

Top-level horizontal navigation strip rendered once by the root layout
inside the sticky `<header>`. Active link is derived from `usePathname()`
rather than a per-page `active` prop (D065).

## Build units

- **BU-requests-foundation** — original strip + Requests tab.
- **BU-sticky-nav** — consolidated into the sticky header.
- **BU-icon-nav** (2026-04-30) — text labels replaced with lucide
  icons. Each tab keeps the prior text label as `aria-label` so
  screen readers continue to announce it.

## Tabs (icons-only)

| Tab      | Icon (lucide) | `aria-label` | testid              |
| -------- | ------------- | ------------ | ------------------- |
| Feed     | `Home`        | `Feed`       | `nav-feed-link`     |
| Requests | `Inbox`       | `Requests`   | `nav-requests-link` |
| Data     | `BarChart3`   | `Data`       | `nav-data-link`     |
| Settings | `Settings`    | `Settings`   | `nav-settings-link` |

Calendar tab (lucide `CalendarClock`) lands via `bu-calendar-view` —
follow the same idiom as the four tabs above.

## Behaviour

- Active state: existing background highlight (`var(--colour-surface-sunken)`
  - `fontWeight: 600`). No text-colour change required since there is no text.
- Touch target: every tab is at least 44×44 px (WCAG 2.5.5).
- Icon size: 22 px, stroke-width 2 (lucide default).
- Requests unread badge: a positioned `<span>` overlapping the icon's
  top-right corner. Renders only when `unreadNotificationCount > 0`.
  Capped at `99+`. testid `nav-requests-unread-dot` preserved.

## Open follow-ups (deferred from BU-icon-nav)

- **Discoverability.** Icons-only may confuse less tech-fluent
  members. Decision was to ship anyway; revisit if feedback warrants.
  Mitigation candidates: long-press tooltip, brief onboarding hint.
- **Notification badges on other tabs.** Future BUs that introduce
  notifications elsewhere should follow the Requests-tab pattern
  (positioned `<span>` over the icon).
