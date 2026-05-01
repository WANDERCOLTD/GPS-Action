# `app/calendar` — Calendar tab

**Build Units:** BU-calendar-view (D073), BU-month-nav, BU-calendar-near-me (D076)
**Status:** ships behind the `calendar_enabled` feature flag.

## What lives here

| File                 | Responsibility                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `page.tsx`           | Server route. Reads `?view`, calls `post.listUpcoming`, gates on the flag.                                        |
| `view.ts`            | URL-contract helper — `?view=agenda\|month\|near` + `?sort=distance\|date` for the near view.                     |
| `CalendarToggle.tsx` | Segmented Agenda / Month / Near-me control. Icon chips (List · CalendarDays · MapPin); aria-label keeps wording.  |
| `AgendaView.tsx`     | Day-grouped flat list (Today · Tomorrow · weekday-date). Plus "Earlier today" mini-header. Empty + footer states. |
| `MonthView.tsx`      | Month grid + below-grid day panel. Wraps `MonthGrid` with selection state.                                        |
| `MonthGrid.tsx`      | Pure presentational 7×N grid. Day cells with dot overlays; today ringed.                                          |
| `NearMeView.tsx`     | Distance-sorted list of in-person events. Browser geolocation OR postcodes.io postcode lookup.                    |
| `CalendarRow.tsx`    | Compact, date-prominent post row. Used by Agenda, the month panel, and Near-me.                                   |

## URL contract

- `/calendar` → agenda (default)
- `/calendar?view=agenda` → agenda (explicit)
- `/calendar?view=month` → month grid + day panel
- `/calendar?view=month&month=YYYY-MM` → month grid pinned to that month
- `/calendar?view=near` → in-person events sorted by distance
- `/calendar?view=near&sort=date` → near-me, but sorted by event start instead

Unknown / missing `view` falls back to `agenda`. Back-button preserves
state because each chip is a plain `<Link>`.

### Near-me (BU-calendar-near-me / D076)

The third tab shows in-person event-bearing posts ordered by Haversine
distance from the caller's location. The user supplies their location
either via `navigator.geolocation` ("Use my location" button) or by
typing a UK postcode (resolved via `postcodes.io` in `shared/geo.ts`).
Online events (`Post.isOnline = true`) and posts with NULL coordinates
are excluded server-side. Sort defaults to `distance`; `?sort=date`
flips it to event-start ascending.

Today, coordinates on event posts are hand-coded in the seed (Path A —
see ADR-0002). The composer-side geocoding pipeline (Path B) is parked
for a follow-up BU.

### Month anchor (BU-month-nav)

When `?view=month` is active and no `?month=YYYY-MM` is supplied, the
page picks the anchor month with this fallback chain:

1. **Next upcoming event.** Probe `listUpcoming({ from: today, limit: 1 })`
   and anchor on the month containing the result's `eventAt`.
2. **Current month.** When the probe is empty, anchor on the current
   Europe/London month.

Invalid `?month=` values (e.g. `2026-13`, `xyz`, `06-2026`) fall through
to the same fallback chain. The accepted shape is strictly `YYYY-MM`
with `MM` in `01..12`.

### Prev/next month chevrons (BU-month-nav)

`MonthView` renders `ChevronLeft` / `ChevronRight` `<Link>` buttons
flanking the month-label heading. Each updates the URL to
`?view=month&month=<adjacent-month>`, so back-button + share-this-URL
both work. Testids: `calendar-month-prev-link`,
`calendar-month-next-link`. Aria-labels: `Previous month`, `Next
month`. There is no past or future cap — the agenda enforces "today
onwards", but the month grid is freely navigable in both directions.

## Visibility + flag rules

- Anonymous viewers see public events only.
- Authenticated viewers see public + members-only.
- `calendar_enabled` OFF →
  - `app/layout.tsx` hides the Calendar tab in `AppNav`.
  - `/calendar` redirects to `/feed`.

## Timezone discipline

All grouping + formatting routes through `shared/format-event-time.ts`
(`EVENT_TIMEZONE = 'Europe/London'`). Day keys are
`formatInTimeZone(at, 'yyyy-MM-dd')`. Never use raw `new Date()` for
day boundaries — DST corrupts UTC arithmetic on clock-change weekends.

## Refresh affordance (iOS PWA)

Reuses the global `HeaderRefreshButton` mounted in `app/layout.tsx`.
No calendar-specific refresh control was added.

## Out of scope (parking-lot for follow-up BUs)

- Year-jump / month picker dropdown.
- Keyboard shortcuts for prev/next.
- Week view / hour grid.
- Recurring events, all-day flag, iCal export, reminders.
- Inline editing from the calendar surface — `/post/[id]/edit` is the path.
