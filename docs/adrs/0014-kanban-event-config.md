# ADR-0014 — Kanban event broadcast toggles

**Status:** accepted
**Date:** 2026-05-05
**BU:** `bu-kanban-event-config`
**Brief:** `docs/build/session-briefs/bu-kanban-event-config.md`

## Context

Surface 2 of `bu-coordination-board` (the kanban ticket detail) interleaves human comments + internal notes + **system events** in the thread (`Comment.kind = 'comment'`, `Comment.source = 'system'`). The brief's atom 5d-3 hooks these system rows into kanban mutations — column moves write "Sharon moved this to Preparation", urgent flips write "Maya marked it Urgent", etc.

The brief lists column-moves and urgent flips as ✅ explicit triggers, but doesn't enumerate the rest. Self-assigns, title edits, body edits, share-to-team — each could earn a thread breadcrumb or be silent. Different teams will have different opinions on what's signal vs noise:

- **Writers** want a quiet thread focused on actual discussion; status changes are notification-only.
- **IT** wants every event in the thread because the ticket _is_ the audit log for them.

Hard-coding the answer in the service layer would force one culture on every team, and revisiting requires a code change + redeploy + audit-log conflation.

## Decision

Ship a **`KanbanEventConfig`** table — global, one row per event kind, admin-controlled on/off flag.

```
KanbanEventConfig
  id              String          @id @default(uuid())
  eventKind       KanbanEventKind @unique
  enabled         Boolean         @default(false)
  updatedAt       DateTime        @updatedAt
  updatedByUserId String
  updatedBy       User            @relation(...)
```

`KanbanEventKind` enum has nine values (full set in the schema). Atom 5d-3 calls `isEventEnabled(eventKind)` before writing each system-Comment row; if the toggle is `false`, no row is written.

**Reference data, seeded by migration** (per D070): all nine rows seeded at migration time with sensible defaults (table below). Idempotent on `(eventKind)`; admin flips after seed are not overwritten by re-running the migration.

## Defaults (seeded)

| Event kind      | Default | Rationale                                                       |
| --------------- | ------- | --------------------------------------------------------------- |
| `column_move`   | **ON**  | Brief explicit; high-signal coordination event                  |
| `status_change` | **ON**  | Brief implied (parallel to column_move)                         |
| `urgent_on`     | **ON**  | Brief explicit; brief safety signal                             |
| `urgent_off`    | OFF     | Symmetry isn't worth the noise; admins can flip                 |
| `assign_self`   | OFF     | Subscribers get notified separately; thread breadcrumb is noise |
| `unassign_self` | OFF     | Same as above                                                   |
| `title_edit`    | OFF     | `AuditLog` already records; thread duplication is noise         |
| `body_edit`     | OFF     | Same as above                                                   |
| `share_to_team` | **ON**  | High-signal cross-team coordination event                       |

## Consequences

- **Future-only semantic.** Toggling `enabled` from `false` → `true` does **not** retroactively rewrite historical threads. New events of that kind start writing system-Comment rows from the moment of the flip. Toggling back stops writing; existing system-Comment rows are not pruned. This deliberately mirrors how feature flags behave (`enabledGlobally` flips don't backfill audit history).
- **Audit log stays separate.** `AuditLog` is private (admin-only access for compliance review). The kanban thread is visible to team members. Writing a system-Comment is not a substitute for the audit row — both happen for the same event when the toggle is on.
- **Admin surface is the existing `/data/[entity]` admin CRUD.** No bespoke page; `KanbanEventConfig` is registered in `entity-metadata.ts` + `admin/registry.ts` like every other admin-managed entity.
- **Hot-path read.** `isEventEnabled` is called once per kanban mutation. Current implementation is a Prisma `findUnique` per call (~1ms); if pilot data shows this in a hot loop, add a process-level cache with a short TTL or a Postgres `LISTEN/NOTIFY` invalidation. Not worth the complexity until measured.
- **No event throttling/debouncing v1.** If an admin moves five cards in a minute, that writes five system rows. Pilot feedback will tell us if coalescing is needed.
- **No event-content customisation v1.** The wording of each system message is fixed in the service template. Per-team copy override is a future BU.
- **Per-group is a future additive migration.** Add `groupId String?` (nullable for "global") and an index. Existing rows continue to act as global defaults; per-group rows take precedence. Strictly additive.

## Alternatives considered

1. **Code-fixed trigger set (no admin control).** Simpler to implement, zero schema. Rejected: forces one team's noise tolerance on everyone, and the round-trip to flip a default is a code change + deploy.
2. **Per-group from v1.** More flexible but multiplies the admin surface (9 rows × N groups). Rejected for v1: every pilot team starts with the same defaults; per-group can be added without breaking changes.
3. **Reuse `FeatureFlag` table.** Tempting (these are operational on/off toggles), but `FeatureFlag` semantics include rollout-percentage, user-specific overrides, kill-switch purpose-tagging — none of which apply here. Cleaner to ship a focused table than overload `FeatureFlag`.
4. **Reuse `SystemSetting` table.** Generic key/value store. Loses type safety (`enabled` becomes `value: string` cast at read). Rejected: the enum + boolean shape is small enough to deserve a typed home.

## Companion BU

`bu-coordination-board` atom 5d-3 (the system-event hook in the comment/note thread) reads `isEventEnabled` before writing each system row. Stream B of the parallel handoffs (`parallel-stream-b-comment-thread-2026-05-05.md`) ships 5d-1, 5d-2, 5d-4, 5d-5 first; 5d-3 lands once this BU is on `main`.

## Migration plan

Single Prisma migration `20260507100000_kanban_event_config`:

1. `CREATE TYPE "KanbanEventKind" AS ENUM (...)`
2. `CREATE TABLE "KanbanEventConfig" (...)` with FK + unique index + enabled index
3. Idempotent `INSERT ... ON CONFLICT ("eventKind") DO NOTHING` for all 9 rows, attributed to the `system@gps-action.test` user (created on demand via `ON CONFLICT (email) DO NOTHING` for migration self-containment).

No data migration of existing rows — there are none.
