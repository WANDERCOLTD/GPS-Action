# ADR-0009 · `RequestGroup` and `GroupShareWorkflow` — share-with-team semantics

**Status:** Accepted (additive; coexists with `Request.groupTags` until consolidation)
**Date:** 2026-05-04
**Deciders:** Paul (product), Claude Code Session A (schema PR)

## Context

The kanban needs cross-team mechanics: a Request authored in the
Writers board can be shared to IT (because the writer hit a tech
problem). Once shared, IT sees the ticket on its board and can
move it through its own column workflow without disturbing
Writers' view. Both groups can comment, assign, and resolve
independently — until everyone closes their copy, the ticket is
still open.

Three primitives appeared in early sketches and were collapsed
to two by Paul's parked feedback (2026-05-03 PM):

1. **Share-with-team** (admin-pre-set workflow allow-list per
   team — e.g. Writers can share to IT and Radio, no need to
   pick from "all groups").
2. **Invite-group-to-ticket** (ad-hoc share to any group, picker
   includes everyone).
3. ~~**`GroupInvite`**~~ — collapsed; same as #2 but with a
   different surface name.

Paul's feedback: "Share-with-team and Invite-group should be the
same thing: Share with team." So #1 and #2 are surface-level
variations of the same primitive — the picker shows the
admin-pre-set targets first (or only), and an "Other groups…"
expansion lets a member share elsewhere if needed and allowed.

The current `Request` model loosely connects to groups via
`groupTags: String[]` (an array of slugs). That's informational
only — every group with a slug in the tag list sees the ticket
in their unfiltered queue, but there's no per-group state. The
brief introduces structured per-group state via the new
`RequestGroup` join: each link carries its own `columnId`, its
own assignment view, its own comment audience.

`GroupShareWorkflow` is the per-team admin allow-list of share
destinations. It constrains the picker on Surface 2.

`prisma/schema.prisma` is contract-locked; the new join +
allow-list table ride this ADR.

## Options considered

- **Option A — `RequestGroup` join + `GroupShareWorkflow`
  allow-list.** Per-group state for each shared link
  (independent column, position, assignment view); allow-list
  constrains the picker but doesn't enforce at the DB level.
  - Pros: matches the brief's mental model 1:1. Per-group
    state is structured. Picker UI reads
    `GroupShareWorkflow` rows; picker can fall back to "Other
    groups…" when the user has cross-team-share permission
    beyond the allow-list.
  - Cons: two new entities. `groupTags` String[] coexists for
    a transition period.

- **Option B — Reuse `groupTags`** as the join, with no per-group
  state.
  - Pros: zero new entities.
  - Cons: per-group column / position requires a separate
    structure anyway (you can't carry it in a slug array). Loses
    the brief's main point — independent per-group workflow.

- **Option C — `RequestGroup` join only; no `GroupShareWorkflow`
  table; allow-list is a code constant or a JSON column on
  `Group`.**
  - Pros: one fewer entity.
  - Cons: per-team admins must edit code or JSON to manage
    allow-lists. JSON loses FK integrity (the allowed targets
    are `Group` IDs). Code-resident loses runtime config.
  - The brief's permission model gives "Configure
    `GroupShareWorkflow`" to group admins as a regular admin
    surface action — that needs a table to back it.

- **Option D — Subsume `GroupShareWorkflow` into
  `GroupMembership`** (a "can share to" flag per membership row).
  - Pros: no new entity.
  - Cons: nonsense semantics — `GroupMembership` is
    user-in-group; share-targets are group-to-group. Wrong
    grain.

## Decision

We adopt **Option A**: a `RequestGroup` join carrying per-group
state, plus a `GroupShareWorkflow` table for the per-team
admin-pre-set allow-list of share targets.

```prisma
model RequestGroup {
  id        String   @id @default(uuid())
  requestId String
  request   Request  @relation(fields: [requestId], references: [id], onDelete: Cascade)
  groupId   String
  group     Group    @relation("groupRequests", fields: [groupId], references: [id], onDelete: Cascade)

  // Per-link state — independent per (Request, Group).
  columnId      String?      // FK BoardColumn (when status = active in this group)
  column        BoardColumn? @relation(fields: [columnId], references: [id], onDelete: SetNull)
  boardPosition Decimal?
  isUrgent      Boolean      @default(false)

  // How the link came to be — workflow target vs ad-hoc share.
  origin RequestGroupOrigin @default(originating)

  // Who shared (for ad-hoc) or null for the originating group / workflow auto-route.
  sharedByUserId String?
  sharedBy       User?    @relation("requestGroupSharedBy", fields: [sharedByUserId], references: [id], onDelete: SetNull)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@unique([requestId, groupId])
  @@index([groupId, deletedAt])
  @@index([requestId])
}

enum RequestGroupOrigin {
  originating       // the group the Request was authored in
  workflow_share    // share via GroupShareWorkflow allow-list
  ad_hoc_share      // ad-hoc share (picker "Other groups…")
}

model GroupShareWorkflow {
  id              String   @id @default(uuid())
  sourceGroupId   String
  sourceGroup     Group    @relation("workflowSources", fields: [sourceGroupId], references: [id], onDelete: Cascade)
  targetGroupId   String
  targetGroup     Group    @relation("workflowTargets", fields: [targetGroupId], references: [id], onDelete: Cascade)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@unique([sourceGroupId, targetGroupId])
  @@index([sourceGroupId, deletedAt])
}
```

Note: `Request.columnId` and `Request.boardPosition` (specified
by ADR-0006) refer to the **originating** group's view. When a
Request lives in N groups (one originating + N-1 shares), each
non-originating group's view comes from its `RequestGroup` row.
Service code dispatches reads:

| Context                         | Source of truth                             |
| ------------------------------- | ------------------------------------------- |
| Originating group's board cell  | `Request.columnId`, `Request.boardPosition` |
| Shared group's board cell       | `RequestGroup.columnId`, `.boardPosition`   |
| Originating group's urgent flag | `Request.urgency`                           |
| Shared group's urgent flag      | `RequestGroup.isUrgent`                     |

Permission envelope (PR #2 service layer):

- A member of the originating group can edit description,
  assign, and comment with full access.
- A member of a _shared_ group sees the ticket on their board,
  can comment (visible to everyone with access), can author
  internal notes (visible to that group only — per ADR-0007
  `Comment.kind = note` plus a `groupId` qualifier resolved at
  read time), can assign themselves, can move the ticket
  through their group's columns. They cannot delete the
  underlying `Request`.
- `GroupShareWorkflow` controls which targets the picker
  surfaces by default. Members with cross-team-share permission
  (per the permission table in the brief) can pick beyond the
  allow-list.

## Reasoning

- **Per-group state is the whole point.** Without `RequestGroup`,
  you can't have "Writers Done + IT Active" on the same ticket —
  which the brief makes a primary use case. The join carries
  the state that diverges per group; `Request` carries the
  state that doesn't (title, body, kind, originating group,
  audit).
- **`origin` enum makes audit and analytics legible.** "How did
  this ticket end up on IT's board?" answers itself: workflow
  vs ad-hoc vs originating. Three values cover the lifecycle
  without overgrowth.
- **Allow-list is config, not constraint.** The picker reads
  `GroupShareWorkflow` to surface admin-blessed targets first.
  The hard permission gate (can-this-user-share-cross-team-at-all)
  sits in `GroupMembership.role`, not in
  `GroupShareWorkflow`. Two layers, separable.
- **Cascade semantics are clean.** Deleting a Group cascades
  its `RequestGroup` rows (its board entries vanish; the ticket
  itself survives in the originating group). Deleting a Request
  cascades all its links (the ticket vanishes everywhere). Soft-
  delete on the join row is the normal "remove from this group's
  board" action — `Request` itself untouched.
- **Subsumes the originally-planned `GroupInvite` ADR.** Per
  parked feedback, Invite collapsed into Share. One primitive,
  not two; one ADR, not two.

## Consequences

- **Easier:**
  - Per-group board renders read `RequestGroup` with a join on
    `Request` — clean queries, no array gymnastics.
  - Per-group urgent flag and column independence work natively.
  - Share-with-team picker is one query
    (`SELECT FROM GroupShareWorkflow WHERE sourceGroupId = ?`)
    plus an "Other groups" expansion the role check gates.
  - Admin's allow-list config UI is a regular CRUD over
    `GroupShareWorkflow`.

- **Harder:**
  - `Request.groupTags` (the legacy informational join) keeps
    living alongside for a transition period. Service code
    must dispatch — boards read `RequestGroup`; legacy queue
    filters keep reading `groupTags`. Documented in PR #2.
  - "Whose comment notes are visible?" requires a service-layer
    join: a member of group X reading the thread sees comments
    where `kind = comment`, plus notes where the author is a
    member of group X (and the request has a `RequestGroup`
    link to X). PR #2 implements; this ADR records.

- **Forward-only.** Two new entities + one enum. No existing
  data touched. `Request.groupTags` continues to function. A
  follow-up ADR may collapse `groupTags` into `RequestGroup`
  once kanban is the universal flow.

## Notes

- **`originating` is implicit.** When a Request is created
  inside group X, the create service inserts:
  1. `Request` with `groupTags = ['x']` (legacy compat).
  2. `RequestGroup` with `requestId, groupId = x, origin = originating`.
     Subsequent shares add `RequestGroup` rows with `origin = workflow_share | ad_hoc_share`.
- **Originating group per Request.** A Request is "owned by"
  exactly one originating `RequestGroup` row. The originating
  row's `columnId` and `boardPosition` are mirrored on the
  `Request` itself for legacy callers; PR #2 keeps these
  fields in sync.
- **No `RequestGroup.deletedAt = unshare`.** Unsharing soft-
  deletes the row (the ticket disappears from the receiving
  group's board, but audit remains: who shared, when, who
  unshared). Re-sharing creates a new row (or undeletes by
  flipping `deletedAt = null`).
- **Cross-team flags-in-corner UX** (mentioned in Surface 3
  callouts) reads `RequestGroup.isUrgent` aggregated across the
  current user's groups. Pure UI signal; no schema impact.

## Related

- D043 — Groups model.
- ADR-0005 — `RequestStatus` reframe (the active/done/abandoned
  values referenced here).
- ADR-0006 — `BoardColumn` (per-group columns; `RequestGroup.columnId` FKs in).
- ADR-0007 — `Comment.kind = note` (visibility envelope per
  group).
- bu-coordination-board v0.4 — Surface 2 share semantics; Tier-1
  decision "Share-with-team and Invite-group merge" (parked
  feedback applied).
