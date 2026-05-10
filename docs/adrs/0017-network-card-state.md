# ADR-0017 · NetworkCardState — own-side workflow state for the external network-feed surface

**Status:** Accepted
**Date:** 2026-05-10
**Deciders:** Paul

## Context

`bu-network-feed` (brief at `docs/build/session-briefs/bu-network-feed.md`)
introduces a new `/network` surface that renders the WhatsApp link feed
captured by Grant De Swardt (AIFA) from the **GPS Action Network!** group.
The data flow is:

```
WhatsApp → Whapi.cloud → Supabase (Grant's project)
                          │
                          ▼
                  public.gps_group_messages   ← read-only Postgres view
                          │
                          ▼
              GPS Action tRPC proxy → /network
```

Grant's view is **read-only by design**. The integration doc explicitly
calls it out (PAUL_INTEGRATION.md, "Quirks to know" §4):

> The view is read-only by design. Don't try to write to it. If you want
> to mark cards as "triaged" or move them on a Kanban, store that state
> in your own table (e.g. `gps_card_state(message_id, status, owner)`)
> and join. I'd recommend you own the workflow state, not us.

This ADR captures **how** we own that workflow state on the GPS Action
side. The brief locks the _that_ — this ADR locks the _what_.

The state we need to track per card:

- **Triage status** — has anyone looked at this card? Is it being
  chased? Has it been promoted to a GPS Action post? Discarded as
  irrelevant?
- **Owner** — which coordinator is currently chasing this card, if
  anyone (one global queue in v1; per-user queues are a future
  schema-forward-compatible extension).
- **Notes** — optional free-text annotation for the chasing
  coordinator.
- **Audit timestamps** — when the row was created, when it was last
  updated.

## Options considered

- **A. Store the state on Grant's side.** Add columns to his view
  or a sibling table he exposes. Rejected: it's their territory; they
  shouldn't be running our triage loop. Also breaks the "view is
  read-only" contract that protects the upstream pipe from our writes.
- **B. Extend Grant's view to expose state from a federated query.**
  Same problem as A, plus it forces Postgres-to-Postgres FDW or a
  materialised join — operational complexity for negligible benefit.
- **C. Own the state in a new GPS Action table, joined client-side
  in our tRPC proxy.** Each card on `/network` is the result of joining
  Grant's `gps_group_messages` row (by `id`) against our local state
  row (by `messageId`). Selected.

## Decision

We will introduce a new Prisma model `NetworkCardState` in our own
database, joined to Grant's view via an **opaque BigInt key**.

### 1. Schema

```prisma
enum NetworkCardStatus {
  NEW         // default — not yet triaged
  TRIAGED     // someone looked, no action chosen yet
  PROMOTED    // promoted to a GPS Action post
  DISCARDED   // not relevant
}

model NetworkCardState {
  id          String            @id @default(uuid())
  messageId   BigInt            @unique  // join key into gps_group_messages.id
  status      NetworkCardStatus @default(NEW)
  ownerUserId String?
  ownerUser   User?             @relation("networkCardsOwned",
                                          fields: [ownerUserId],
                                          references: [id],
                                          onDelete: SetNull)
  notes       String?           @db.Text
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  @@index([status])
  @@index([ownerUserId])
}
```

### 2. `messageId` is opaque, not a foreign key

Grant's `gps_group_messages.id` is a `BIGINT` in _his_ Supabase project.
We treat it as an opaque identifier — no cross-provider FK, no
referential integrity at the database layer. Reasons:

- The two tables live in different Postgres clusters (his Supabase,
  our AWS RDS). Cross-cluster FKs are a non-feature in Postgres.
- The integration is a **read-through cache + state join**, not a
  replicated dataset. We don't have a copy of his rows; we ask his
  view for them on each query.
- If Grant ever rebuilds the pipe with new ids, we don't want a
  schema-level constraint to block our state from surviving. The
  fallout is a one-time reconcile (or a clean-slate state wipe), not
  a migration outage.

`@unique` enforces _one state row per upstream message id_ on our
side. That's enough.

### 3. Orphan tolerance

When Grant marks a row `hidden = true` upstream, the view stops
returning that row. Our state row (if any) for that `messageId`
becomes orphaned — harmless, but unreferenced. We do **not** sweep
orphans automatically in v1:

- Volume is tiny (5–10 cards/day, hides are rare).
- The join in our tRPC proxy is keyed on the upstream side — orphans
  simply never appear in query results.
- Sweeping requires a periodic poll of the upstream view, which
  duplicates the read traffic the cache already does for `/network`.
  Not worth the complexity at v1 volume.

If volume materially grows, a reconcile job (sweep state rows whose
`messageId` is no longer in the 90-day upstream window) is a
follow-up — parking-lot, not blocking.

### 4. `ownerUserId` is nullable + indexed

V1 is a _single global queue_. Every coordinator sees every card; the
`status` is the primary triage signal. `ownerUserId` is reserved for
the v2 affordance "Bette is chasing this" — schema-forward-compatible
without a migration. Indexed so a future per-user query
(`WHERE ownerUserId = ?`) doesn't need a backfill index.

`onDelete: SetNull` so a deleted user gracefully unassigns rather
than cascading-deleting the card history.

### 5. No soft delete

A discarded card is still a card. `DISCARDED` is a status, not a
deletion. The row stays so the audit story is "Sharon discarded this
2 days ago," not "this card silently vanished." If a coordinator
wants to _undo_ a discard, they flip the status back to `NEW` or
`TRIAGED`.

`deletedAt` is intentionally absent. We have no "delete the card
state forever" path in v1; if one ever materialises (e.g. GDPR
right-to-erasure on a card containing a member's name), it'll be a
hard delete via admin tooling, not a soft tombstone.

### 6. No FK across to FeatureFlag, AuditLog

The state mutations (`network.setCardState`) will write to `AuditLog`
via the existing helper, but `NetworkCardState` itself doesn't carry
audit fields beyond `createdAt`/`updatedAt`. Standard pattern across
the schema (see `Reaction`, `Comment`, `Assignment` — none carry
inline audit columns; `AuditLog` is the canonical surface).

### 7. Migration

`20260510120000_add_network_card_state/migration.sql` creates the
enum, the table, the unique + secondary indexes, and the FK to
`User`. No backfill required — the table starts empty; existing
upstream rows (the 163 historical cards) have no state row and
default to `NEW` at read time when no row is found.

### 8. Read-time defaulting (proxy-layer detail)

The tRPC `network.list` procedure returns each upstream row with its
state attached. When no state row exists for a given `messageId`,
the proxy returns `{ status: 'NEW', ownerUserId: null, notes: null }`
without writing a row. Rows are **only created on first state
mutation** — this keeps the table tight (only triaged cards have a
row) and makes the "163 historical NEW cards" case a no-cost default
rather than a 163-row backfill.

## Reasoning

- **Owning state is the right side of the boundary.** Grant's pipe is
  a content source; the workflow loop (who's chasing what) is
  product surface. The two should not be coupled at the data layer.
- **Opaque BigInt is the simplest cross-provider join.** Cross-cluster
  FK constraints don't exist; trying to fake them with a triggered
  copy table would multiply complexity for no reliability gain.
- **Single-queue v1, per-user-ready schema.** The `ownerUserId` field
  is nullable and indexed from day one so a future per-user
  affordance ("My triage queue") needs only router/UI work, no
  schema work.
- **No soft delete keeps the read path simple.** Other tables that
  use `deletedAt` (e.g. `Comment`, `RequestSubscription`) need
  `WHERE "deletedAt" IS NULL` predicates everywhere. The network-feed
  proxy has enough join complexity already; not adding more.
- **Lazy state-row creation.** The "no row = NEW status" convention
  means the 163 backfilled cards don't need a 163-row state seed,
  and the table only grows with actual triage activity. Compact.

## Consequences

- **Schema commitment.** A new model + enum + migration land. The
  migration is reversible (`DROP TABLE` + `DROP TYPE`); state data is
  reproducible from triage activity, so the cost of a rollback is
  bounded.
- **Two-source-of-truth read path.** Each `/network` page render
  joins our `NetworkCardState` against Grant's view via the tRPC
  proxy. The join is in application code, not SQL. Performance is
  trivial at v1 scale (~600 upstream rows, ≤600 state rows).
- **Cross-provider migration story is now ours to manage.** If Grant
  ever swaps the pipe for a different ingest source with different
  ids, our state rows become stale and need a reconcile or a wipe.
  This is a real-but-low-probability cost of the opaque-key approach.
  Documented here so the next maintainer knows what they own.
- **Forward-compatible for per-user queues.** The `ownerUserId` field
  is in place; v2 routes (`/network/mine`, "claim this card"
  mutations) need no schema work.
- **Forward-compatible for promote-to-post linking.** A future
  follow-up may want to capture _which_ GPS Action post a `PROMOTED`
  card became. That's a `promotedToPostId String?` column — pure
  ALTER ADD COLUMN, no behaviour change for existing rows. Out of
  scope for this ADR.
- **Audit lives on `AuditLog`, not inline.** Mutation routers will
  write to `AuditLog` per the existing pattern. New action codes
  (`network_card.triage`, `network_card.promote`,
  `network_card.discard`) follow the dotted convention and don't
  need a separate audit table.
- **Feature-flag gating.** The whole surface is behind
  `network_feed` (D036). The schema lands regardless of flag state —
  empty tables on a flag-off DB are zero-cost.

## Notes

- Grant's row id is a `BIGINT`. Prisma supports `BigInt`. TypeScript
  surfaces it as the native `bigint` primitive; the tRPC layer must
  serialise it as a string at the wire boundary (use the existing
  `superjson` transformer, which already handles `bigint`).
- The integration doc on disk
  (`~/Downloads/PAUL_INTEGRATION.md`) currently shows `from_jid` in
  the column list and no `sender_hash`. Grant's reply 2026-05-10
  confirms the live view exposes `sender_hash` and dropped
  `from_jid`. The brief blocks `ready` on column-shape verification.
  This ADR is independent of that resolution — it pins the _own-side_
  schema, which doesn't depend on the upstream column projection.
- Brief: `docs/build/session-briefs/bu-network-feed.md` (currently
  `status: stub`). The brief's prior placeholder reference to
  "ADR-0011" is corrected to ADR-0017 — the next available number;
  ADR-0011 was already taken by `coord-board-drop-claimed-by`.

## Related

- D036 — Feature-flag discipline (`network_feed` is registered with
  the discipline rules).
- D070 — Reference data lives in migrations, not seeds. The
  `network_feed` flag follows the pattern.
- D082 — (latest existing decision; this ADR registers under D083).
- ADR-0014 — `KanbanEventConfig` (recent precedent: own-side config
  table, indexed by an enum, simple shape).
- Brief: `bu-network-feed` — consumes this ADR.
- Integration doc: Grant's `PAUL_INTEGRATION.md` (locally at
  `~/Downloads/PAUL_INTEGRATION.md`); single source of truth for the
  upstream column shape.
