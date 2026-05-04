# ADR-0005 · `RequestStatus` reframe for kanban surface

**Status:** Accepted (target shape; reframe lands in PR #2 alongside service migration)
**Date:** 2026-05-04
**Deciders:** Paul (product), Claude Code Session A (schema PR)

## Context

The `Request` table is reused by the coord-board as the underlying
ticket entity (per bu-coordination-board v0.4 — every "ticket" is a
`Request`, the kanban metaphor sits on top). The current `RequestStatus`
enum carries lifecycle semantics from the BU-requests-foundation
(D054) shipped queue:

```
unclaimed | claimed | in_review | resolved | abandoned
```

Those values are tightly coupled to the claim-and-lease workflow: a
single owner takes a row out of an unclaimed pool, works it, resolves
it. The kanban metaphor is different: tickets sit in a backlog,
become active (in any of N configurable workflow columns), and end
in done or abandoned. There is no single "claimed by"; assignment
is multi-user via `Assignment`.

Direct overlap is not 1:1:

- `unclaimed` and `claimed` collapse into "active without/with
  assignees" — but that's a derived UI concern, not a status.
- `in_review` is a vetting-flow waypoint that doesn't generalise to
  every ticket kind.
- The kanban needs `backlog` (off-board, not yet on a column) which
  the current enum has no value for.

D054 had previously planned a status collapse to `new |
in_discussion | done`. The kanban makes that plan obsolete.

## Options considered

- **Option A — Reframe `RequestStatus` to `backlog | active | done | abandoned`.** `BoardColumn` (per-Group, configurable) carries
  the visual workflow within `active`. Existing services migrate
  values: `unclaimed → backlog`, `claimed → active`, `in_review → active`, `resolved → done`, `abandoned → abandoned`.
  - Pros: clean four-bucket lifecycle; visual workflow lives in
    a separate, configurable entity; matches the kanban metaphor
    natively; `done` and `abandoned` stay distinct (auditable).
  - Cons: every existing reader of `RequestStatus` (vetting, flag,
    kind_review services + their UIs) must migrate. Cannot land in
    a "no-behaviour" PR. Existing rows need an explicit data
    migration mapping.

- **Option B — Add a parallel `boardStatus` field**, leaving
  `status` unchanged. Two enums, one for legacy queue, one for
  kanban.
  - Pros: zero migration risk for legacy callers.
  - Cons: every row carries two statuses that must be kept in
    sync; subtle drift bugs guaranteed; future readers can't tell
    which to consult; ADR cost paid twice if the legacy enum ever
    retires anyway.

- **Option C — Extend the existing enum** with `backlog` and treat
  the rest as kanban-compatible aliases (`claimed → in progress`).
  - Pros: no rename, minimal migration.
  - Cons: keeps the claim-and-lease vocabulary in a board metaphor
    that has multi-assignee, no claim TTLs, no lease. Members see
    `in_review` on a writing ticket; data confuses code.

## Decision

We adopt **Option A**: reframe `RequestStatus` to `backlog |
active | done | abandoned`.

The reframe is **deferred to PR #2** (services). PR #1 — this PR —
adds the `BoardColumn` entity, the `columnId` and `boardPosition`
fields on `Request`, and ships this ADR. Reframe-and-data-migrate
ride PR #2 alongside the service-layer rewrite that consumes the
new enum.

Target Prisma shape (lands in PR #2):

```prisma
enum RequestStatus {
  backlog
  active
  done
  abandoned
}

model Request {
  // …
  status        RequestStatus @default(backlog)
  columnId      String?       // FK BoardColumn (only when status = active)
  boardPosition Decimal?      // manual reshuffle position within column
}
```

Mapping for existing rows (PR #2 data migration):

| Old value   | New value   |
| ----------- | ----------- |
| `unclaimed` | `backlog`   |
| `claimed`   | `active`    |
| `in_review` | `active`    |
| `resolved`  | `done`      |
| `abandoned` | `abandoned` |

Service-layer translation: legacy callers (vetting, flag) that
queried `WHERE status = 'unclaimed'` migrate to `WHERE status = 'backlog'`. Callers that read `claimed` migrate to checking
`Assignment.count(...)` rather than the status — assignment is the
real signal, not the status enum.

## Reasoning

- **Visual workflow ≠ lifecycle status.** The kanban's column names
  (Recruitment / Preparation / Implementation / Monitoring) are
  per-group and configurable. Forcing them into a global enum
  fights the brief's Tier-2 default #2 (column configurability per
  `GroupKind` with per-group override). Splitting carries the
  configurability into `BoardColumn` and lets `RequestStatus` stay
  small and stable.
- **Four buckets cover the full lifecycle.** Backlog (off-board),
  active (any workflow column), done (off-board archive),
  abandoned (cancelled, distinct from done for audit). Anything
  finer-grained is a column.
- **Legacy `in_review` collapses cleanly.** Vetting's "in review"
  was a single waypoint between claim and resolve; it maps to
  `active` with no information loss, and the corresponding
  vetting UI can read the existence of `Assignment` rows for the
  reviewer if it needs a finer-grained signal.
- **Defer-to-PR-#2 keeps PR #1 truly additive.** This ADR is
  recorded now (so PR #2 doesn't re-litigate the shape) but the
  schema rename and data migration ship together with the
  consumer code, in one reviewable atom.

## Consequences

- **Easier (after PR #2):**
  - `RequestStatus` reads cleanly without claim-vocabulary in a
    board context. UI labels match data.
  - Kanban routes filter `WHERE status = 'active' AND columnId = ?`
    — no synthetic state.
  - Backlog and Done tabs are simple enum filters; no compound
    "claimed but not resolved" queries.

- **Harder:**
  - PR #2 must update every legacy caller of `RequestStatus`.
    Search-and-replace surface listed in the bu-coordination-board
    handoff: `server/services/request.ts`, vetting / flag routers,
    `app/requests/[id]/page.tsx`, `components/RequestRow.tsx`.
  - Data migration for existing rows must run before the enum
    rename (Postgres can't rename enum values that are in use).
    PR #2 ships in two migrations: data migration first, then enum
    rename.

- **Forward-only.** Once PR #2 lands, the old enum values are gone.
  Rollback would require restoring the five-value enum and
  back-mapping; this is documented but not expected in practice
  (the kanban gate `coord_board_v1` keeps the new fields dormant
  until pilot teams flip).

## Notes

- This ADR supersedes the D054 status-collapse plan
  (`new | in_discussion | done`). Both directions agreed on
  collapsing five values; the kanban brief picks a different
  four-value target that better matches the new metaphor.
- `BoardColumn` (per-Group, configurable) is specified in
  ADR-0006. The `columnId` FK on `Request` ships in PR #1 (this
  PR) alongside this ADR.

## Related

- D054 — `WorkItem → Request` rename + status-collapse plan
  (superseded for the target enum).
- D043 — Groups model. `Group.kind` (added in PR #1) drives
  `BoardColumn` defaults per ADR-0006.
- ADR-0006 — `BoardColumn` configurability.
- bu-coordination-board v0.4 — implementation contract, build
  sequence #1 of 8.
