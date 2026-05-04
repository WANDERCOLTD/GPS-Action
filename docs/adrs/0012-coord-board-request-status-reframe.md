# ADR-0012 · `RequestStatus` enum reframe (executes ADR-0005)

**Status:** Accepted (executes the reframe ADR-0005 documented as deferred)
**Date:** 2026-05-04
**Deciders:** Paul (product), Claude Code (this session)

## Context

ADR-0005 documented the target shape: collapse the legacy
five-value `RequestStatus` enum (`unclaimed | claimed | in_review |
resolved | abandoned`) into a four-value kanban-aligned set
(`backlog | active | done | abandoned`). The reframe was deferred
to PR #2g.3 — this PR — because it requires:

1. An enum-rename migration that touches every existing row.
2. Every consumer that compares against status string literals.

Both `claimed` and `in_review` collapse into `active` because, on
the kanban surface, the distinction (someone has started work
versus they're in a review cycle) lives elsewhere — column
placement (`Request.columnId` → `BoardColumn`) carries the
workflow stage. The status enum becomes a coarse lifecycle
discriminator: not started (`backlog`), in progress (`active`),
finished (`done`), gave up (`abandoned`).

## Decision

Rewrite `RequestStatus` as `backlog | active | done | abandoned`.
Map existing rows per the table below (confirmed with Paul on
2026-05-04):

| Legacy value | New value   | Rationale                                                                  |
| ------------ | ----------- | -------------------------------------------------------------------------- |
| `unclaimed`  | `backlog`   | Waiting to be picked up — backlog is the new word.                         |
| `claimed`    | `active`    | Someone is on it. Distinct sub-state (review etc.) lives on `BoardColumn`. |
| `in_review`  | `active`    | Same as `claimed` post-collapse.                                           |
| `resolved`   | `done`      | Plain English; matches the kanban "Done" column.                           |
| `abandoned`  | `abandoned` | Unchanged.                                                                 |

Default changes from `unclaimed` to `backlog`. New rows authored
through any code path land on `backlog` until first transition.

```prisma
enum RequestStatus {
  backlog
  active
  done
  abandoned
}

model Request {
  // …
  status RequestStatus @default(backlog)
}
```

### Migration shape

Postgres doesn't support `DROP VALUE` on an enum. We use the
common swap pattern:

```sql
-- 1. Create the new enum with only the target values.
CREATE TYPE "RequestStatus_new" AS ENUM
  ('backlog', 'active', 'done', 'abandoned');

-- 2. Drop the column default (typed against the OLD enum).
ALTER TABLE "Request" ALTER COLUMN "status" DROP DEFAULT;

-- 3. Cast every existing row to the new enum, mapping values.
ALTER TABLE "Request"
  ALTER COLUMN "status" TYPE "RequestStatus_new"
  USING (
    CASE status::text
      WHEN 'unclaimed' THEN 'backlog'
      WHEN 'claimed'   THEN 'active'
      WHEN 'in_review' THEN 'active'
      WHEN 'resolved'  THEN 'done'
      WHEN 'abandoned' THEN 'abandoned'
    END::"RequestStatus_new"
  );

-- 4. Drop old enum + rename new one into place.
DROP TYPE "RequestStatus";
ALTER TYPE "RequestStatus_new" RENAME TO "RequestStatus";

-- 5. Restore the column default with the new value.
ALTER TABLE "Request" ALTER COLUMN "status" SET DEFAULT 'backlog'::"RequestStatus";
```

Idempotent in spirit: running on a DB where the new enum already
exists fails on step 1 (CREATE TYPE) — fine; migrations are
sequenced.

### Consumer migration

Every comparison against a legacy string literal updates per the
mapping table. The "is this Request open?" predicate
(`status === 'unclaimed' || status === 'claimed' || status === 'in_review'`)
collapses to `status === 'backlog' || status === 'active'`.

The `claimRequest` atomic guard updates `status='backlog' →
'active'` (was `'unclaimed' → 'claimed'`). The `resolveRequest`
allowed-from check becomes `status === 'active'` (was `'claimed' ||
'in_review'`).

Audit-log action names (`request_claimed`, `request_resolved`)
are unchanged — they refer to the action verb, not the state.
The notification copy ("X picked up your request") is unchanged
for the same reason.

## Reasoning

- **`claimed` and `in_review` collapse cleanly.** The current
  code already treats them as a single "is in flight" state
  everywhere except a few unused branches. The kanban surface
  carries the workflow nuance via `BoardColumn`, so the status
  enum doesn't need to.
- **`resolved → done`, plain English.** Member-facing copy already
  trends toward "Done" — see the existing `STATUS_LABELS` map in
  `RequestRow.tsx` mapping `resolved → 'done'`.
- **`backlog` over `unclaimed`.** Consistent with the Surface 1
  off-board tab name. "Unclaimed" was a claim-and-lease term;
  with the claim trio dropped (PR #2g.2 / ADR-0011), the word
  has nothing to anchor to.
- **One migration, one PR.** Splitting the enum swap from the
  consumer string-literal updates would leave a window where the
  DB has new values but the code still writes old ones — broken.
  Atomic.

## Consequences

- **Easier:**
  - Status checks become one comparison instead of two
    (`status === 'active'` vs `status === 'claimed' || 'in_review'`).
  - Kanban columns map naturally: `BoardColumn` rows live inside
    `status='active'`; `Backlog` and `Done` tabs map to the
    `backlog` and `done` enum values.
  - Plain-English member copy.

- **Harder:**
  - The migration is destructive (DROP TYPE). Reversal would
    require restoring the old enum and re-mapping; not planned.
  - Every test fixture using a legacy status literal needs an
    update in the same PR. Scope of consumer changes spans
    services, routers, app routes, components, and tests.

- **Forward-only with backfill.** Every existing row migrates
  via the `USING` clause's `CASE`. No row is left with an
  unmappable value.

## Notes

- This ADR executes the reframe ADR-0005 noted as deferred.
  ADR-0005 already captured the reasoning for the target enum
  shape; this PR captures the concrete mapping + consumer
  migration plan agreed on 2026-05-04.
- The first-column-on-create logic (kanban tickets land on the
  Group's first `BoardColumn` automatically) is downstream and
  ships when Surface 1 lands. This PR just lays the enum
  groundwork.

## Related

- ADR-0005 — `RequestStatus` redesign target shape (this ADR
  executes).
- ADR-0006 — `BoardColumn` carries the workflow nuance that used
  to live in `claimed` vs `in_review`.
- ADR-0010 — `Request.type` nullable (PR 2g.1).
- ADR-0011 — drop claim trio (PR 2g.2).
- bu-coordination-board v0.4 — Tier-2 default #1.
