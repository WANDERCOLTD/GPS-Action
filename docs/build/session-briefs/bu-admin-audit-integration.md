---
slug: bu-admin-audit-integration
status: shipped
shipped_in: "#84"
phase: 2
---
# SESSION BRIEF · BU-admin-audit-integration — wire AuditLog into generic admin mutations

_Brief version: 1.0 · Author: Paul + Claude · Date: 2026-04-26_
_Priority: post-BU-admin-crud (#79). Direct follow-up._
_Pairs with: B07 (audit log spec), BU-admin-crud (the engine this
extends), D061 (admin surface honesty discipline)._

---

## Objective

Every generic admin mutation (`admin.create`, `admin.update`,
`admin.delete` in any mode) writes an `AuditLog` row. The audit
chain becomes the primary record of who did what to which entity,
captured in the same procedure that performs the mutation.

Success: an admin edits a User's `displayName` in `/data/user/[id]/edit`
→ a single `AuditLog` row appears with `action: 'admin.user.update'`,
`entityType: 'user'`, `entityId: <user id>`, `userId: <admin id>`,
`changes: { displayName: { from: 'Eddie', to: 'Eddie M' } }`. Hard-
deleting a row writes `admin.<entity>.hard-delete` with the row's
last-known shape captured in `changes.before`. The `/data/auditLog`
list shows the new row at the top.

---

## Scope

### Build in this session

**Service layer:**

- `server/services/admin/audit.ts` (new) — small wrapper over the
  existing `auditLog()` writer that:
  - Computes a diff between `before` and `after` for `update`
    mutations (only the fields the actor changed)
  - Captures the full row for `softDelete` / `restore` / `hardDelete`
    in `changes.before`
  - Captures the full row for `create` in `changes.after`
  - Strips PII fields (per security-baseline.md) before writing
    — `email`, `phoneNumber`, `ipAddress`, `userAgent`. Open
    Question 1 nails the exact list down.
- `server/services/admin/crud.ts` (MODIFY) — wire `writeAdminAudit()`
  call into `createEntity`, `updateEntity`, `softDeleteEntity`,
  `restoreEntity`, `hardDeleteEntity`. Audit happens AFTER the
  mutation succeeds (failures don't audit) and is wrapped in
  `try/catch` — audit failures log to console but never block the
  mutation (mirrors the existing `auditLog` pattern in
  `server/services/audit.ts`).

**Tests:**

- `tests/integration/admin-audit-write.test.ts` (new, 6+ cases) —
  asserts that every mutation type writes the right
  `AuditLog` row shape:
  - `create` writes `action: 'admin.<entity>.create'` with
    `changes.after` populated
  - `update` writes `action: 'admin.<entity>.update'` with
    `changes` containing only the diff
  - `softDelete` writes `action: 'admin.<entity>.soft-delete'`
    with `changes.before`
  - `restore` writes `action: 'admin.<entity>.restore'`
  - `hardDelete` writes `action: 'admin.<entity>.hard-delete'`
    with `changes.before`
  - PII fields (per the locked list from Q1) are stripped from
    `changes` before the audit row is written

- `tests/integration/admin-audit-resilience.test.ts` (new, 2 cases)
  — asserts that an `AuditLog` write failure (mock
  `prisma.auditLog.create` to throw) does NOT roll back the
  mutation; the user's update lands and a console.error is logged.

- Existing `admin-crud-user` / `admin-crud-post` tests updated to
  expect `prisma.auditLog.create` calls (mock added).

**Diff helper:**

- `server/services/admin/diff.ts` (new) — `computeDiff(before,
  after)` returns `Record<field, { from, to }>` for fields whose
  values differ. Handles primitive types, Date instances, arrays
  (shallow compare), and JSON-serialisable objects (deep compare
  via `JSON.stringify`). Skips the curated PII field list.

**No schema changes.** `AuditLog` exists already (B07).

**No router changes.** The router still calls
`server/services/admin/crud.ts` exactly as before; the audit-write
happens inside the service.

### Do NOT touch

- `prisma/schema.prisma` — `AuditLog` schema is fine for this BU.
- `server/services/audit.ts` — the underlying `auditLog()` writer
  stays untouched (we wrap it, not replace it).
- `server/routers/admin.ts` — no router-layer changes.
- `entityMetadata` — no metadata changes.
- Member-facing routes — none touched.
- Existing audit-log-writing call sites in other features
  (post.ts, comment.ts, request.ts, etc.) — out of scope.
- The `/data/auditLog` admin metadata entry (it's allow-listed in
  B14) — that's a separate metadata-add follow-up.

### Out of scope (deferred to follow-ups)

- **Bulk-operation auditing.** When BU-admin-bulk-ops ships,
  bulk mutations will call this same `writeAdminAudit()` per row;
  no changes needed here. (One audit row per row mutated, not one
  per bulk action — for forensic clarity.)
- **Member-facing mutation auditing.** Existing routers
  (`post.create`, `comment.add`, etc.) already call `auditLog`
  with their own conventions. Aligning them to a shared shape is
  a future "B15 — audit conventions" pass, not this BU.
- **Audit-log retention / pruning policy.** Out — that's a separate
  ops concern (security-baseline.md territory).
- **Audit-log search beyond `/data/auditLog` list view.** The
  generic admin engine surfaces it; richer querying is a future
  BU-admin-audit-search if needed.
- **IP / user-agent capture.** Conscious omission — see Open
  Question 2. The existing `auditLog()` writer accepts these
  fields, but the admin-surface mutations don't have them in
  scope yet (server actions don't pass `req` through). Lands
  later when real auth + observability lands.
- **Diff sensitivity tuning.** No "compare deep nested JSON"
  beyond `JSON.stringify` equality. If a JSON field changes
  internally, the diff entry is `{ from: <full json>, to:
  <full json> }`. Refining this is a follow-up if the audit log
  becomes noisy.

---

## Contracts

### Inputs consumed

- `auditLog()` from `server/services/audit.ts` — call signature
  unchanged
- `entityMetadata` — for the entity name in the action string
- The registry's mutation methods (already typed) — diff happens
  at the service layer just before/after the registry call

### Outputs produced

**`AuditLog` row shape — the contract:**

```ts
{
  id: string,                           // generated
  action: 'admin.<entity>.<verb>',      // e.g. 'admin.user.update'
  entityType: <entity>,                 // e.g. 'user'
  entityId: <row id>,                   // the mutated row's id
  userId: <actor id>,                   // ctx.user.id — never null
  targetUserId: <subject id> | null,    // for User-entity mutations: same as entityId; else null
  changes: {
    before?: <row shape>,               // hard-delete + soft-delete + restore (full snapshot)
    after?: <row shape>,                // create (full snapshot)
    diff?: Record<field, { from, to }>  // update (diff only, PII-stripped)
  },
  context: { source: 'admin' },         // discriminator for "admin surface mutation"
  createdAt: Date,                      // generated
}
```

**Verb naming:** `create`, `update`, `soft-delete`, `restore`,
`hard-delete`. Hyphenated to keep the prefix unambiguous and to
read naturally in audit-log search (`action ~ 'admin.user.*'`).

---

## Acceptance criteria

### Functional

- [ ] Every `admin.create` writes one `AuditLog` row with
      `action: 'admin.<entity>.create'`, `entityId` matching the
      newly-created row, `changes.after` populated (PII stripped).
- [ ] Every `admin.update` writes one row with `action:
      'admin.<entity>.update'`, `changes.diff` containing only
      changed fields.
- [ ] No-op updates (Zod parses but the `data` matches existing
      values exactly) still write an audit row, but `changes.diff`
      is `{}` — surfaces "the actor pressed Save without changes."
- [ ] `admin.delete` (soft / restore / hard) each writes a row
      with the correct verb + `changes.before` snapshot.
- [ ] `AuditLog` write failures (mocked) do NOT roll back the
      mutation. The mutation succeeds; a console.error logs.
- [ ] PII fields per the Q1 list are stripped from
      `changes.before` / `changes.after` / `changes.diff`.
- [ ] When the entity is `user`, `targetUserId` is set to
      `entityId`. For other entities, `targetUserId` is null.

### Non-functional

- [ ] `npm run typecheck` clean — zero `any`, zero `@ts-ignore`
- [ ] `npm run lint` clean
- [ ] `npm run test` all passing (8+ new tests; existing tests
      updated to mock `prisma.auditLog.create`)
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` clean
- [ ] Every new file has `@build-unit BU-admin-audit-integration`
      AND meaningful `@spec` headers (D038 / D051 / F06 r1 / F13)
- [ ] Layer boundaries respected — no Prisma access outside services

### Communication

- [ ] PR description summarises the audit shape, links this brief
- [ ] Commit message: `feat(admin-audit): BU-admin-audit-integration
      — wire AuditLog into generic admin mutations`
- [ ] Branch: `feat/bu-admin-audit-integration`

---

## Permission matrix

No changes. Audit-write is a side-effect of mutation; the gate is
the existing `requireRoleForEntity` check. AuditLog reads are
gated by metadata (admin only).

---

## UI states

No UI changes in this BU. The user observable change is: when an
admin views `/data/auditLog` (after the metadata-add follow-up),
new rows appear at the top with `admin.*` action prefixes.

---

## Tests required

**Integration (`admin-audit-write.test.ts`):**

1. `create` writes `action: 'admin.user.create'`, `changes.after`
   populated, PII stripped
2. `update` writes `action: 'admin.user.update'`, `changes.diff`
   only contains changed fields
3. No-op `update` writes a row with `changes.diff: {}`
4. `softDelete` writes `action: 'admin.user.soft-delete'`,
   `changes.before` populated
5. `restore` writes `action: 'admin.user.restore'`
6. `hardDelete` writes `action: 'admin.<entity>.hard-delete'`
   (use a `softDelete: false` entity — `roleGrant` once mutations
   are added there, or test via mock)
7. Non-User entity: `targetUserId` is null
8. User entity: `targetUserId === entityId`

**Integration (`admin-audit-resilience.test.ts`):**

9. Audit-write failure: mutation still succeeds, console.error
   logged (mocked)
10. Audit-write succeeds even when `auditLog` returns void
    (sanity)

**Unit (`admin-diff.test.ts` — new, 4 cases):**

11. `computeDiff` returns `{}` for identical inputs
12. `computeDiff` returns only changed fields
13. `computeDiff` strips PII fields
14. `computeDiff` handles Date / array / nested object equality

**Existing tests updated:**

- `tests/integration/admin-crud-user.test.ts` — mock
  `prisma.auditLog.create` (returns ok); assert it was called
  per mutation
- `tests/integration/admin-crud-post.test.ts` — same

---

## Known gotchas

- **Audit happens AFTER the mutation, not before.** The `before`
  snapshot for soft-delete / restore / hard-delete must be loaded
  BEFORE the mutation runs (because soft-delete sets `deletedAt`
  and changes the row state). Pattern: load row → run mutation →
  use the pre-loaded `before` for `changes.before`.
- **Audit happens INSIDE a try/catch.** Per the existing
  `auditLog` writer's contract: audit failures NEVER block the
  mutation. Wrap, log, move on.
- **`update` with no changes still audits.** A "no-op save"
  surfaces in audit as `changes.diff: {}` — useful forensically
  ("admin opened the form and pressed Save"). Don't filter these
  out.
- **PII stripping.** `email`, `phoneNumber`, `ipAddress`,
  `userAgent` are stripped per the Q1-locked list. Stripping
  happens in `computeDiff` AND in the `before/after` snapshot
  builders. Tests assert this for both `User` and `Post` entities.
- **Hard-delete needs the row pre-loaded.** Cannot snapshot a
  row that's already gone. The `hardDeleteEntity` helper must
  load the row before deleting.
- **`createEntity` returns `{ id }`, not the full row.** To
  capture `changes.after`, the helper either re-fetches via
  `getEntityRaw(entity, id)` after create, or the registry's
  `create` is extended to return the full row. Recommendation
  in Open Question 3.

---

## Decisions confirmed before build (Paul, 2026-04-26)

These lock the five Open Questions below. The build session
executes against them.

1. **PII strip list:** `email`, `phoneNumber`, `ipAddress`,
   `userAgent`. (`displayName` is NOT PII — it's the public
   identifier and stays in `changes`.)
2. **IP / user-agent capture: deferred.** Server actions don't
   carry the request through today. Lands in a future BU when
   real auth + observability infrastructure ships.
3. **`changes.after` for `create`: re-fetch via `getEntityRaw`.**
   One extra DB read per create, but no per-entity registry
   change required. Registry signatures stay as-is.
4. **Verb format: dotted** — `admin.user.update` etc. Sorts
   naturally in `action LIKE 'admin.%'` queries; reads as
   `<surface>.<entity>.<verb>`.
5. **No-op `update` audits.** Empty `changes.diff` is logged.
   Forensically useful — surfaces "admin opened the form and
   pressed Save without changing anything."

---

## Open questions to surface to Paul

(Originally pinned for review. All resolved above; preserved
here as the trail of recommendations + rationale.)

1. **PII strip list.** Default list: `email`, `phoneNumber`,
   `ipAddress`, `userAgent`. Confirm. Anything else? (Note:
   `displayName` is NOT PII — it's the public identifier.)
2. **IP / user-agent capture.** Defer to a future BU when the
   server-action pipeline carries them. (Confirming "deferred"
   not "blocked.")
3. **`changes.after` for `create` — re-fetch or extend registry?**
   Re-fetch via `getEntityRaw` after create (one extra DB read,
   no registry change). Or extend `registry.create` to return the
   full row (no extra read, but every entity entry needs an
   update). Recommend **re-fetch** for simplicity. Confirm.
4. **Verb format.** `'admin.user.update'` (dotted) vs
   `'admin_user_update'` (snake). Existing audit conventions in
   the codebase (`post_created`, `comment.add`) are mixed.
   Recommend dotted because it sorts naturally in queries and
   matches the `entity.verb` two-axis read. Confirm.
5. **No-op update auditing.** Confirm we want to audit even when
   the diff is empty.

---

## Definition of done (per working-rhythm.md §3)

### Functional

- [ ] All acceptance criteria pass
- [ ] Manual click-through: admin edits a User in `/data/user/[id]/edit`
      → `psql` query confirms one audit row written with the right shape
- [ ] Open questions resolved or surfaced in PR

### Mechanical

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run test` all passing
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` clean

### Discipline

- [ ] Every new file has `@build-unit BU-admin-audit-integration` + `@spec`
- [ ] No PII in any audit row's `changes` field
- [ ] Layer boundaries respected
- [ ] No schema changes; no migrations

### Communication

- [ ] PR description, links this brief, lists open questions surfaced
- [ ] Commit + branch follow conventions

---

## Context

**Specs:**

- `docs/architecture/decision-log.md` — B07 (audit log spec),
  D061 (admin honesty discipline)
- `docs/process/security-baseline.md` — PII-in-logs rules (F06 r3)
- `docs/process/api-contract-discipline.md`

**Existing code to read first:**

- `server/services/audit.ts` — the writer this BU wraps
- `server/services/admin/crud.ts` — where calls land
- `server/services/admin/registry.ts` — how mutations resolve to
  Prisma delegates
- `server/services/post.ts:175-188` — existing audit-write
  precedent (post.create writes `post_created`)
- `tests/integration/audit-service.test.ts` — existing audit
  test patterns

---

## What this brief does NOT cover

1. Bulk-operation auditing (BU-admin-bulk-ops uses this BU's helper)
2. Aligning member-facing mutation audit shape (future B15)
3. AuditLog retention / pruning
4. AuditLog search beyond `/data/auditLog`
5. IP / user-agent capture
6. JSON field deep-diff

---

## What lands after this session

- Every action through `/data/[entity]` is recorded — answers
  "who edited this row last and what did they change?"
- The audit shape becomes the canonical reference for future
  member-facing mutation alignment (B15)
- Unblocks operational forensics: `psql -c "SELECT * FROM
  AuditLog WHERE action LIKE 'admin.%' ORDER BY createdAt DESC"`
- Sets the pattern BU-admin-bulk-ops calls per-row when bulk
  mutations land
