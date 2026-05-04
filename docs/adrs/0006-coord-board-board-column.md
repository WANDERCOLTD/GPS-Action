# ADR-0006 · `BoardColumn` — per-Group configurable kanban columns

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** Paul (product), Claude Code Session A (schema PR)

## Context

The kanban surface (bu-coordination-board, Surface 1) renders
each working group's tickets as cards in named columns. Column
names are not universal — Writers run `Recruitment / Preparation / Implementation / Monitoring`; an IT support
group runs `New / Open / Done`; a region runs
`New / Active / Resolved`.

Tier-2 default #2 (locked in brief v0.4): system defaults seeded
per `GroupKind`, group admins override.

The brief's "Schema additions" calls for a `BoardColumn` entity.
The shape and ownership model are this ADR.

`prisma/schema.prisma` is contract-locked; new entities ride an
ADR.

## Options considered

- **Option A — Per-Group `BoardColumn` rows; defaults in code.**
  `BoardColumn` is keyed by `(groupId, ordinal)`. A constant
  `BOARD_COLUMN_DEFAULTS_BY_KIND` (in `shared/`) holds the
  default name set per `GroupKind`. On Group creation, a service
  hook inserts the kind's default column rows. Group admins
  edit / reorder / rename the rows freely.
  - Pros: one entity. Group admins own their columns once
    created. Defaults are versioned with the code (a brief
    rename of "Implementation" → "Active" is a code edit, not a
    data migration). Per-Group ordering is a single column.
  - Cons: the default set is in code, not the DB — if defaults
    change, existing Groups don't auto-update (admins edit
    explicitly, which matches the spirit of override).

- **Option B — Two-entity model: `BoardColumnTemplate` (system
  defaults per `GroupKind`) + `BoardColumn` (per-Group overrides).**
  Templates are reference data; per-Group rows clone or override.
  - Pros: defaults live in the DB and can be edited by a
    super-admin without a code deploy. Existing Groups can opt
    to "follow latest template" until they override.
  - Cons: two entities for what is effectively one concept.
    Cloning vs override semantics needs its own ADR. CI gate
    on `assertReferenceData` adds maintenance cost. Premature
    for the build's actual needs (admin override rate is
    expected to be low; defaults rarely change).

- **Option C — JSON column on `Group`** carrying the column
  array.
  - Pros: zero new entity, zero migration on column edits.
  - Cons: no relational integrity for `Request.columnId` FKs;
    cards can't reference a column row by ID; reordering is a
    JSON-array edit (hard to audit); enum-style names get no
    DB-level uniqueness per group.

## Decision

We adopt **Option A**: a single per-Group `BoardColumn` entity,
with system defaults defined in code and seeded on Group
creation.

```prisma
model BoardColumn {
  id          String  @id @default(uuid())
  groupId     String
  group       Group   @relation(fields: [groupId], references: [id], onDelete: Cascade)
  ordinal     Int      // 0-based; admin-reorderable
  displayName String

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  requests Request[]

  @@unique([groupId, ordinal])
  @@index([groupId, deletedAt])
}
```

`Request.columnId: String?` (FK BoardColumn, nullable). Set when
`status = active`; null when status is `backlog | done | abandoned`. (PR #2 enforces the invariant in the
service layer.)

Defaults (in `shared/board-column-defaults.ts`, lands in PR #2
or earlier as an inert constant):

| `GroupKind`  | Default columns                                              |
| ------------ | ------------------------------------------------------------ |
| `workstream` | Recruitment · Preparation · Implementation · Monitoring (×4) |
| `team`       | Recruitment · Preparation · Implementation · Monitoring (×4) |
| `region`     | New · Active · Resolved (×3)                                 |
| `network`    | New · Open · Done (×3)                                       |
| `topic`      | New · Active · Resolved (×3)                                 |

These are confirmable defaults — group admins re-name / re-order
freely after creation. The brief leaves columns 2-3 of
`workstream` open to confirm against the actual Writers and IT
team feedback before flag-flip; PR #2 (or a follow-up) will lock
them after pilot input.

## Reasoning

- **Per-Group is the right grain.** The brief states defaults are
  per `GroupKind` but overrides are per-Group. Per-Group rows
  let `Request.columnId` be a clean FK, support drag-reorder
  trivially (`UPDATE BoardColumn SET ordinal = ? WHERE id = ?`),
  and let admins delete or rename without touching system data.
- **Code-resident defaults match D070's spirit at one remove.**
  D070 reserves DB-resident reference data for rows that code
  references by static slug. `BoardColumn` is referenced by FK
  not slug; the defaults are just an initial-state convenience.
  A version-bump to default names is a `shared/` constant edit;
  existing Groups keep their (already-edited or default) rows.
- **No CI gate on `BoardColumn` reference data.** Unlike
  `PostKind`, no part of the kanban code path requires a static
  named row to exist. Boards render whatever columns the Group
  has. If Group has zero columns yet (mid-creation), the board
  view shows the empty-state for "configure columns first." This
  keeps `assertReferenceData` simple.
- **Soft-delete on column.** `deletedAt` lets admins retire a
  column without losing audit trail; cards on a deleted column
  must be relocated by the admin before delete (service-layer
  invariant in PR #2).
- **Cascade on group delete.** When a `Group` is hard-deleted,
  its columns go with it. Soft-delete on the Group is the
  default path; cascade only fires on the rare hard-delete.

## Consequences

- **Easier (in later PRs):**
  - `Request` cards filter by `(groupId, columnId)` cleanly.
  - Drag-reorder writes one `BoardColumn` row update; no JSON
    surgery.
  - Per-group customisation is a single entity edit.
  - Defaults can be tweaked per pilot feedback without churning
    every existing row.

- **Harder:**
  - Group creation must include a "seed default columns"
    service step (PR #2). If skipped, the board renders empty.
  - Default-name changes in `shared/board-column-defaults.ts`
    don't propagate to existing Groups — admins must edit
    manually. Documented as intentional in the rename UX.

- **Forward-only.** Adding `BoardColumn` plus `Request.columnId`
  is purely additive. No existing rows reference it.

## Notes

- The brief earlier sketched "system defaults seeded per
  `GroupKind` via reference-data migration (D070)." This ADR
  steps off that wording: defaults live in code, _applied_ at
  Group creation in service code (PR #2). The reference-data
  migration mechanism (D070) remains reserved for rows that code
  references by static slug or where boot-time invariants demand
  presence — `BoardColumn` is neither.
- The "kanban menu icon" called out in the bu-coord-board build
  notes (likely `KanbanSquare` from `lucide-react`) lands with
  Surface 1 (PR #4). Not in scope for PR #1.
- Cross-team flags-in-corner UX (touched in Surface 3 callouts)
  is a derived UI signal; no `BoardColumn` schema impact.

## Related

- D070 — Reference data lives in migrations (clarified scope
  here: BoardColumn defaults are NOT D070 reference data).
- D043 — Groups model. `Group.kind` is the dimension on which
  `BoardColumn` defaults branch.
- ADR-0005 — `RequestStatus` reframe. `BoardColumn.id` is
  meaningful only when `Request.status = active`.
- ADR-0009 — `RequestGroup` join. A Request shared to N groups
  has N independent column placements (one per `RequestGroup` row,
  not one per `Request` row).
- bu-coordination-board v0.4 — implementation contract, Surface 1.
