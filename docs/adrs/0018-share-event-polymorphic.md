# ADR-0018 · Polymorphic share-counter table (`ShareEvent`)

**Status:** Proposed (becomes Accepted on first build PR — this PR, Phase A)
**Date:** 2026-05-11
**Deciders:** Paul (product), Claude Code Session

## Context

D077 / ADR-0003 proposed a `PostShare` sidecar table keyed by
`(postId, userId, destination)` to count verified per-post shares. The
brief `bu-post-share-counter` carried the implementation plan but its
build phases never landed — status remains `planned` as of 2026-05-11.

In the intervening fortnight, two adjacent shareable surfaces have
materialised:

- **Network cards** (`bu-network-shares` — speced in the network-
  engagement brief groom of 2026-05-10): coordinators want share counts
  on cards triaged from Grant's Supabase pipe (ADR-0017 /
  NetworkCardState).
- **Comments** (deep-link reply, parking-lot): already shareable via
  URL but uncounted.

If the original PostShare design ships and each new surface follows
the same pattern, we end up with a parallel table per shareable thing
(`PostShare`, `NetworkCardShare`, `CommentShare`, …) — each with its
own service, endpoint, projection, and dashboard query. A
"shares-by-user-this-week" report becomes an N-way UNION.

The Reaction layer faced the same fork in D052 and chose
polymorphism: `Reaction.targetType` discriminates between `post` and
`comment`, with typed nullable FKs (`postId`, `commentId`) preserving
the cascade contract. That decision has held — adding `comment` to
`ReactionTargetType` was a one-line schema change, no parallel table.

Because PostShare never shipped, we can collapse ADR-0003's design
into the polymorphic shape now, before any consumer exists.
`prisma/schema.prisma` is contract-locked (CLAUDE.md) so this rides
its own ADR; D077 is left in place as the historical decision that
this ADR supersedes for the table-shape question.

## Options considered

- **Option A — Ship PostShare as ADR-0003 specifies; abstract later.**
  - Pros: Smallest first BU. Existing ADR-0003 doc still authoritative.
  - Cons: We know two more share surfaces are coming this quarter.
    Refactoring after three consumers materialise is the trap D052
    avoided. Reactions and shares end up structurally divergent —
    higher cognitive load.

- **Option B — Per-target shadow tables (`NetworkCardShare`, `CommentShare`).**
  - Pros: Each table is the simplest possible shape — no discriminator.
  - Cons: Linear cost in consumers. Cross-target queries require
    UNIONs. Per-target services duplicate the rate-limit logic,
    privacy gates, and analytics emission of the verified-vs-intent
    split.

- **Option C — Polymorphic `ShareEvent(targetType, targetId)` plus
  typed nullable FKs, mirroring the Reaction layer.**
  - Pros: One table, one service, one analytics endpoint. New share
    surfaces are a `ShareTargetType` enum value + one nullable FK.
    Cross-target queries are a single `GROUP BY`. Structural symmetry
    with reactions reduces cognitive load.
  - Cons: Polymorphic discriminator adds one column. Per-target
    integrity (e.g. `targetType='post' ⇒ postId IS NOT NULL AND
postId = targetId`) is a service-layer invariant, not a DB CHECK.
    This is the trade Reactions made and operates cleanly.

- **Option D — Single-table inheritance with a JSON payload.**
  - Pros: No schema churn per surface.
  - Cons: Loses enum-level DB enforcement on `destination`, breaks
    cascade-on-delete from the parent, makes aggregation join-heavy
    rather than relational. Rejected by the same reasoning as
    ADR-0003 Option A.

## Decision

We will adopt **Option C** — a polymorphic `ShareEvent` table that
supersedes the never-built `PostShare` table from ADR-0003. The shape
mirrors the Reaction layer (D052):

```prisma
enum ShareTargetType {
  post
  // network_card — enabled by bu-network-shares
  // comment, profile, group — enabled by their future BUs
}

enum ShareDestination {
  whatsapp
  x
  instagram
  facebook
  email
  copy_link
  other
}

model ShareEvent {
  id String @id @default(uuid())

  userId String
  user   User   @relation("authorShareEvents", fields: [userId], references: [id], onDelete: Cascade)

  targetType ShareTargetType
  targetId   String

  postId String?
  post   Post?   @relation("postShareEvents", fields: [postId], references: [id], onDelete: Cascade)

  networkCardStateId BigInt?
  networkCardState   NetworkCardState? @relation("networkCardShareEvents", fields: [networkCardStateId], references: [messageId], onDelete: Cascade)

  destination ShareDestination
  intentAt    DateTime  @default(now())
  confirmedAt DateTime?

  legacyPostShareId String? @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([targetType, targetId, userId, destination], name: "share_event_unique")
  @@index([targetType, targetId, destination])
  @@index([userId, intentAt])
  @@index([postId])
  @@index([networkCardStateId])
}
```

Field-shape table:

| Column               | Type               | Default      | Nullable | Notes                                                                    |
| -------------------- | ------------------ | ------------ | -------- | ------------------------------------------------------------------------ |
| `id`                 | `String` (uuid)    | uuid         | no       | Primary key; not member-facing.                                          |
| `userId`             | `String`           | —            | no       | FK → `User.id`. Cascade-on-delete. Never exposed publicly.               |
| `targetType`         | `ShareTargetType`  | —            | no       | Polymorphic discriminator.                                               |
| `targetId`           | `String`           | —            | no       | Stringified parent id; BigInt-safe (network cards use BigInt messageId). |
| `postId`             | `String?`          | —            | yes      | Typed FK; non-null when targetType='post'. Cascade-on-delete.            |
| `networkCardStateId` | `BigInt?`          | —            | yes      | Typed FK; non-null when targetType='network_card'. Cascade-on-delete.    |
| `destination`        | `ShareDestination` | —            | no       | Strict enum; mirrors `post_shared_out` analytics property.               |
| `intentAt`           | `DateTime`         | `now()`      | no       | Set on the share-button tap; updated on re-tap (within 30s noop).        |
| `confirmedAt`        | `DateTime?`        | —            | yes      | Set when member taps "I sent it." Null ⇒ intent-only.                    |
| `legacyPostShareId`  | `String?`          | —            | yes      | Back-compat trace-back to a PostShare row id (Phase C drops this).       |
| `createdAt`          | `DateTime`         | `now()`      | no       | Standard audit field.                                                    |
| `updatedAt`          | `DateTime`         | `@updatedAt` | no       | Standard audit field.                                                    |

Indexes:

- `@@unique([targetType, targetId, userId, destination])` — idempotency
  per-target, per-user, per-destination. Recording intent on an
  existing tuple updates `intentAt` (or no-ops within the 30s rate
  window).
- `@@index([targetType, targetId, destination])` — supports the
  primary aggregation join.
- `@@index([userId, intentAt])` — supports "shares by user across all
  surfaces" reports.
- `@@index([postId])`, `@@index([networkCardStateId])` — typed FK
  lookups for the per-target service paths.
- `legacyPostShareId @unique` — supports the parity-check join during
  the Phase A/B window.

### Three-phase migration

The brief splits the work into three independently shippable PRs:

#### Phase A — additive (this PR)

1. Create `ShareTargetType` enum with `post` value only.
2. Create `ShareDestination` enum (would have shipped with PostShare).
3. Create `ShareEvent` table with the final shape plus
   `legacyPostShareId`.
4. Defensive backfill: a `DO $$` block in the migration copies any
   existing `PostShare` rows into `ShareEvent`. Because PostShare was
   never built this is a no-op on first deploy, but the block is
   conditional on `information_schema.tables` so the migration
   succeeds either way.
5. No service/route/UI changes. `/feed` counters continue to read
   from `PostShare` if it exists; today's counters render unchanged
   (i.e. continue to be unrendered — the consumer never landed).

#### Phase B — swap (next PR)

1. Service layer dual-writes: every `recordShareIntent` /
   `confirmShareSent` writes both to `PostShare` (if present) and to
   `ShareEvent`. Lasts one PR cycle.
2. Read paths flip: any future `listPosts` projection that joins
   share counts joins `ShareEvent` instead of `PostShare`.
3. `app/api/analytics/share-intent/route.ts` accepts both shapes
   (`{ postId }` and `{ targetType, targetId }`).
4. All references to `post-share.ts` migrate to `share-event.ts`.

#### Phase C — cleanup (PR after B is parity-stable for 48h+)

1. Stop dual-write.
2. Parity-check script (`scripts/verify-share-event-parity.ts`)
   confirms `COUNT(PostShare) = COUNT(ShareEvent WHERE
targetType='post')` AND every PostShare row joins via
   `legacyPostShareId`.
3. Drop `PostShare` table (if it exists by then) and the enum it
   carried.
4. Drop `ShareEvent.legacyPostShareId` column.

Each phase is independently rollback-able. See Consequences below.

## Reasoning

- **Polymorphism mirrors Reactions (D052).** Both engagement layers
  ("how did members react / share?") now follow the same
  `targetType + targetId + typed nullable FK` pattern. A new shareable
  surface adds one enum value and one nullable FK — same drill as
  adding `comment` to ReactionTargetType.

- **Typed FKs preserve the cascade contract.** Pure-discriminator
  designs (`targetType` + plain `targetId String`) lose Postgres's
  ON DELETE CASCADE. By keeping `postId` / `networkCardStateId` as
  typed nullable FKs, deleting a post or a network card automatically
  drops its share rows — matching the Reaction layer's behaviour and
  the spirit of ADR-0003's cascade choices.

- **`targetId` is `String`.** Network cards use `BigInt messageId`
  as their natural key; posts use `String uuid`. Stringifying at the
  discriminator level means a single index serves all target types
  and cross-target reports don't need type coercion. The typed FKs
  (`networkCardStateId BigInt?`, `postId String?`) keep the database-
  level types correct on the join.

- **Three-phase migration over big-bang.** A single migration that
  renames PostShare and adds polymorphism is too invasive: it touches
  schema + service + endpoint + UI in one PR with no clean rollback
  if a downstream consumer fails. Three additive PRs give each phase
  its own parity gate.

- **`legacyPostShareId` ships nullable + unique.** Brief specified
  `BigInt? @unique` but ADR-0003's `PostShare.id` is `String @id
@default(uuid())` — String is the type-correct shape. Marked here
  as a deliberate deviation from the brief's literal text in
  service of contract correctness.

- **Defensive backfill.** Because PostShare was never built, today's
  migration backfills zero rows. The backfill block is conditional
  on `PostShare` existing so the migration is safe whether or not a
  parallel branch ships PostShare first.

- **Honest-tracking preserved (D047).** The verified-vs-intent split
  is the same — `confirmedAt` is the only column the public counter
  reads. The intent total stays inside breakdown tooltips for
  transparency. Polymorphism doesn't touch this.

## Consequences

- **Easier:**
  - Adding a new shareable surface is a one-line `ShareTargetType`
    enum value + one nullable typed FK + one index.
  - "Shares by user this week across all surfaces" is one GROUP BY,
    not a UNION.
  - The Reactions and ShareEvent layers are structurally identical —
    one mental model for both engagement primitives.
  - `/data/shareEvent` admin browser is one entity, filterable by
    `targetType`.

- **Harder:**
  - The (`targetType='post'` ⇒ `postId IS NOT NULL` AND `postId =
targetId`) invariant is service-layer, not DB-CHECK. Reactions
    operate this trade cleanly; we accept the same compromise here.
  - One additional polymorphic column (`targetType`) over the
    ADR-0003 shape.
  - Phase B requires care: the service-layer dual-write must be
    transactional and idempotent. A blown dual-write is a parity-check
    failure, not a counter bug; the script's role is to catch it
    before Phase C cleanup is shippable.

### Rollback per phase

- **From Phase A:** `DROP TABLE "ShareEvent"; DROP TYPE
"ShareTargetType"; DROP TYPE "ShareDestination";` — `Post`, `User`,
  and `NetworkCardState` are untouched. Clean rollback.
- **From Phase B:** revert the PR; the service-layer dual-write
  stops; reads flip back to `PostShare`. `ShareEvent` rows accrued
  during the dual-write window are harmless (still satisfy the
  unique constraint; legacyPostShareId continues to point at the
  source row). If we re-roll-forward later, no data loss.
- **From Phase C:** no automatic rollback once `PostShare` is
  dropped. Mitigation: Phase C is gated on Phase B running for
  48h+ with the parity script returning OK on every CI run, AND a
  manual `pg_dump` of `PostShare` taken at the swap. If a rollback
  becomes necessary post-Phase-C, the dump restores the table; the
  legacy code path is regenerated from the Phase B branch.

### Privacy posture

Unchanged from ADR-0003. `userId` is stored raw; aggregate-only
public exposure; personal "you've shared on X" is gated to
`currentUser.id === viewer.id`. The cascade rules ensure GDPR-style
account-delete propagates to share rows.

## Notes

- **D077 supersession.** D077 (this ADR's predecessor) chose
  `PostShare` as the table name and the per-post shape. This ADR
  supersedes D077 for the schema-shape question. The verified-vs-
  intent semantics, idempotency-via-unique-constraint, and 30s
  rate-limit rules from D077 are preserved verbatim — they were
  always orthogonal to the table-shape question.

- **ADR number gap.** The brief's prose said "ADR-0006." ADR-0006
  is already taken (`coord-board-board-column`). The next free slot
  is 0018; using that.

- **Brief deviation: `legacyPostShareId` type.** Brief literally said
  `BigInt? @unique`. PostShare's id is `String @id @default(uuid())`
  per ADR-0003 — `String?` is the type-correct shape. Recorded here
  as a deliberate deviation; the brief author is the same human who
  will review this PR.

## Related

- D047 — Honest tracking only (verified vs intent split preserved).
- D050 — Reactions primitive (sibling engagement layer).
- D052 — Comment polymorphic reuse of ReactionTargetType — the
  precedent this ADR follows.
- D067 — WhatsApp share analytics stub (the endpoint Phase B
  upgrades).
- D077 / ADR-0003 — PostShare table (superseded by this ADR for the
  schema-shape question).
- D083 / ADR-0017 — NetworkCardState (the FK target for the
  `network_card` enum value enabled by a later BU).
- bu-share-event-polymorphic brief — the implementation contract
  (three-phase plan).
- bu-post-share-counter brief — the original consumer brief (never
  built; this ADR collapses its design into the polymorphic shape).
