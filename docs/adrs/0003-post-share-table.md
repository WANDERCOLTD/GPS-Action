# ADR-0003 · Post-share counter table (`PostShare`)

**Status:** Proposed (becomes Accepted on first build PR)
**Date:** 2026-05-01
**Deciders:** Paul (product), Claude Code Session N (spec assembly)

## Context

Today's post share-out flow logs a `post_shared_out` analytics event
to stdout via `POST /api/analytics/share-intent` (the stub introduced
in **D067 / BU-whatsapp-share**). There is no persistence:

- Counts can't be displayed on the PostCard or post-detail page.
- Per-user "you've shared this" UX can't be computed.
- Admins can't audit reach for any post — every event is fire-and-
  forget log line.

The product brief **BU-post-share-counter** wants a verified counter
that ticks only when the member confirms "I sent it." Confirmation
follows the existing `PostPublishModal` "Did you send?" pattern,
extracted into a reusable dialog. Counts are aggregates of _people_
who confirmed a send, broken down by destination channel.

Eight design decisions were resolved during spec assembly (idempotency,
privacy, enum strictness, headline number, skip handling, logged-out
gating, abuse limits, display threshold) and are recorded in the
brief's resolved-decisions section. This ADR captures the schema
shape that those decisions imply.

`prisma/schema.prisma` is contract-locked (CLAUDE.md), so any new
table rides an ADR. This is that ADR.

## Options considered

- **Option A — JSON column on `Post`** carrying `{ whatsapp: 24, x: 14, … }`.
  - Pros: Compact, no new table, easy to read.
  - Cons: Atomic increment is racy under concurrent writes; not
    queryable per-user (so no "you've shared this" UX); enum drift
    is invisible to migrations; can't gate on `confirmedAt`.

- **Option B — Reuse `Notification`** rows with a synthetic
  notification kind for shares.
  - Pros: One less table.
  - Cons: `Notification` is push-out semantics (one row → one
    recipient delivery); shares are read-aggregation semantics
    (many rows → one count). Kind soup. Cascade rules would be
    backwards.

- **Option C — Sidecar `PostShare` table** keyed by
  `(postId, userId, destination)`, carrying `intentAt` +
  optional `confirmedAt`.
  - Pros: Idempotent via composite unique. Aggregation is a single
    `GROUP BY` join. Rate-limiting falls out of the upsert. Queryable
    per-user for the personal indicator. Enum is enforced at the DB
    level. Cascade-on-delete is straightforward.
  - Cons: One more table on `Post`. Aggregation query per feed render
    (mitigated by the GROUP BY join).

- **Option D — Hashed userId on a sidecar table** to anonymise.
  - Pros: Privacy-by-design for raw `userId`.
  - Cons: Loses the personal "you've shared on X" UX value (the
    viewer can't recover their own row from the hash without the
    server's secret, and once we expose that path we've reinvented
    raw userId with extra steps).

## Decision

We will adopt **Option C**: a sidecar `PostShare` table keyed by the
composite `(postId, userId, destination)`.

```prisma
enum ShareDestination {
  whatsapp
  x
  instagram
  facebook
  email
  copy_link
  other
}

model PostShare {
  id          String           @id @default(uuid())
  postId      String
  post        Post             @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId      String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  destination ShareDestination
  intentAt    DateTime         @default(now())
  confirmedAt DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@unique([postId, userId, destination])
  @@index([postId])
  @@index([postId, confirmedAt])
}
```

Field shape:

| Column        | Type               | Default      | Nullable | Notes                                                             |
| ------------- | ------------------ | ------------ | -------- | ----------------------------------------------------------------- |
| `id`          | `String` (uuid)    | uuid         | no       | Primary key; not member-facing.                                   |
| `postId`      | `String`           | —            | no       | FK → `Post.id`. Cascade-on-delete.                                |
| `userId`      | `String`           | —            | no       | FK → `User.id`. Cascade-on-delete. Never exposed publicly.        |
| `destination` | `ShareDestination` | —            | no       | Strict enum; must match `post_shared_out` event property.         |
| `intentAt`    | `DateTime`         | `now()`      | no       | Set on the share-button tap; updated on re-tap (within 30s noop). |
| `confirmedAt` | `DateTime?`        | —            | yes      | Set when member taps "I sent it." Null ⇒ intent-only.             |
| `createdAt`   | `DateTime`         | `now()`      | no       | Standard audit field.                                             |
| `updatedAt`   | `DateTime`         | `@updatedAt` | no       | Standard audit field.                                             |

Indexes:

- `@@unique([postId, userId, destination])` — enforces
  one-row-per-tuple. Recording an intent for an existing tuple
  updates `intentAt` (or no-op within the 30s rate limit).
- `@@index([postId])` — supports the per-post aggregation join.
- `@@index([postId, confirmedAt])` — supports the verified-only
  count query (`WHERE postId = ? AND confirmedAt IS NOT NULL`).

## Reasoning

- **Composite unique = idempotent free.** Resolved decision #1
  ("counts of people, not taps") falls out of the unique constraint
  with zero application-side logic. Recording an intent is an upsert;
  recording a confirm is an update WHERE matching the tuple.
- **Strict enum at the DB level** matches the existing
  `post_shared_out` analytics event property (resolved decision #4),
  and makes drift in either direction a Prisma type error rather
  than a silent string mismatch.
- **`confirmedAt` as nullable timestamp** rather than a Boolean
  flag means we can answer "when did they confirm" without a
  schema change later, supports verified-only queries cheaply
  (`WHERE confirmedAt IS NOT NULL`), and keeps the intent vs
  confirmed distinction in a single row (resolved decision #5).
- **Aggregate-only public exposure.** The service layer's
  `getShareCounts(postId)` returns `{ total, perChannel,
intentTotal }` — never `userIds`. Personal "you've shared on X"
  uses the same table but is gated to `currentUser.id === viewer`
  (resolved decision #3). `userId` raw in the DB is acceptable
  because no public response shape exposes it.
- **No PostGIS / no JSON.** This is a small relational shape; the
  GROUP BY aggregation cost is bounded by `posts × destinations`
  per page, which the existing `listPosts` join can absorb.
- **30-second rate limit** (resolved decision #8) is computed at the
  service layer (`if existing.intentAt > now - 30s: noop`). It is
  not enforced as a DB-level CHECK — too rigid for clock skew /
  edge cases — but the unique constraint guarantees correctness.

## Consequences

- **Easier:**
  - `getShareCounts(postId)` is a single GROUP BY query.
  - `listPosts` can include `shareCounts` via one extra join with
    no N+1 — a single `groupBy` over the page's post IDs.
  - Personal "you've shared on X" is `findMany({ where: { postId,
userId, confirmedAt: { not: null } } })` — trivial.
  - Cascade rules are right by default: deleting a Post or a User
    removes their PostShare rows.
  - Phase 1 ships independently; UI lands in later phases without
    schema churn.

- **Harder:**
  - One more table on the `Post` neighbourhood. The schema is
    already growing wide; this adds another peripheral.
  - Aggregation query per feed render (mitigated, but it's still a
    join the renderer didn't do before).
  - Enum drift requires a Prisma migration. We accept this — the
    enum is the contract.

- **Forward-only migration.** Single additive migration: new
  `ShareDestination` enum, new `PostShare` table, three indexes.
  No backfill (counts start empty on day one — D047 honest-tracking
  spirit).

- **Rollback path.** Drop the table and the enum; no `Post` or
  `User` schema is touched, so rollback is clean.

- **Privacy posture.** `userId` is raw in the DB; aggregation is
  the only public exposure path. The personal indicator surfaces
  the viewer's own rows only. This matches the trust posture of
  reactions (which also store `userId` raw and gate per-user
  exposure to the viewer themselves).

## Notes

- **Rate-limit logic is service-layer, not DB.** Bumping `intentAt`
  inside the 30s window is a noop; the unique row is preserved.
- **Bot/abuse guard** is intentionally light. The 30s window kills
  accidental double-fires; deliberate spam from a single user against
  a single post is bounded by the unique constraint (one row total).
  Cross-post spam is bounded by the auth gate (logged-out can't
  write).
- **Cascade-on-delete via `Post`.** When a post is deleted, its
  share rows go with it. This is the right behaviour for honest
  tracking — a deleted post has no reach to display.
- **Cascade-on-delete via `User`.** When a member account is deleted,
  their share rows go with it. Aggregate counts on existing posts
  drop accordingly. This is the right behaviour for GDPR/privacy.

## Related

- D016 — Self-dispatch via copy-and-deeplink (no Business API). The
  share-out mechanic this counter measures.
- D047 — Honest tracking only (no inflated reach numbers). The
  verified-vs-intent split is this principle made literal.
- D067 — WhatsApp share analytics stub. The endpoint this ADR
  upgrades from stdout to DB write.
- D070 — Reference data ships in migrations. Not directly relevant
  here (no new reference rows), but the same forward-only-migration
  spirit applies.
- D076 / ADR-0002 — Post location coords. Sister precedent for an
  additive Post-neighbourhood schema change in the same release.
- D077 (this PR) — the decision-log entry that cross-references
  this ADR.
- bu-post-share-counter brief — the implementation contract (4 phases).
