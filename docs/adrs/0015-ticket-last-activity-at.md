# ADR-0015 · `Request.lastActivityAt` — honest "Last activity" timestamp

**Status:** Proposed
**Date:** 2026-05-09
**Deciders:** Paul (product), Claude Code (this session)

## Context

The ticket detail page (`app/board/[groupSlug]/[ticketId]/page.tsx`)
renders a "Last updated X ago" label sourced from `Request.updatedAt`.
`updatedAt` is the Prisma `@updatedAt` magic column — it bumps on any
row mutation, but ticket activity rarely lives on the row itself.
Comments, notes, assignment changes, share/unshare, and lifecycle
status moves all write to neighbour tables (`Comment`, `Assignment`,
`RequestGroup`, `BoardColumn`-keyed updates); only some of those
flows happen to also touch the parent row.

The result: a ticket with five new comments today still says
"updated 3d ago" because the last `Request` row write was a
description edit three days ago. Tester feedback flagged this as
misleading — testers triage by recency, and the timestamp is lying
about what's alive.

The fix is to track activity (the visible work happening _around_
the ticket) on a dedicated column, separate from row-mutation
recency, so the displayed label can be honest.

## Options considered

- **Option A — typed `lastActivityAt` column on `Request`, bumped
  explicitly from each mutation router.** Add `Request.lastActivityAt:
DateTime` (NOT NULL after backfill, indexed DESC). Each tRPC
  mutation that performs a bump-event calls a single helper
  `touchRequestActivity(prisma, requestId)` after the primary write.
  `updatedAt` keeps its Prisma `@updatedAt` semantics for any
  internal consumer that depends on row-mutation recency.
- **Option B — Prisma middleware that bumps `lastActivityAt` on
  every write to a configured set of models.** One central
  registration; no per-router calls. Less explicit; harder to test
  in isolation; brittle when neighbour-table writes don't carry the
  parent `requestId` directly (e.g. `Assignment.requestId` is
  available, but `BoardColumn` moves go via `Request.columnId`
  itself, so it's already a Request write).
- **Option C — derive on read: `MAX(updatedAt)` over the parent +
  comment + assignment + share + lifecycle tables in every
  read query.** No schema change, but read-cost goes up linearly
  with surface count, and the kanban list query (which already
  joins `BoardColumn`, `Assignment`, `Comment` count) gets uglier.
  Indexes can't help with a multi-table `GREATEST` projection.
- **Option D — leave `updatedAt` as the displayed source; rename
  the label to "Last edited" and accept the limitation.** Cheapest;
  doesn't fix the underlying tester complaint. Triage view ("most
  recently active first") still has nothing real to sort by.

## Decision

Go with **Option A**. Add a typed `lastActivityAt` column to
`Request`, bumped explicitly by a small server-side helper called
from each tRPC mutation that performs a bump-event. Rename the
displayed UI label from "Last updated" to **"Last activity"**.

```prisma
model Request {
  // …
  /// Visible-activity recency. Bumped to now() on comment / note /
  /// status change / assignee change / share-unshare / title or
  /// description edit. Distinct from `updatedAt`, which is the
  /// Prisma-managed row-mutation timestamp. Indexed DESC so
  /// triage views ("most recently active first") stay fast.
  lastActivityAt DateTime @default(now())
  // …
  @@index([lastActivityAt(sort: Desc)])
}
```

### Bump events (the column moves to `now()` on)

- comment posted on the ticket
- note posted on the ticket (internal coordinator note)
- lifecycle status change — move-to-board, move-to-backlog, delete
- assignee added / removed (including Unassign)
- share with another team / unshare with another team
- description (`body`) edit
- title edit

### NOT bumped on

- silent metadata-only changes — DB migrations, system-driven
  re-indexing, audit-only backfills
- `lastHeartbeatAt` writes (presence-pattern, orthogonal — see
  ADR-0011)
- read events (subscription pings, view counts)

The principle: if it would be _visible to the team_ in the activity
sidebar or feed, it bumps `lastActivityAt`. If it's plumbing, it
doesn't.

### Implementation pattern

Server-side, in each tRPC mutation that performs a bump-event,
after the primary write call:

```ts
await touchRequestActivity(prisma, requestId);
// where the helper is:
//   prisma.request.update({
//     where: { id: requestId },
//     data: { lastActivityAt: new Date() },
//   })
```

The helper lives in `server/services/request.ts` (or a new
`server/services/request-activity.ts` if the existing file is
already busy). Each call site's PR is responsible for adding the
`touchRequestActivity` line in the same commit as the mutation
it instruments — this keeps the bump set auditable via grep.

Prisma middleware (Option B) is rejected as the default because:

- The bump set is heterogeneous (writes go via `Request`,
  `Comment`, `Assignment`, `RequestGroup`, `BoardColumn`-driven
  Request updates). A single middleware predicate has to special-
  case each surface anyway.
- Explicit calls make per-mutation testing trivial — assert the
  helper was invoked.
- Explicit calls make the bump set _visible_ in PR review. A
  middleware registration is a config change one removed level
  from the call site that depends on it.
- A middleware approach can be added later if the explicit set
  grows past ~10 call sites.

### Migration plan

Two migrations, sequenced:

1. **Add nullable column.**
   `prisma/migrations/<ts>_request_last_activity_at_nullable/migration.sql`:

   ```sql
   ALTER TABLE "Request" ADD COLUMN "lastActivityAt" TIMESTAMP(3);
   ```

2. **Backfill from `updatedAt`.** In the same migration file:

   ```sql
   -- Best honest approximation we have: on day-zero, set
   -- lastActivityAt to whatever the row's updatedAt is. From the
   -- next mutation onwards, the explicit bump-helper takes over.
   UPDATE "Request"
   SET "lastActivityAt" = "updatedAt"
   WHERE "lastActivityAt" IS NULL;
   ```

3. **Apply NOT NULL + default + index.** Follow-up migration:

   ```sql
   ALTER TABLE "Request" ALTER COLUMN "lastActivityAt" SET NOT NULL;
   ALTER TABLE "Request" ALTER COLUMN "lastActivityAt" SET DEFAULT now();
   CREATE INDEX "Request_lastActivityAt_desc_idx"
     ON "Request" ("lastActivityAt" DESC);
   ```

The backfill is idempotent in the D070 sense — re-running the
`UPDATE … WHERE "lastActivityAt" IS NULL` is a no-op once the column
is populated. The NOT NULL + default split into a follow-up keeps
the migration safe in environments where the column add and backfill
don't run in a single transaction.

### Consumer migration (same PR as schema change)

- `app/board/[groupSlug]/[ticketId]/page.tsx` — change the line
  `Last updated {formatDistanceToNow(ticket.updatedAt, …)}` to
  `Last activity {formatDistanceToNow(ticket.lastActivityAt, …)}`.
- `server/services/board.ts · getTicketDetail` — return
  `lastActivityAt` on the ticket payload alongside `updatedAt`
  (which stays — internal consumers may still want it).
- Bump-helper call sites (added incrementally per call-site, each
  in its own follow-up PR if scope allows):
  - `server/services/comment.ts` — comment + note creation
  - `server/services/board.ts` — status / column moves, title / body edits
  - `server/services/assignments.ts` — add / remove / Unassign
  - `server/services/request-group.ts` — share / unshare

## Reasoning

- **Honest by design.** Tester complaint is the canonical case
  for D047 (honest tracking only). A timestamp that lies is worse
  than no timestamp; the fix is to make the data match the label.
- **Separate the two semantics.** `updatedAt` answers "when did
  this row change?" — useful for caching, sync, and Prisma's
  built-in optimistic-concurrency patterns. `lastActivityAt`
  answers "when did the team last touch this work?" — useful for
  triage. Conflating them breaks both. Split keeps both honest.
- **Explicit beats implicit.** Per-mutation calls are louder in
  PR review than a middleware registration, and trivially
  testable. The cost is a single line of code per call site —
  acceptable.
- **Index for triage.** The kanban "what's alive?" view is the
  primary forward consumer. A DESC index on `lastActivityAt`
  keeps that query fast at scale; the write amplification (one
  extra UPDATE per bump-event) is well below the threshold where
  index maintenance becomes painful.
- **Backfill from `updatedAt` is the honest day-zero default.**
  Pre-existing rows have no real activity history; using
  `updatedAt` as the seed acknowledges that and lets the column
  start producing accurate values from the next bump-event onwards.

## Consequences

- **Easier:**
  - Triage view ("most recently active tickets first") gets a
    real column to sort by.
  - The displayed timestamp is honest — a ticket with five new
    comments shows "Last activity 2 minutes ago", not "Last
    updated 3 days ago".
  - Sets a clean precedent for activity-vs-row-state separation
    on other models (e.g. `Post.lastActivityAt` for
    feed-recency, if needed later).

- **Harder:**
  - One extra `UPDATE` per bump-event — small write amplification.
    Within tolerance: bump-events are member-driven, low-frequency
    relative to read traffic.
  - Discipline burden: every new mutation that produces visible
    activity must remember to call `touchRequestActivity`. The
    grep-for-call-sites pattern keeps it auditable, and the
    bump-event list above is the canonical reference. A future
    follow-up could add a lint rule that flags `Request`-touching
    mutations missing the helper call.
  - Backfill seed is approximate. Pre-existing rows that had
    comment activity after their last row mutation will show a
    less-recent `lastActivityAt` than reality on day zero. From
    day one onwards the column is exact.

- **Backwards compatibility:**
  - The displayed UI label changes from "Last updated" to
    "Last activity". Member-facing copy change, no API contract
    impact.
  - Existing API contracts that return `updatedAt` are unchanged;
    consumers depending on row-mutation semantics keep working.
  - Frontend reads the new field; old clients that don't know
    about `lastActivityAt` continue to read `updatedAt` and see
    the existing (misleading) value — acceptable transitional
    state.

- **Forward-only.** The migration is additive; rollback would
  require dropping the column and the index. No data loss risk
  (the column is derived).

## Notes

- The model is `Request`, not `Ticket` — kanban tickets are
  `Request` rows with `type = null` (per ADR-0010). All
  references in this ADR use the canonical Prisma model name.
- The ratchet-discipline (D020) requires schema changes go via
  ADR. This ADR is the gate; the build PR that consumes it adds
  the column, runs the migration, and wires the bump-helper to
  the first batch of call sites. Subsequent call sites can ship
  in follow-up PRs without re-opening this ADR — the bump-event
  list above is the contract.
- Related model precedent: `Request.lastHeartbeatAt` (presence
  pattern from ADR-0011) is a separate orthogonal column for a
  different purpose (realtime presence, not member-visible
  activity). Keeping them distinct.
- The renamed UI label ("Last activity") matches the language
  the testers themselves used in feedback ("a ticket with five
  new comments today still says updated 3d ago"). Member-facing
  copy: warm-but-direct, plain English (per global tone notes).

## Related

- ADR-0010 — `Request.type` nullable (kanban tickets carry `null`).
- ADR-0011 — drop claim trio; `lastHeartbeatAt` survives as a
  separate orthogonal field. Precedent for "this model carries
  multiple recency timestamps with different jobs."
- ADR-0013 / D079 — typed `Request.title` + `Request.body`. Title /
  body edits are bump-events under this ADR.
- D020 — engineering discipline; ADR-required for schema changes.
- D047 — honest tracking only. The principle this ADR makes
  literal for the per-ticket recency surface.
- D070 — reference data + idempotent migrations. The backfill
  follows the idempotency pattern.
- bu-coordination-board — the BU that ships the ticket detail
  view this ADR's label change targets.
