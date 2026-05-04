# ADR-0011 · Drop `Request.claimedByUserId` (and the rest of the claim trio); migrate to `Assignment`

**Status:** Accepted (executes ADR-0009's deferred drop)
**Date:** 2026-05-04
**Deciders:** Paul (product), Claude Code (this session)

## Context

ADR-0009 introduced the `Assignment` join table — multi-assignee per
Request, replacing the single-owner `Request.claimedByUserId`
column. The original column was deferred for removal until every
consumer migrated.

`Request.claimedByUserId` doesn't ride alone: the schema also
carries `claimedAt: DateTime?` and `claimExpiresAt: DateTime?`,
both meaningless without a claimer. The schema comment at
`Request` says "status='claimed' implies claimedByUserId, claimedAt,
claimExpiresAt populated" — they're a single conceptual unit.

Consumers reading these fields:

- `server/services/request.ts` — `claimRequest` writes the trio;
  `resolveRequest` reads `claimedByUserId` for the "must be claimer"
  guard; `RequestListItem` exposes `claimedByUserId` + `claimedAt`
  - `claimedBy`.
- `app/requests/[id]/page.tsx` — direct Prisma query includes
  `claimedBy`; `isClaimedByCaller` check.
- `components/RequestRow.tsx` — renders "Picked up by X".
- `prisma/seed.ts` — populates the trio for seeded claimed Requests.
- Tests fixtures.

Also: `claimExpiresAt` is referenced only by `seed.ts`. No active
sweeper enforces it; the comment at the top of the model mentions
"Sweeper releases expired claims every 5 min" but no such code exists.
Dead schema.

## Decision

Drop **all three claim columns** (`claimedByUserId`, `claimedAt`,
`claimExpiresAt`) plus the `claimedBy` relation. Migrate every reader
to `Assignment`.

```prisma
// before
claimedByUserId String?
claimedBy       User?     @relation("requestsClaimed", fields: [claimedByUserId], references: [id], onDelete: SetNull)
claimedAt       DateTime?
claimExpiresAt  DateTime?
@@index([claimedByUserId, status])

// after — gone. Assignment carries who/when. Sweeper TTL was never enforced.
```

### Migration shape

Two-step, single migration file:

1. **Backfill `Assignment` rows** for every Request currently carrying
   `claimedByUserId IS NOT NULL`. Preserves "ownership" history.

   ```sql
   INSERT INTO "Assignment" ("id", "requestId", "userId", "assignedAt")
   SELECT gen_random_uuid(), id, "claimedByUserId", COALESCE("claimedAt", "createdAt")
   FROM "Request"
   WHERE "claimedByUserId" IS NOT NULL
   ON CONFLICT ("requestId", "userId") DO NOTHING;
   ```

2. **Drop columns + index + relation.**

   ```sql
   DROP INDEX IF EXISTS "Request_claimedByUserId_status_idx";
   ALTER TABLE "Request"
     DROP COLUMN "claimedByUserId",
     DROP COLUMN "claimedAt",
     DROP COLUMN "claimExpiresAt";
   ```

### Consumer migration shape

- **`claimRequest`**: keep the atomic `status='unclaimed' → 'claimed'`
  guard (race-safety); inside the same transaction, create an
  `Assignment` row for the claimer. The status flip is the lock.
- **`resolveRequest`**: replace `existing.claimedByUserId !== userId`
  with `await prisma.assignment.findFirst({ where: { requestId, userId, unassignedAt: null } })`.
- **`RequestListItem`**: keep the `claimedBy` / `claimedByUserId`
  shape (UI-stable). Internally derive from the **first active
  `Assignment`** (oldest by `assignedAt`). Multi-assignee UX comes
  later via Surface 2's `BoardActionPair`; reviewer queues stay
  visually single-owner.
- **Detail page** (`/requests/[id]/page.tsx`): replace direct
  `claimedBy` include with `assignments` include + null-coalescing.

## Reasoning

- **The trio is one concept.** Keeping `claimedAt`/`claimExpiresAt`
  without `claimedByUserId` would create orphan timestamps. Drop
  together.
- **`Assignment.assignedAt` replaces `claimedAt`.** First active
  assignment's `assignedAt` is what "claimed at" means under the
  new model.
- **`claimExpiresAt` was always dead.** No sweeper code enforced it.
  Drop without replacement; if a TTL is needed later, a separate
  ADR introduces it on `Assignment`.
- **UI stability over data-model purity.** `RequestListItem`
  surface stays the same so legacy reviewer-queue UI doesn't churn.
  Behind the scenes the source is `Assignment`. Multi-assignee
  surfacing is a follow-up.
- **Atomic claim guard preserved.** The legacy claim-and-lease
  semantics (no double-claim) survive via the `status='unclaimed'`
  filter in `claimRequest`'s `updateMany`. Once status flips, no
  one else can claim through the legacy flow.

## Consequences

- **Easier:**
  - One source of truth for "who's working on this Request"
    (`Assignment`).
  - Multi-assignee semantics (Surface 2) can layer on without
    schema changes.
  - The dead `claimExpiresAt` column is gone.

- **Harder:**
  - The `RequestListItem` derivation requires an `assignments`
    include on every read query. Slight join overhead for legacy
    reviewer queues that previously read a single column.
  - Test fixtures lose the `claimedByUserId` shorthand and gain an
    `assignments: [{userId, assignedAt}]` array.

- **Forward-only with backfill.** The migration is destructive
  (DROP COLUMN). Reversal would require restoring the columns and
  copying first-Assignment data back; not planned.

## Notes

- This ADR executes the deferred drop from ADR-0009. ADR-0009 already
  documented "consumer-service migration in PR #2 drops the old column"
  — this is that drop.
- `Request.status` enum still includes `claimed` and `unclaimed`. PR
  #2g.3 (`RequestStatus` reframe) handles those. This PR keeps the
  status enum intact.
- The `request_claimed` audit-log action and the `request_status_changed`
  notification both stay; their semantics didn't change.

## Related

- ADR-0009 — `Assignment` introduction; documents this drop as
  deferred.
- ADR-0010 — `Request.type` nullable (PR 2g.1).
- D072 — claim-and-lease design (the original single-owner pattern;
  superseded for kanban surfaces, retained for reviewer queues via
  the status guard).
- bu-coordination-board v0.4 — "Drop `Request.claimedByUserId`
  (replaced by `Assignment`)" line in the Field changes section.
