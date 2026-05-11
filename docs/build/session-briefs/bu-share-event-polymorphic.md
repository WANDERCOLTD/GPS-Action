---
slug: bu-share-event-polymorphic
status: shipped
phase: 2
priority: high
shipped_in: "#332"
note: "Polymorphic ShareEvent table shipped in a single PR. Phase B/C of the brief became no-ops because PostShare (D077 / ADR-0003) was spec-only and never landed — there was no legacy table to swap/drop. ShareEvent ships as the universal share counter from day one for any future surface (network-shares, comment-shares, etc.)."
---

# SESSION BRIEF · bu-share-event-polymorphic — polymorphic share counter

_Author: Paul + Claude · Created: 2026-05-11_
_Type: Schema refactor under an ADR. Three-phase migration (additive → swap → cleanup). No new feature on the user surface — pure plumbing._

---

## 1 · Business Analyst — why this matters

### The problem in plain language

Per D077 / ADR-0003, the just-shipped `PostShare` table counts verified
shares per post — `{ postId, userId, destination, confirmedAt }` with
a unique composite on `(postId, userId, destination)`. It works
beautifully for `/feed` posts.

It does **not** work for any other shareable thing. `bu-network-shares`
wants to count shares of network cards. Comments are already shareable
in the UI (deep-link reply). Future surfaces (profile shares, group
shares) are visible in the parking lot. Each new surface would need:

- A parallel table (`NetworkCardShare`, `CommentShare`, ...)
- A parallel service (`server/services/network-card-share.ts`, ...)
- A parallel analytics endpoint, or fragile `if (postId)` branching
- Parallel dashboard projections
- A `UNION` across N tables to ask "how many shares did this user make
  this week?"

That's a maintenance trap. Better to polymorphic-ise PostShare **now**
while D077 is still fresh — touch-points are small (one service, one
endpoint, one component group).

### Why this matters now

1. **D077 shipped less than two weeks ago.** Touch-points haven't
   proliferated. The next BU (`bu-network-shares`) is the second
   consumer — refactoring before that lands beats refactoring after.
2. **Comments and profile shares are coming.** Parking-lot signals
   indicate both. If we land three concrete tables, the cost to
   abstract grows roughly linearly with consumers.
3. **The reaction layer already proved the pattern.** Reactions are
   polymorphic (`post | comment | network_card`). Symmetry with the
   share layer reduces cognitive load — both engagement layers obey
   the same `targetType + targetId` shape.

### Who benefits

- **The next two BUs** (`bu-network-shares`, eventual comment-share
  counter): no schema work, just a new enum value.
- **The data-inspector** (`/data/shareEvent`): one entity to browse,
  filterable by `targetType`.
- **Future analytics:** "shares by user across all surfaces this week"
  is one query, not a UNION.

### Success looks like

- `PostShare` is gone (renamed and reshaped to `ShareEvent`).
- `/feed` share counts and the verified-send dialog behave **exactly**
  as before — zero observable change for members.
- `bu-network-shares` can land with **no schema work** — just a new
  enum value and the share-rail mount.
- One service, one endpoint, one component group powers all share
  counters.

---

## 2 · Tech Lead — the design

### Schema (final shape)

```prisma
enum ShareTargetType {
  post           // existing rows migrated from PostShare
  network_card   // unlocked for bu-network-shares
  // comment, profile, group ... add when their BU lands
}

model ShareEvent {
  id String @id @default(uuid())

  userId String
  user   User   @relation("authorShareEvents", fields: [userId], references: [id], onDelete: Cascade)

  targetType ShareTargetType
  targetId   String            // stringified parent id; bigint-safe

  postId             String?
  post               Post?              @relation("postShareEvents", fields: [postId], references: [id], onDelete: Cascade)

  networkCardStateId BigInt?
  networkCardState   NetworkCardState?  @relation("networkCardShareEvents", fields: [networkCardStateId], references: [messageId], onDelete: Cascade)

  destination ShareDestination
  intentAt    DateTime  @default(now())
  confirmedAt DateTime?

  @@unique([targetType, targetId, userId, destination], name: "share_event_unique")
  @@index([targetType, targetId, destination])
  @@index([userId, intentAt])
}
```

(`ShareDestination` enum unchanged from D077.)

### Migration — three phases, three migrations

The rename + reshape is invasive enough that doing it in a single
migration is too risky. Split into three additive forward-only
migrations, each shippable independently:

#### Phase A — additive (no behaviour change)

1. Create `ShareTargetType` enum with `post` value only.
2. Create `ShareEvent` table mirroring final shape, **plus** a back-
   compat `legacyPostShareId` nullable column for trace-back.
3. Backfill: `INSERT INTO ShareEvent (...) SELECT ..., 'post', postId
   AS targetId, postId, NULL, ..., id AS legacyPostShareId FROM
   PostShare`.
4. Both tables coexist; reads still come from `PostShare`.

#### Phase B — swap (atomic dual-write → read-from-new)

1. Service layer dual-writes: every insert/update to `PostShare`
   also writes to `ShareEvent`. Lasts one PR cycle.
2. Read paths flip: `listPosts` projection joins `ShareEvent`
   instead of `PostShare`.
3. UI / endpoint / component layer touched here — all references to
   `post-share.ts` become `share-event.ts`.

#### Phase C — cleanup (drop legacy)

1. Stop dual-write.
2. Verify counter parity via a SQL diff: `SELECT COUNT(*) FROM
   PostShare` should equal `SELECT COUNT(*) FROM ShareEvent WHERE
   targetType='post'`.
3. Drop `PostShare` table.
4. Drop `ShareEvent.legacyPostShareId` column.

Each phase is one PR. Phase A is safe to ship instantly; B requires
a coordinator-confirmed parity check in `/data/shareEvent`; C requires
B to be live for ≥48h with parity holding.

### ADR

This brief produces a new ADR — **ADR-0006 (share-event-polymorphic)**
— alongside the schema. Inputs:

- D077 / ADR-0003 — the table being renamed
- D052 — precedent for polymorphic reactions (same pattern, same
  rationale)
- D047 — honest tracking principle (preserved verbatim — verified
  vs intent split is unchanged)

### Service layer

Rename `server/services/post-share.ts` → `server/services/share-event.ts`.
Existing exports keep their names for one PR (re-export from
`post-share.ts` as a barrel during Phase B) so external callers can
migrate at their own pace.

New service signature:

```ts
export async function recordShareIntent(args: {
  userId: string;
  targetType: ShareTargetType;
  targetId: string;
  destination: ShareDestination;
}): Promise<ShareEvent>;

export async function confirmShareSent(args: {
  userId: string;
  targetType: ShareTargetType;
  targetId: string;
  destination: ShareDestination;
}): Promise<ShareEvent>;
```

The 30s-noop service-level rate limit (D077 §"abuse limits") is
preserved.

### API endpoint

`POST /api/analytics/share-intent` — extend request schema to accept
`targetType` and `targetId` instead of `postId`. Back-compat: if
`postId` is present, derive `targetType: 'post', targetId: postId`.
Drop back-compat in Phase C.

### Layer boundaries

- `prisma/schema.prisma` (db) — phase A + C
- `prisma/migrations/<ts>_*/` (db) — three migrations
- `server/services/share-event.ts` (model) — renamed
- `server/services/post-share.ts` (model) — barrel re-exports through phase B, deleted in C
- `app/api/analytics/share-intent/route.ts` (controller) — schema extension
- `shared/validation/share-event.ts` (shared) — new zod target enum

No view-layer changes in this brief — those come in
`bu-network-shares`.

### Tests

- **Migration parity** — a one-shot script `scripts/verify-share-event-parity.ts`
  runs in CI on phase A and phase B PRs, asserts `PostShare` rows
  match `ShareEvent` rows where `targetType='post'`.
- **Unit** — service-level rate limit still 30s, both intent and
  verified paths.
- **Integration** — D077's existing test suite passes verbatim against
  the renamed service (this is the regression bar).
- **API contract** — `share-intent` endpoint accepts both old
  (`postId`) and new (`targetType+targetId`) shapes during phase B.

### Rollback

- **From phase A:** drop `ShareEvent` table, drop enum. PostShare is
  untouched.
- **From phase B:** revert PR; service dual-write stops; reads go back
  to `PostShare`.
- **From phase C:** harder — no automatic rollback once `PostShare` is
  dropped. Mitigation: phase C is gated on phase B being parity-stable
  for 48h+ AND a manual `pg_dump` of `PostShare` taken at the swap.

---

## Scope

### Build in this session (per phase, three PRs total)

**Phase A PR:**
- `prisma/schema.prisma` — add `ShareTargetType` enum, add `ShareEvent` model (mirroring final shape, plus `legacyPostShareId`)
- `prisma/migrations/<ts>_create_share_event/migration.sql` — create + backfill
- `scripts/verify-share-event-parity.ts` — parity checker
- `tests/unit/share-event-parity.test.ts`
- ADR-0006

**Phase B PR:**
- `server/services/share-event.ts` (renamed from post-share.ts, dual-write enabled)
- `server/services/post-share.ts` — barrel re-export
- `app/api/analytics/share-intent/route.ts` — accept both shapes
- `server/services/listPosts.ts` (or wherever) — read from ShareEvent
- All component touch-points updated to import from share-event.ts
- `tests/integration/share-event-router.test.ts`

**Phase C PR:**
- `prisma/migrations/<ts>_drop_post_share/migration.sql` — drop legacy column + table
- `prisma/schema.prisma` — remove `PostShare` model
- `server/services/post-share.ts` — deleted
- Cleanup all `legacy*` references

### Do NOT touch

- `components/PostShareGroup.tsx` (visual rail — that's bu-network-shares' job to parameterise)
- `components/ShareConfirmDialog.tsx` (already generic enough)
- `Post` or `User` schemas (unchanged)
- Any /feed-specific copy or layout

## Acceptance criteria (per phase)

**Phase A — additive:**
- [ ] `ShareEvent` table exists, backfilled, count matches `PostShare`
- [ ] Parity script returns OK
- [ ] `/feed` counters render identically (still reading from `PostShare`)

**Phase B — swap:**
- [ ] `/feed` counters now read from `ShareEvent`
- [ ] Parity script still returns OK (dual-write working)
- [ ] `share-intent` endpoint accepts old and new request shapes
- [ ] Existing D077 test suite passes verbatim
- [ ] `network_card` enum value not yet added (bu-network-shares' job)

**Phase C — cleanup:**
- [ ] `PostShare` table dropped
- [ ] `legacyPostShareId` column dropped
- [ ] No code references `PostShare` model
- [ ] Counts still render correctly on `/feed`

## Open questions to surface

- **Phase pacing.** Do we ship A/B/C in three separate PRs across one
  week (safe but slow), or A+B in one PR with C in the next (faster,
  one parity-watch window)? I lean A+B together with C after 48h.
- **`destination` enum scope.** D077's `ShareDestination` enum currently
  lists `x, instagram, facebook, whatsapp`. Should `bu-network-shares`
  introduce any new destination? (e.g., "copy_link" for non-platform
  copies.) Not a blocker — additive later.

## Context

- D077 / ADR-0003 — the table being renamed (the implementation
  contract this BU refactors)
- D052 — reaction polymorphism precedent (`comment` added the same way)
- D047 — honest tracking (verified vs intent split, preserved)
- D067 — share-intent analytics stub (the endpoint upgraded here)
- bu-post-share-counter — the original brief D077 implemented
