# `app/calendar` — Calendar tab

**Build Unit:** BU-calendar-view (D073)
**Status:** ships behind the `calendar_enabled` feature flag.

## What lives here

| File                 | Responsibility                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `page.tsx`           | Server route. Reads `?view`, calls `post.listUpcoming`, gates on the flag.                                        |
| `view.ts`            | URL-contract helper — parse / canonicalise the `?view=agenda\|month` literal.                                     |
| `CalendarToggle.tsx` | Segmented Agenda / Month control. Pure server-rendered `<Link>` chips.                                            |
| `AgendaView.tsx`     | Day-grouped flat list (Today · Tomorrow · weekday-date). Plus "Earlier today" mini-header. Empty + footer states. |
| `MonthView.tsx`      | Month grid + below-grid day panel. Wraps `MonthGrid` with selection state.                                        |
| `MonthGrid.tsx`      | Pure presentational 7×N grid. Day cells with dot overlays; today ringed.                                          |
| `CalendarRow.tsx`    | Compact, date-prominent post row. Used by both Agenda and the month panel.                                        |

## URL contract

- `/calendar` → agenda (default)
- `/calendar?view=agenda` → agenda (explicit)
- `/calendar?view=month` → month grid + day panel

Unknown / missing `view` falls back to `agenda`. Back-button preserves
state because each chip is a plain `<Link>`.

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

- Prev/next month navigation (chevrons + first-day-of-month default selection per brief Q3).
- Week view / hour grid.
- Recurring events, all-day flag, iCal export, reminders.
- Inline editing from the calendar surface — `/post/[id]/edit` is the path.
