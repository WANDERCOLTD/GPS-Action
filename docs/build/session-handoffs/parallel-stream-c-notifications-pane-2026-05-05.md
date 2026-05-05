# Parallel session handoff — Stream C: Surface 3 notifications pane UI

**Date:** 2026-05-05
**For:** A new CC session running in parallel with the main session.
**Reads:** `docs/build/session-briefs/bu-coordination-board.md` (the
parent brief, see "Surfaces → Surface 3 — Notifications pane" +
"Tier-2 defaults #5" + "Companion scenarios → SCN-34").

This handoff scopes the work for one parallel stream. Two other
streams (A: kanban-event-config; B: 5d comment thread) ship
simultaneously and are independent.

---

## Mission

Ship **PR #6** of `bu-coordination-board`'s 8-PR sequence: the
Notifications pane UI under the existing `Inbox` tab in `AppNav`.

Backend is already shipped (`server/services/notifications-kanban.ts`
+ `server/routers/notification-kanban.ts`, PRs #213 + #221).
Subscription auto-rules + fan-out + lifecycle transitions all work.
This stream is pure UI.

## Worktree + branch

```bash
cd /Users/paulwander/projects/gps-action
git fetch origin
git worktree add .claude/worktrees/coord-board-notif-pane -b feat/coord-board-notif-pane-20260506 origin/main
cd .claude/worktrees/coord-board-notif-pane
npm install
git branch --show-current && git rev-parse --show-toplevel
```

## Build list

### Pane route + page

The brief says "reached via the `Notification` tab (the existing
`inbox` glyph in `AppNav`)". Confirm at build time whether the
existing inbox route is `/inbox`, `/notifications`, or unmounted —
grep `AppNav.tsx` for the inbox glyph's `href`.

If a route exists: extend it. If not: add `app/notifications/page.tsx`
(or whichever the AppNav glyph points at).

### Components

- `components/notifications/NotificationRow.tsx` (client):
  - Tinted row background = unacknowledged (use
    `--colour-primary-subtle`); plain `--colour-surface-raised` =
    acknowledged.
  - Layout: actor avatar + initials, body sentence ("Sharon moved
    *Press release* to Preparation"), timestamp on the right.
  - Click → navigate to source ticket → auto-acknowledge (via the
    existing notification-acknowledge mutation).
  - No separate "mark read" gesture; opening = acknowledging.
- `components/notifications/NotificationCapacityCallout.tsx`:
  - Shown when the pane hits the configured cap (e.g. 50 visible
    rows).
  - Copy: "Showing 50 of N. View all → /notifications/history" or
    similar.
  - Link target: a "View all" history page (out of scope for v1; the
    callout can link to a placeholder route that 404s gracefully or
    just hide if you prefer).

### Page composition

- Page is a server component that fetches the viewer's
  notifications via `caller.notification.listMine` (or whatever the
  router exposes — confirm at build time).
- Lists rows newest-first.
- Empty state: "No notifications yet."
- Cap visible at ~50 rows; if more, render `NotificationCapacityCallout`
  at the bottom.

### Per-user preferences (deferred from this stream)

Tier-2 default #5 says "Per-group notification override allowed" and
the brief mentions "per-user preferences (channel + frequency) live
in account settings". **That UI is out of scope for this stream** —
it's a separate atom (PR #6b or similar). This stream ships the
pane only; preferences come later.

### Tests

- Component: row renders both states (acknowledged / not),
  capacity-callout shows when length > cap.
- Integration: open the pane → see seeded notifications → click one
  → verify it acknowledges + navigates.

## Out of scope

- **Per-user preferences UI** (defer)
- **Group-admin team-blast UI** (defer; backend supports it via
  `Notification.reasonKind = 'team_blast'`)
- **History page** (`/notifications/history`) — the callout links
  to it but it can be a stub
- Inline ticket preview on hover

## Pre-merge checklist

- [ ] `npm run typecheck && npm run lint && npm test` clean
- [ ] CSS uses only existing tokens (see `styles/tokens.css`)
- [ ] Inbox glyph in `AppNav` correctly routes to the pane
- [ ] Brief flag `coord_board_v1` stays as-is
- [ ] Version bumped (PATCH minimum)

## Open questions

- **Inbox tab destination:** is there an existing route at the
  inbox glyph, or is it currently unmounted? Decide at build time
  whether to extend or create.
- **Capacity threshold:** brief says "list capped (limit + auto-
  scroll)" without naming the cap. Recommend 50 — surface to Paul
  if 50 feels wrong in the seeded preview.

## What success looks like

A user with seeded subscriptions opens the Inbox tab, sees a list
of notifications about kanban activity (column moves, assignments,
urgent flips), clicks one, lands on the corresponding ticket detail
page, and the row goes from tinted-unread to plain-read state. No
separate gesture required.
