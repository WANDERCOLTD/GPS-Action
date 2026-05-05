# `components/notifications` — Notifications pane primitives

**Build Unit:** bu-coordination-board (build seq #6 — Surface 3)
**Used by:** `app/notifications/page.tsx`.

## What lives here

| File                              | Responsibility                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `NotificationRow.tsx`             | Client component. One row in the pane. Handles tint, sentence, click → ack + navigate.              |
| `NotificationCapacityCallout.tsx` | Server component. "Showing N most recent · View all →". Renders when the pane hits its display cap. |

## Visual states

`NotificationRow` reads `notification.lifecycle`:

- `new` → `--colour-primary-subtle` background (tinted; unacknowledged).
- `acknowledged` → `--colour-surface-raised` (plain; already opened).
- `dismissed` → not surfaced; the inbox query excludes them.

The component is render-only for the dismissed branch — the page
filters with `scope: 'active'`, so a dismissed row never reaches it.

## Sentence composition

The row sentence is `<actor> <verb> "<title>"`, where:

- **actor** comes from `fromDisplayName` (falls back to "Someone").
- **verb** is mapped from `reasonKind` (kanban-era) with a fallback to
  the legacy `type` enum so pre-kanban rows still render coherently.
- **title** comes from the joined `Request.title`. Omitted from the
  sentence when the row has no request context (e.g. team blasts).

Verb mapping:

| reasonKind      | verb                          |
| --------------- | ----------------------------- |
| `comment`       | commented on                  |
| `mention`       | mentioned you on              |
| `assignment`    | was assigned to               |
| `status_change` | moved                         |
| `urgent_flip`   | flagged as urgent             |
| `team_blast`    | sent a team-wide notice about |

## Capacity callout

Triggered by the page when `inbox.length >= PANE_LIMIT` (50). The
component itself is dumb — it accepts `shown: number` and links to
`/notifications/history` (a stub route in this PR; ships later).
