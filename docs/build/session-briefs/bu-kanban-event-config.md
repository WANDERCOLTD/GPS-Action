---
slug: bu-kanban-event-config
status: shipped
shipped_in: '#243'
phase: 2
priority: high
note: 'Unblocks bu-coordination-board atom 5d-3 (system-event hook in the comment/note thread). Per Paul 2026-05-05: admin-controlled on/off per event kind, no backfill, future-only.'
---

# SESSION BRIEF · bu-kanban-event-config — admin toggle table for kanban system events

_Brief version: 1.0 · Author: Paul (via Claude) · Date: 2026-05-05_

## Why this exists

The kanban thread on a ticket (Surface 2 of `bu-coordination-board`)
will interleave human comments + internal notes + **system events**
(`Comment.kind='comment'`, `Comment.source='system'`) like "Sharon
moved this to Preparation" or "Maya marked it Urgent". The brief
called out a few obvious triggers (column moves, urgent flips) but
left the exhaustive set undecided.

Paul's call (2026-05-05): defer the noise-vs-signal judgement to
admins. Each potential trigger has a global on/off toggle. New rows
appear or stop appearing as the toggle flips — no backfill, no
rewrite of historical threads.

Without this BU, atom **5d-3** (the system-event hook in the kanban
thread) is blocked. 5d-1, 5d-2, 5d-4, 5d-5 can ship in parallel.

## Decisions locked

1. **Global, not per-group** for v1. One row per event kind. Adding a
   `groupId` later is a strictly-additive migration if pilots want
   per-team variation.
2. **Admin surface** — extend `/admin/feature-flags`. These toggles
   sit alongside feature flags conceptually (operational on/off,
   admin-curated). Add a new section "Kanban event broadcasts" on the
   same page rather than a sibling route.
3. **No backfill.** Toggling on means *future* events of that kind
   write a system-Comment row. Existing threads stay as they were.
   Toggling off means new events stop writing. Historical rows aren't
   pruned.

## Sensible defaults (table seed)

| Event kind | Default | Rationale |
|---|---|---|
| `column_move` | ON | Brief explicit; high-signal coordination event |
| `status_change` | ON | Brief implied (parallel to column_move) |
| `urgent_on` | ON | Brief explicit; brief safety signal |
| `urgent_off` | OFF | Symmetry isn't worth the noise; admins can flip |
| `assign_self` | OFF | Subscribers get notified separately; thread breadcrumb is noise |
| `unassign_self` | OFF | Same as above |
| `title_edit` | OFF | Audit log already records; thread duplication is noise |
| `body_edit` | OFF | Same as above |
| `share_to_team` | ON | High-signal cross-team coordination event |

## Scope

### Schema (one entity, one migration)

```
KanbanEventConfig
  id          : String (cuid)
  eventKind   : KanbanEventKind  @unique
  enabled     : Boolean          @default(false)
  updatedAt   : DateTime         @updatedAt
  updatedById : String

KanbanEventKind : enum
  column_move | status_change | urgent_on | urgent_off |
  assign_self | unassign_self | title_edit | body_edit | share_to_team
```

Reference-data migration (per D070): seed all 9 rows with the
defaults above. Idempotent (`ON CONFLICT (eventKind) DO NOTHING`).

### ADR

**ADR-0014 — kanban event broadcast toggles.** Documents:
- Why admin-controlled rather than code-fixed (team-culture variance)
- Why global rather than per-group for v1
- The "no backfill" semantic and what it implies (toggling does NOT
  rewrite history)
- The 9 event kinds and their defaults

### Service

`server/services/kanban-event-config.ts`:

- `isEventEnabled(eventKind: KanbanEventKind): Promise<boolean>` —
  cache-friendly read (called from hot paths in atom 5d-3)
- `setEventEnabled(eventKind, enabled, actorId): Promise<void>` —
  updates the flag, audit-logs the change
- `listAllConfigs(): Promise<KanbanEventConfig[]>` — for the admin UI

### Router

`server/routers/kanban-event-config.ts`:

- `list()` — for the admin section render
- `setEnabled({ eventKind, enabled })` — admin-only mutation

### Admin UI

Extend `app/admin/feature-flags/page.tsx` with a new section:

> ## Kanban event broadcasts
> Each toggle controls whether a kanban ticket event writes a system
> message into the ticket's comment thread. Changes apply to *future*
> events only — historical threads are not rewritten.
>
> [table: event kind | description | toggle]

New component: `components/admin/KanbanEventConfigSection.tsx`.

### Tests

- Service: idempotent toggle, cache invalidation on update, audit row
  written
- Router: admin-only access; non-admin returns FORBIDDEN
- Component: renders all 9 events; toggle calls the mutation
- Integration: e2e flip + verify isEventEnabled reflects change

### Out of scope

- Per-group config (additive future migration)
- Per-event throttling / debouncing (e.g. coalesce 5 column moves in
  a minute) — defer to a follow-on if pilot feedback demands
- Editing the *content* of system messages (currently service-fixed
  template)
- Migrating existing audit-log entries into the thread (the "no
  backfill" semantic is intentional)

## Definition of done

- [ ] `KanbanEventConfig` table migrated; 9 rows seeded with defaults
- [ ] ADR-0014 merged
- [ ] Admin section renders all 9 events with current state
- [ ] Toggle works end-to-end; audit row written
- [ ] `isEventEnabled` exported and ready for atom 5d-3 to call
- [ ] `npm run typecheck && npm run lint && npm test` clean
- [ ] Brief flipped to `status: shipped` per D068 on PR merge
- [ ] Version bumped (PATCH minimum)

## Companion brief

`bu-coordination-board.md` atom 5d-3 reads `isEventEnabled` before
writing each system row. Don't ship 5d-3 until this BU is on `main`.

## Open questions to surface

None at brief-lock. Defaults are confident enough to ship; pilot
feedback adjusts the seed values, not the structure.
