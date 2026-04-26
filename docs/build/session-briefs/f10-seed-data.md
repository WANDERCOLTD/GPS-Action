# SESSION BRIEF · F10 — Seed data script (realistic fixtures)

_Brief version: 1.0 · Author: Paul (drafted by Claude Code) · Date: 2026-04-26_
_Priority: Phase 0 chore. Closes the last data-side foundation
before BU-12 / preview-deploy work picks up._
_Pairs with: `prisma/schema.prisma` (Slices 1, 1.5, 2 minimal +
Reaction + Comment), `package.json` (the Prisma `seed` config),
`scripts/seed.ts` (the existing hand-curated demo seed)._

---

## Objective

Land a deterministic, idempotent Prisma seed script at
`prisma/seed.ts` that populates a fresh dev / preview / staging
database with realistic, clearly-synthetic fixtures across every
entity the current schema supports. Wire it through Prisma's
`prisma.seed` config so `npx prisma db seed` (and Prisma's own
`prisma migrate reset` flow) populate the database automatically.

Success looks like: a fresh Postgres → `npx prisma db seed` →
clickable, populated app with ~50 members, ~10 region tags,
~200 posts spread over the last 90 days, hundreds of comments
and reactions, all reproducible bit-for-bit from a fixed RNG seed,
and re-runnable without duplicating rows or violating unique
constraints.

The pre-existing `scripts/seed.ts` (5 named demo users, 18 narrative
posts, role grants, two feature flags, hand-written comments) stays
exactly as it is — it is the **demo seed** and remains wired to
`npm run db:seed`. F10 ships the **bulk fixture seed** alongside
it. They are complementary, not competing. See "Two seed scripts —
why" below.

---

## Scope

### Build in this session

- `prisma/seed.ts` (new — the F10 bulk fixture seed)
- `docs/build/session-briefs/f10-seed-data.md` (this file)
- `docs/build/phase-0-foundations.md` (modify — flip F10 row from
  `☐` to `✅` and update the PR column)
- `package.json` (modify — add the `prisma.seed` config block;
  add `@faker-js/faker` to `devDependencies`)
- `prisma/schema.README.md` (modify — refresh the "Local
  development" section to mention `npx prisma db seed` (the F10
  fixture seed) alongside `npm run db:seed` (the demo seed))

### Do NOT touch

- `scripts/seed.ts` — the existing demo seed is locked. F10 ships
  alongside it, doesn't replace it. (Touching it would expand
  scope and risk the demo flow.)
- `prisma/schema.prisma` — schema is contract-locked. F10 reads
  the current schema and seeds only what exists.
- `prisma/migrations/` — no migration changes.
- `eslint-rules/` — no rule changes (the new file gets
  `@build-unit BU-seed` + `@spec` headers per F06 / F13).
- `eslint.config.js` — already ignores `prisma/**` from the
  `@build-unit` enforcement globs (rule 1 is scoped to
  `app/`, `server/routers/`, `server/services/`, `server/admin/`,
  `components/`). `prisma/seed.ts` is therefore unaffected by
  rule 1, but we add the headers anyway because the trace script
  walks `prisma/`.
- The pre-existing `npm run db:seed` script entry — leave it
  pointing at `scripts/seed.ts`. F10 is invoked via
  `npx prisma db seed` (Prisma's own command), which reads the
  new `prisma.seed` config block.

### Out of scope for this session

Things F10 doesn't cover, intentionally:

- **Seeding entities the schema doesn't yet have.** F10 in
  `phase-0-foundations.md` lists vetting cases, flagged posts,
  action-taken events, etc. The current schema only has
  `WorkItem` (the unified queue primitive) and a `FeatureFlag`
  table — no Vetting, Flag, Action, Outcome models yet. Those
  ship with future BUs. F10 seeds the queue with `WorkItem` rows
  of mixed types (`vetting`, `flag`, `outcome_review`, etc.) so
  the queue UI has data, but does NOT manufacture entities the
  schema doesn't model. See "Deferrals" below.
- **Production seeding.** F10 ships in dev / preview / staging
  only. There is no `NODE_ENV=production` guard inside the seed
  itself (Prisma calls it via `npx prisma db seed` which a CI/CD
  flow can simply not invoke in prod), but the brief documents
  "do not run in prod" loud and clear.
- **Image / avatar uploads.** No real photos, no fake photos via
  network calls. `logoUrl` and similar are populated with `null`
  or with deterministic placeholder URLs (e.g.
  `https://placehold.co/...`) — never with real image data.
- **Auth integration.** F10 seeds `User.email` and `displayName`
  but no passwords, no sessions, no OAuth tokens. BU-001-lite's
  cookie-based dev auth still works because that flow looks up
  users by ID — it doesn't care how they were seeded.
- **Performance benchmarks.** Seeding 50 users + 200 posts +
  ~hundreds of comments and reactions takes a few seconds locally.
  No optimisation work needed.
- **Storybook fixtures.** Storybook isn't in the project yet. When
  it lands, it can re-use the deterministic fixture builders from
  `prisma/seed.ts` directly.

---

## Two seed scripts — why

| Seed                 | File                | Invoked by                | Purpose                                                                                                            | Size                                       |
| -------------------- | ------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| **Demo seed**        | `scripts/seed.ts`   | `npm run db:seed`         | Hand-curated narrative for demo recordings, screenshots, design review. Eddie / Cary / Bette / Humphrey / Ingrid. | 5 users, 18 posts, deliberate copy, sticky |
| **F10 fixture seed** | `prisma/seed.ts`    | `npx prisma db seed`      | Bulk realistic fixtures for previews, manual QA, future Storybook. Faker-generated, deterministic, idempotent.    | ~50 users, ~200 posts, hundreds of rows    |

They share no code. They write to the same database with no
collisions because:

1. The demo seed uses fixed email addresses (`eddie@demo.gps-action.test`,
   etc.) and `upsert` semantics — re-running it never duplicates.
2. The F10 fixture seed uses faker-generated emails in the
   `@fixture.gps-action.test` domain, deterministically derived from
   a seeded RNG, and `upsert` semantics keyed on email — re-running
   it never duplicates.
3. There is no email-domain overlap, no display-name overlap (faker
   names vs handcrafted film-star aliases), and no group-slug overlap
   (demo seed uses `writers`, `manchester`, `rapid-response`; F10
   uses faker-region slugs like `north-london`, `manchester-region`,
   etc. with the `-region` suffix to avoid collision with the demo
   seed's `manchester` slug).

A developer running both seeds back to back gets the union of the
two datasets. Each remains internally consistent.

---

## Determinism + idempotency strategy

### Determinism

- Every random value (faker output, content, timestamps within
  ranges, picked indices) is produced from a single
  `seedrandom`-style RNG initialised with a constant seed
  (`F10_SEED = 'gps-action-f10-v1'`). Faker is `.seed(...)`-ed
  with a numeric derivation of that string before any data is
  generated.
- Two consecutive `npx prisma db seed` invocations against the
  same starting state produce identical row contents.
- Time-based fields (`createdAt`, `updatedAt`) are NOT real-time
  — they're computed as offsets from a fixed `SEED_NOW =
  new Date('2026-04-26T12:00:00Z')` baseline. (The `daysAgo` style
  used in `scripts/seed.ts` is intentionally avoided because it
  drifts day-to-day.)

### Idempotency

- **Users:** `upsert` keyed on `email` (a unique field). Re-running
  updates `displayName` only if changed.
- **Regions:** `upsert` keyed on `slug` (unique).
- **UserRegion:** `upsert` keyed on the composite `[userId,
  regionId]` unique constraint.
- **Groups:** `upsert` keyed on `slug` (unique).
- **GroupMembership:** `upsert` keyed on `[userId, groupId]`
  (unique).
- **RoleGrant:** check first, create only if no active grant exists
  (mirrors `scripts/seed.ts`'s pattern; can't `upsert` because the
  unique-active-grant invariant is app-level, not DB-level).
- **Posts, Comments, Reactions, WorkItems, AuditLog:** these have no
  natural unique key for idempotency, so we generate **deterministic
  UUIDs** from the RNG and use `upsert` keyed on `id`. Same input →
  same UUIDs → re-run hits `update`, not `create`.
- **FeatureFlag:** `upsert` keyed on `name` (unique).
- **AuditLog:** B07 says append-only, but for seed purposes we use
  deterministic IDs and `upsert`. Re-running doesn't duplicate.
  In production, the seed never runs.

The whole script wraps in a single `prisma.$transaction(...)` so a
mid-seed failure doesn't leave a half-populated database. If the
fixture set ever grows past Postgres's max-statements-per-tx limit
(very unlikely at this scale), we'll batch.

### Constraint-safety re-runs

Acceptance verifies: run `npx prisma db seed` twice in succession.
Second run completes without error and the row counts in every
table are identical before and after.

---

## What gets seeded (per the live schema)

The current schema (Slice 1 + 1.5 + 2 minimal + Reaction + Comment)
exposes these models. F10 seeds every one with sensible counts.

### Users (~50 total)

50 fixture users with:

- `email` — `<faker-username>-NN@fixture.gps-action.test` (NN is
  the index, guarantees uniqueness even if faker dupes a username)
- `displayName` — faker `person.fullName()`
- `phoneNumber` — faker `phone.number({ style: 'international' })`
  with UK-ish prefix (`+44 7...`); about 30% left null
- `verifiedAt` — populated for ~85%, null for the rest
- `lastSeenAt` — distributed across the last 30 days
- ~5% have `deletedAt` set (soft-deleted, exercises the
  `WHERE deletedAt IS NULL` query path)

### Role grants

Across the 50 users:

- 2 `admin` grants
- 3 `queue_manager` grants
- All others — no grants (default member state)

`grantedByUserId` chains through the seeded admins.

### Regions (10)

Ten UK regions covering a realistic geographic spread:

| Slug              | DisplayName        | Type     |
| ----------------- | ------------------ | -------- |
| `national`        | UK National        | national |
| `north-london`    | North London       | region   |
| `manchester-region` | Greater Manchester | region   |
| `leeds-region`    | West Yorkshire     | region   |
| `birmingham-region` | West Midlands      | region   |
| `glasgow-region`  | Greater Glasgow    | region   |
| `barnet-council`  | Barnet Council     | council  |
| `camden-council`  | Camden Council     | council  |
| `salford-council` | Salford Council    | council  |
| `bury-council`    | Bury Council       | council  |

`parentId` chains: councils nest under regions; regions nest under
`national`.

### UserRegion

Each user gets 1–3 regions of interest, weighted toward their
implied geography (the assignment uses a deterministic hash of the
user's index, not the displayName, so it's stable across re-runs
even if faker outputs change between major versions).

### Groups (5)

| Slug                | DisplayName       | JoinPolicy        | isOfficial |
| ------------------- | ----------------- | ----------------- | ---------- |
| `letter-writers`    | Letter Writers    | open              | true       |
| `media-response`    | Media Response    | request_to_join   | true       |
| `regional-leeds`    | Leeds Activists   | open              | false      |
| `students`          | Students Network  | request_to_join   | true       |
| `wellbeing`         | Wellbeing Circle  | open              | false      |

### GroupMembership

Each group gets 5–15 members drawn deterministically from the user
pool. ~10% of members have `leftAt` set in the past (history
preserved per groups.md).

### CoordinatorProfile + CoordinatorGroup

5 users get a `CoordinatorProfile` (one is also an admin). Each
profile gets 1–3 `CoordinatorGroup` rows representing external
WhatsApp / newsletter communities they run.

### Posts (~200, distributed over last 90 days)

200 posts with:

- `authorId` — distributed across the active (non-deleted) user
  pool, weighted so admins / coordinators write more
- `title` — faker-generated activism-flavoured headline
- `body` — 2-5 paragraph faker `lorem.paragraphs(...)` output
- `visibility` — 80% `public`, 20% `authenticated_only`
- `activistMailerUrl` — present on ~30% of posts (typical
  action-call ratio); URL is a faker `internet.url()` pinned to
  `activist-mailer.example.com/campaign/<slug>` so it doesn't
  resolve anywhere real
- `groupTags` — 0-2 group slugs from the 5 seeded groups,
  deterministic per post
- `createdAt` — distributed across the last 90 days using a
  triangular distribution that biases toward recent dates (mirrors
  real-world "more activity now than 3 months ago")
- `deletedAt` — ~3% soft-deleted

### Comments (~600, average 3 per post)

For each post (skipping ~20% to leave a realistic mix of "no
discussion" posts):

- 1-8 comments, weighted toward 2-4
- Each comment from a deterministically-chosen user (sometimes the
  author, mostly others)
- `body` — 1-3 sentence faker `lorem.sentences(...)`
- `createdAt` — between the post's `createdAt` and `now`
- ~2% soft-deleted

Total: roughly 500-700 comments depending on RNG draws.

### Reactions (~1,500)

For each post, 0-15 reactions distributed across the 8
`ReactionEmoji` values:

- Cultural posts (those tagged `wellbeing` or matching cultural
  keywords in the title) get more `candle` and `pray`
- Action-call posts (those with `activistMailerUrl`) get more
  `strong` and `thumbsup`
- General posts get a balanced mix

For comments: ~10% of comments get 1-3 reactions (the
schema-ready, UI-deferred path from D052).

The `(userId, targetType, targetId, emoji)` unique constraint is
respected — each user can react with each emoji exactly once per
target.

### WorkItem (~30)

Mixed-type queue rows so the (future) admin queue UI has data:

- 8 `vetting` items in `unclaimed` status
- 6 `flag` items (4 `unclaimed`, 2 `claimed` with non-expired
  TTL)
- 4 `outcome_review` items in mixed states
- 3 `dedup_merge`, 3 `edit_request`, 3 `incident`,
  2 `content_submission`, 1 `link_submission`
- ~20% `resolved` with full resolution chain (resolvedBy,
  resolvedAt, resolution, resolutionNotes)

`context` JSON is populated with realistic per-type stub payloads
(no PII; just synthetic IDs and short strings).

### AuditLog (~50)

A scattering of audit entries across actions like
`role_granted`, `feature_flag_flipped`, `claim_ttl_expired`,
`group_member_approved`, etc. Demonstrates the immutable log shape
without being noisy.

### FeatureFlag (3)

Three flags exercising each `purpose`:

- `ff_seed_rollout` (purpose: `rollout`, `enabledGlobally: false`,
  `rolloutPercentage: 25`, `ttlRemoveAfter` 90 days from
  `SEED_NOW`)
- `ff_seed_kill` (purpose: `kill_switch`, `enabledGlobally: true`,
  `ownerUserId` set to one of the seeded admins)
- `ff_seed_pilot` (purpose: `pilot_gate`, `enabledForGroupIds`
  pointing at the `letter-writers` group)

Distinct from the demo seed's `ff_reactions` and `ff_comments` —
no name collision. The demo seed's flags continue to enable the
features for everyone.

---

## Deferrals — schema doesn't yet support

Items listed in `phase-0-foundations.md` F10 that the **current**
schema doesn't model. They are NOT seeded by F10. Each will be
seeded by the BU that adds the corresponding entity:

| Item from F10 spec       | Status    | Seeded by                                                      |
| ------------------------ | --------- | -------------------------------------------------------------- |
| 30 action-taken events   | Deferred  | BU-actions (when the `Action` model lands)                     |
| 5 pending vetting cases  | Partial   | F10 seeds them as `WorkItem(type='vetting')`. BU-vetting will add the dedicated entity later. |
| 8 flagged posts          | Partial   | F10 seeds them as `WorkItem(type='flag')`. BU-flag will add the dedicated entity later.       |
| 3 seeded feature flags   | Done      | F10 (the three `ff_seed_*` entries above)                      |

This is documented in the PR description so reviewers see the
scope intentionally.

---

## Contracts

### Inputs consumed

- `prisma/schema.prisma` — read to understand what models /
  enums / constraints exist. F10 only seeds fields the schema
  currently exposes.
- `@faker-js/faker` (new devDep) — content generation
- `@prisma/client` (existing) — DB writes
- `crypto` (Node built-in) — deterministic UUID derivation
  (mirrors the pattern in `scripts/seed.ts`)

### Outputs produced

- A populated database after `npx prisma db seed`
- Console output: row counts per model (no PII; just numbers and
  model names)
- Exit code 0 on success, 1 on any DB error

No new TS types exported. The seed is a script, not a library.

---

## Acceptance criteria

### Functional

- [ ] `prisma/seed.ts` exists, exports nothing (script entry point)
- [ ] File header carries `@build-unit BU-seed` and
  `@spec docs/build/phase-0-foundations.md §F10`
- [ ] Single fixed seed string controls every random value
- [ ] Faker is `.seed(...)`-ed before any data generation
- [ ] All 12 models in the current schema get seeded with the
  counts described above
- [ ] No real names — every name is faker-generated
- [ ] No real photos — `logoUrl` etc. either null or
  `https://placehold.co/...`
- [ ] Email domain is `*.fixture.gps-action.test` (no collision
  with the demo seed's `*.demo.gps-action.test`)
- [ ] Group slugs end in `-region` / `-council` / `-writers`
  etc. — no collision with demo seed slugs
- [ ] Activist Mailer URLs use `activist-mailer.example.com/...`
  pattern (deliberately non-resolving)
- [ ] No `console.log(user.email)` or similar PII leaks (rule 3
  doesn't apply to `prisma/` but the discipline does)

### Idempotency

- [ ] Running `npx prisma db seed` against a fresh DB completes
  without error
- [ ] Running it a second time completes without error
- [ ] Row counts in every table are identical before and after the
  second run
- [ ] No unique-constraint violations

### Determinism

- [ ] Two fresh DBs seeded with the same code produce
  byte-identical contents (modulo Postgres-internal IDs that we
  override with deterministic UUIDs)
- [ ] Changing `F10_SEED` produces different (but still valid)
  data

### Wiring

- [ ] `package.json` adds `"prisma": { "seed": "tsx prisma/seed.ts" }`
- [ ] `package.json` adds `@faker-js/faker` to `devDependencies`
- [ ] `npx prisma db seed` invokes the new script (per Prisma's
  own resolution order — the `prisma.seed` config is the one it
  uses)
- [ ] The existing `npm run db:seed` script still points at
  `scripts/seed.ts` and still works

### Documentation

- [ ] `docs/build/phase-0-foundations.md` F10 row updated:
  status `✅`, PR column updated
- [ ] `prisma/schema.README.md` "Local development" section
  refreshed to mention both seeds
- [ ] This brief (`docs/build/session-briefs/f10-seed-data.md`)
  exists with all sections filled in

### Mechanical

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean (zero new errors; pre-existing
  warnings OK)
- [ ] `npm test` all 249+ existing tests still pass (F10 doesn't
  add tests — see "Tests required" below)
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` — same baseline state as `main`
  (the trace script can't enumerate files when run from a
  `.claude/worktrees/...` checkout because of an existing
  exclusion in `scripts/trace.ts`; this baseline limitation
  predates F10 and is documented in the PR description)

### Discipline

- [ ] Commit message: `feat(seed): BU-seed — deterministic
  Prisma seed script (F10)` with the standard co-author trailer
- [ ] PR description: links this brief, links F10 in
  phase-0-foundations.md, lists deferrals, ticks the relevant
  PR-template boxes
- [ ] Branch: `phase-0/bu-seed`

---

## Tests required

**No automated tests for the seed itself.** Justification:

- The seed's "test" is "does the database end up populated correctly
  after a run?" — that's an integration concern, not a unit one.
- A unit test that mocks Prisma and asserts the script calls
  `upsert` N times would be testing the implementation, not the
  outcome.
- An integration test would need a real Postgres in CI, which
  requires F08 (CI migration validation) to land first.
- The smoke test in DoD ("run twice, observe no duplicates") is
  the meaningful acceptance.

When F08 lands, a follow-up brief can add:

- `tests/integration/seed.test.ts` — runs `npx prisma db seed`
  against a transient Postgres, asserts row counts and idempotency

For now: defer.

---

## Smoke test (DoD)

The brief task statement makes this explicit:

> spin up a dev DB and run `npx prisma db seed` twice; second run
> must not error and must not duplicate

If a Postgres is reachable from the worktree:

```bash
# In one terminal
docker run --rm -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test \
  -e POSTGRES_DB=gpsaction_test -p 5432:5432 postgres:16

# In another
export DATABASE_URL=postgresql://test:test@localhost:5432/gpsaction_test
npx prisma migrate deploy
npx prisma db seed
npx prisma db seed   # second run — must not error
```

Verify row counts via:

```bash
psql "$DATABASE_URL" -c "
  SELECT 'User' AS model, COUNT(*) FROM \"User\"
  UNION ALL SELECT 'Region', COUNT(*) FROM \"Region\"
  UNION ALL SELECT 'Post', COUNT(*) FROM \"Post\"
  UNION ALL SELECT 'Comment', COUNT(*) FROM \"Comment\"
  UNION ALL SELECT 'Reaction', COUNT(*) FROM \"Reaction\"
  UNION ALL SELECT 'WorkItem', COUNT(*) FROM \"WorkItem\";
"
```

Counts before run #2 == counts after run #2.

If Postgres can't easily be spun up in the agent worktree, the PR
description calls this out as "smoke-tested locally before merge"
and the reviewer confirms.

---

## Known gotchas

### Two seed scripts — keep them straight

`scripts/seed.ts` is the demo seed. `prisma/seed.ts` is the F10
fixture seed. Don't merge them. Don't make F10 import the demo
seed (it doesn't need to — they're independent and run as
needed).

### Prisma's seed-resolution order

Prisma reads `prisma.seed` from `package.json` for `npx prisma db
seed` and `prisma migrate reset`. It does NOT use the npm script
`db:seed` for those. Wiring is:

| Command                  | Reads from                  | Runs                                |
| ------------------------ | --------------------------- | ----------------------------------- |
| `npm run db:seed`        | `scripts.db:seed` in pkg    | `tsx scripts/seed.ts` (demo)        |
| `npx prisma db seed`     | `prisma.seed` in pkg        | `tsx prisma/seed.ts` (F10 fixture)  |
| `prisma migrate reset`   | `prisma.seed` in pkg        | `tsx prisma/seed.ts` (F10 fixture)  |

This split is deliberate. Prisma's `migrate reset` workflow is for
"give me a fresh fully-populated dev DB" — F10 fixtures are the
right answer there. Demo recordings still get the curated narrative
via `npm run db:seed`.

### Faker version pinning

`@faker-js/faker` releases minor versions reasonably often and the
output for a given seed CAN change between minors (rare but
documented). To keep determinism strict across CI runs, the
devDependency uses an exact pin (`^9` style is fine for now since
the seed isn't in CI yet; revisit when F08 + CI seeding lands).

### The `.claude/worktrees` trace exclusion

`scripts/trace.ts` excludes any path containing `.claude/worktrees`
(see `EXCLUDED_PATH_FRAGMENTS`). When the trace script runs from
inside a worktree, it walks 0 source files and the matrix
regenerates as empty. This is a pre-existing limitation that
affects every PR opened from a worktree. CI runs from a fresh
checkout (not a worktree), so the matrix-drift check works correctly
there. This brief surfaces the issue but does not fix it (out of
scope; would be its own session).

### Soft-deleted users and Post.author Restrict

`Post.author` uses `onDelete: Restrict`. If we soft-delete a user
who has posts, Prisma is fine (no row deleted at the DB level).
The seed's 5% soft-delete rate applies AFTER posts are seeded, and
the script ensures soft-deleted users have at least one post (so
the cleanup invariant — "you can soft-delete but not hard-delete a
user with posts" — gets exercised in the fixtures).

### RoleGrant uniqueness is app-level

The schema comment for `RoleGrant` is explicit: "One active grant
per (user, role) — Postgres partial unique indexes are not
first-class in Prisma 5; enforced in the grant procedure (not at
DB level)." The seed mimics the procedure: check first, create only
if no active grant exists.

### AuditLog is "immutable" — but we still need idempotency

B07 says no update / delete on AuditLog. For the seed, we
generate deterministic UUIDs for each entry and use `upsert` —
re-running the seed updates the same rows in place rather than
creating new ones. In production, the seed never runs, so the
"immutable" property holds where it matters (real audit history).

### CoordinatorProfile is one-to-one

The unique constraint on `userId` means we must dedupe before
seeding. The script picks 5 distinct users from the fixture pool
deterministically (slice of the sorted user list).

### No PII in console output

The seed prints row counts only:

```
F10 fixture seed → users: 50 (50 new), regions: 10 (10 new), …
```

It never prints emails, names, IDs, or content. (Even though the
data is synthetic, the discipline is the same as production.)

---

## Open questions to surface

1. **Production guard?** Should `prisma/seed.ts` refuse to run if
   `NODE_ENV === 'production'`, even though Prisma's contract is
   "the seed only runs when explicitly invoked"? Brief takes the
   defensible position of YES — add a hard `process.exit(1)` if
   `NODE_ENV === 'production'` AND `DATABASE_URL` doesn't contain
   `localhost` / `127.0.0.1` / `staging`. Rationale: belt and
   braces; the cost of a guard is one if-statement, the cost of an
   accidental prod seed is catastrophic. **Decision deferred to
   reviewer; brief implements the guard.**

2. **Volume scaling.** The F10 spec in `phase-0-foundations.md`
   says ~50 members, ~200 posts, ~50 comments, ~100 reactions.
   Brief raises comments and reactions to ~600 / ~1,500
   respectively because (a) the existing demo seed has 18 posts +
   2-4 comments per post + the recent BU-reactions / BU-comments
   shipping makes the higher counts more useful for QA, and (b)
   they're cheap to generate. **Reviewer can dial down by adjusting
   the constants at the top of the file if preferred.**

3. **Faker locale.** Set to `en_GB` (`faker.locale = 'en_GB'` in
   v9 syntax) so names + addresses look UK-ish — matches the
   project's geography (per D041 region focus). Confirm.

4. **Region count.** F10 says ~10 regions. Brief seeds exactly 10
   (4 council + 5 region + 1 national). Confirm.

5. **`@build-unit BU-seed` vs `@build-unit BU-001-prep`.** The
   existing schema uses `BU-001-prep` for the schema file itself,
   and `scripts/seed.ts` uses `BU-001-lite BU-feed`. F10's seed
   gets its own BU name, `BU-seed`, per D051's semantic-naming
   convention. Confirm.

6. **Trace exclusion fix.** Pre-existing — `scripts/trace.ts`
   excludes `.claude/worktrees` paths, breaking trace inside agent
   worktrees. Should we patch trace.ts to exclude only `.claude/`
   directly nested under repo root (not anywhere in the path)?
   Out of scope for F10; surface as a follow-up brief.

---

## Definition of done

All these must pass before opening the PR.

- [ ] `prisma/seed.ts` exists with the documented header
- [ ] `package.json` has `prisma.seed` config + `@faker-js/faker`
  devDep + `npm install` clean
- [ ] `docs/build/phase-0-foundations.md` F10 row flipped to `✅`
- [ ] `prisma/schema.README.md` mentions both seeds
- [ ] This brief committed
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean (zero new errors)
- [ ] `npm test` all passing
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` — same baseline behaviour as `main`
  (failure due to worktree exclusion is pre-existing and
  documented)
- [ ] Smoke test result documented in PR (either "verified twice
  locally with Postgres 16" or "not yet smoke-tested in CI; will
  verify locally before merge" — call it out explicitly)
- [ ] Branch pushed: `phase-0/bu-seed`
- [ ] PR opened with the documented title and body

---

## Context

**Specs and decisions:**

- `docs/build/phase-0-foundations.md` — F10 (this brief implements
  it)
- `docs/architecture/decision-log.md` — D038 (traceability),
  D045 (post visibility), D050 (reactions), D052 (comments),
  D051 (BU naming)
- `prisma/schema.prisma` — the source of truth for what to seed
- `prisma/schema.README.md` — slice convention
- `docs/process/security-baseline.md` — PII discipline (no real
  data, even synthetic)

**Existing code:**

- `scripts/seed.ts` — the demo seed (locked; F10 lives alongside)
- `server/db/client.ts` — the Prisma client singleton (re-used by
  the seed)

**Process:**

- `docs/process/working-rhythm.md` — north-star discipline
- `docs/process/session-brief-template.md` — this brief follows
  that shape
- `docs/process/session-hygiene.md` — commit-per-chunk discipline
- `CLAUDE.md` — operating context

**External:**

- `@faker-js/faker` v9 docs — https://fakerjs.dev/api/
- Prisma seed config — https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding

---

## What this brief does NOT cover

1. **A `seed.test.ts`.** Deferred until F08 lands real CI Postgres.
2. **Storybook integration.** Storybook isn't in the project.
3. **Updating `scripts/seed.ts`.** That file is locked.
4. **Adding entities not in the current schema.** Vetting / Action
   / etc. wait for their BU.
5. **CI seeding step.** F08 or F09 will wire seeding into preview
   deploys / CI; F10 just ships the script.
6. **Fixing the `.claude/worktrees` trace exclusion.** Surfaced as
   open question 6; needs its own PR.
7. **Real images.** Placeholders only; never real photos, never
   network calls during seed.
