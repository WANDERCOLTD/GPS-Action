# `app/notifications` — Surface 3 (Notifications pane)

**Build Unit:** bu-coordination-board (build seq #6 — Surface 3)
**Status:** ships behind the `coord_board_v1` feature flag.
**Companion scenario:** SCN-34 — Maya gets a notification about a stuck card.

## What lives here

| File         | Responsibility                                                                             |
| ------------ | ------------------------------------------------------------------------------------------ |
| `page.tsx`   | Server route. Auth-redirects, gates on `coord_board_v1`, calls `notificationKanban.inbox`. |
| `actions.ts` | Server action `acknowledgeNotificationAction` — wraps `notificationKanban.acknowledge`.    |

The list rows themselves live in `components/notifications/`. The page
fetches kanban-era notifications (lifecycle = new + acknowledged), maps
each row to `NotificationRowData`, and hands them to
`NotificationRow`. Capacity callout renders when the inbox hits the
50-row cap.

## Visibility + flag rules

- Unauthenticated → `/dev/login?returnTo=/notifications`.
- `coord_board_v1` OFF → `/notifications` redirects to `/feed`. Members
  on the legacy `/requests` workspace never see this surface.
- The inbox glyph in `AppNav` routes here only when `coord_board_v1` is
  on (see `components/AppNav.tsx`).

## Click-through model

Each row is a `<Link>` to the source ticket
(`/board/[groupSlug]/[ticketId]`, resolved server-side via the
request's first non-deleted `RequestGroup`). Clicking fires
`acknowledgeNotificationAction` fire-and-forget; on return, the row
repaints from tinted (`primary-subtle`) to plain
(`surface-raised`). No separate "mark read" gesture.

When a notification has no resolvable ticket (no `requestId`, or the
request has no attached group), the row falls back to `/notifications`
and the click is a no-op.

## Out of scope (this PR)

- `/notifications/history` — the "View all" link target. The capacity
  callout points at it but the route ships in a follow-up.
- Per-user notification preferences (channel + frequency) — these live
  under account settings; PR #6b.
- Group-admin team-blast composition UI — backend supports
  `Notification.reasonKind = 'team_blast'`; the UI is parked.
