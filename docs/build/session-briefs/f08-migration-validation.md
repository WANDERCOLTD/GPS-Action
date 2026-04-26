# SESSION BRIEF · F08 — Prisma migration validation in CI (BU-migrate-ci)

*Brief version: 1.0 · Author: Paul · Date: April 2026*
*Priority: Phase 0 chore. Lands as the second commit on*
*`phase-0/bu-ci-hardening` alongside F07.*

---

## Objective

Catch migrations that work on a developer's laptop but fail against
a fresh database. Today's CI runs typecheck / lint / test / format /
trace / audit — none of which exercise SQL migrations against a real
Postgres. A migration with a missing column, wrong constraint, or
ordering bug ships green and only fails when it hits staging or prod.

The fix is a new CI job that:

1. Spins up a fresh Postgres 16 service container
2. Runs `prisma migrate deploy` against it (replays every migration
   in order, end to end)
3. Runs `prisma validate` to confirm the schema is internally
   coherent

Success: a migration PR with a broken SQL file fails CI before merge.
The current migrations (`20260424153945_init`,
`20260425174149_add_reactions`, `20260425234139_add_comments`) replay
cleanly — proven by the new job passing on this PR's CI run.

---

## Scope

### Build in this session

- `.github/workflows/ci.yml` (MODIFY — add a new top-level
  `migrations` job that runs in parallel with the existing `check`
  job)
- `docs/build/phase-0-foundations.md` (MODIFY — F08 row → ✅; PR
  column updated)
- `docs/build/session-briefs/f08-migration-validation.md` (NEW —
  this file)

### Do NOT touch

- `prisma/schema.prisma` — contract-locked per CLAUDE.md
- `prisma/migrations/**` — the existing migrations are the test
  input; we don't modify them, we run them
- The existing `check` job in `ci.yml` — preserve every step exactly;
  the new `migrations` job is additive
- `package.json` — no new scripts; `npx prisma migrate deploy` and
  `npx prisma validate` are sufficient
- Any code outside `.github/workflows/`

### Out of scope for this session

- **Two-phase migration discipline checks.** F08 spec mentions
  reviewer-checklist items for column renames / type changes / NOT
  NULL adds. Those are PR-template territory (F02), not workflow
  territory.
- **Snapshot / round-trip diffing** (verifying that
  `migrate deploy` against fresh DB matches `db pull` from the
  schema). Future Tier B/C improvement; not needed today.
- **Prisma seed in CI.** Seeds are dev-data; the migrations job runs
  on an empty DB to test the migrations themselves.
- **Migrating existing data.** No data migrations in this PR.
- **A separate `db:validate` npm script.** Inline `npx` in the
  workflow keeps the surface small. If a future BU needs the same
  command locally, add a script then.
- **Caching `~/.cache/prisma`.** Marginal speed gain, complexity
  cost; defer.

---

## Contracts

### Inputs consumed

- `.github/workflows/ci.yml` — read in full first; preserve the
  existing `check` job exactly
- `prisma/schema.prisma` — the contract the migrations build toward;
  not modified, just read by `prisma validate`
- `prisma/migrations/**` — the SQL files replayed by
  `prisma migrate deploy`
- `docs/build/phase-0-foundations.md` — F08 spec is canonical

### Outputs produced

- **CI job `migrations`** — runs in parallel with `check`; uses a
  Postgres 16 service container; runs `prisma migrate deploy` then
  `prisma validate`; fails on any non-zero exit
- **Phase 0 row F08 ✅** — recorded in `phase-0-foundations.md`

---

## The behaviour — spec

### CI job shape

```yaml
migrations:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npm run db:generate
    - run: npx prisma migrate deploy
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/test
    - run: npx prisma validate
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/test
```

### Why a separate job, not a step on `check`

- `check` runs lint / typecheck / format / test / audit / gitleaks /
  trace / coverage — none of which need Postgres. Adding a service
  container to that job would slow every step.
- `migrations` is independent of `check`. Running them in parallel
  gives faster feedback and cleaner CI logs.
- If `migrations` fails, the failure mode is obvious: "Prisma blew
  up." If it were a step on `check`, the failure would mix with
  other concerns.
- The two jobs share zero state. No `needs:` chain required.

### Action versions

The existing `check` job uses `actions/checkout@v6` and
`actions/setup-node@v6`. The new `migrations` job uses the same
versions. Drift between the two jobs would be a future maintenance
hazard.

### Why `npm run db:generate` before `migrate deploy`

`db:generate` is the existing script: `prisma generate`. Running it
before `migrate deploy` ensures the Prisma client is generated
against the current schema before any migration runs. It's belt-
and-braces — `migrate deploy` doesn't strictly require a generated
client — but it matches the local dev flow and surfaces any
generator errors early.

### Why `prisma validate` after `migrate deploy`

`migrate deploy` replays SQL. `validate` confirms the resulting
Prisma schema (the .prisma file plus its migrations) is internally
coherent (no dangling relations, no enum mismatches, etc.). Both are
cheap and catch different classes of bug.

### Health check on the Postgres service

`pg_isready` is the standard Postgres readiness probe. The
`--health-interval 10s --health-retries 5` combo gives Postgres up
to 50s to come ready. In practice it's ready in <5s on GitHub
Actions hardware.

---

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` contains a top-level `migrations`
  job alongside the existing `check` job
- [ ] The `migrations` job uses `postgres:16` as a service container
  with the documented credentials and health check
- [ ] The job runs `actions/checkout@v6` and `actions/setup-node@v6`
  with `node-version: '20'` and `cache: 'npm'` — matching the
  existing `check` job exactly
- [ ] The job runs, in order: `npm ci`, `npm run db:generate`,
  `npx prisma migrate deploy`, `npx prisma validate`
- [ ] Both Prisma steps have `DATABASE_URL` set in their `env:`
  block to the in-job Postgres connection string
- [ ] The existing `check` job is preserved unchanged
- [ ] No other workflow changes
- [ ] `docs/build/phase-0-foundations.md` F08 row marked ✅; PR
  column references this PR
- [ ] Brief file (`f08-migration-validation.md`) committed
- [ ] `npm run typecheck`, `npm run lint`, `npm test`,
  `npx prettier --check .` all clean
- [ ] YAML parses without obvious errors (eyeball / online linter;
  the real test is the merged PR's CI run)
- [ ] PR body documents that the new job's correctness is best-
  proven by CI itself running on this PR's branch

---

## Permission matrix

Not applicable — CI configuration.

---

## Entity invariants

Not applicable — no schema changes.

---

## Tests required

- **CI:** the `migrations` job must run green on the PR's branch.
  This proves the existing migrations replay cleanly against a
  fresh Postgres. If it fails, fix the migrations (out of scope
  here; would be a separate brief).
- **No automated tests** — workflow YAML is exercised by CI itself.

---

## Scenarios to verify against

Not applicable — no user-facing behaviour. The only "scenario" is
the future PR scenario: someone introduces a broken migration → CI
fails → broken migration doesn't reach `main`.

---

## Known gotchas

### Service container ports

The `ports: - 5432:5432` exposes Postgres on `localhost:5432` from
the runner's perspective. The workflow steps use that. If the runner
already has Postgres running (it doesn't on standard runners), this
would conflict.

### Health check timing

The default health check options give Postgres up to 50s to come
ready. If `npm ci` is slow (cache miss), Postgres has even more time
because the CI step waits on `npm ci` first. Plenty of margin.

### `prisma migrate deploy` vs `prisma migrate dev`

`deploy` replays migrations against an existing DB (production
mode). `dev` would try to compare schema state and create new
migrations on drift — wrong for CI. Always use `deploy` here.

### Caching Node modules

`cache: 'npm'` on `setup-node` is sufficient for the npm cache. No
need to cache `node_modules` separately.

### `npm run db:generate` exists

Confirmed in `package.json`: `"db:generate": "prisma generate"`. Use
the script for parity with local dev.

### Two-phase migration discipline

F08 spec calls out the reviewer-checklist items for risky migrations
(column renames, type changes, NOT NULL additions). Those live in
the PR template (F02). This brief doesn't add automated detection
for risky patterns — that's a separate, harder concern.

### Postgres image version

`postgres:16` is current at time of writing. Production runs the
same major version (per `docs/architecture/decision-log.md`'s
choice of AWS RDS). Pin a major; don't track latest.

### Job parallelism

GitHub Actions runs `check` and `migrations` in parallel by default
since neither has `needs:` on the other. Total wall-clock CI time is
roughly `max(check_duration, migrations_duration)` rather than sum.
Win for developer feedback time.

---

## Definition of done

- [ ] `.github/workflows/ci.yml` updated per acceptance criteria
- [ ] `docs/build/phase-0-foundations.md` F08 row → ✅
- [ ] Brief committed
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` clean
- [ ] `npx prettier --check .` clean
- [ ] Commit message:
  `chore(ci): BU-migrate-ci — validate Prisma migrations in CI (F08)`
- [ ] Branch `phase-0/bu-ci-hardening`; PR opened (paired with F07
  in the same branch)
- [ ] CI passes on the PR's branch — including the new `migrations`
  job

---

## Open questions to surface

Pre-identified:

1. **Separate job vs extend `check`.** Brief recommends separate
   for parallelism + log clarity + no service-container overhead on
   non-DB steps. Confirm.

2. **Postgres major version.** `postgres:16` matches the production
   target (per stack docs). If prod ever moves, bump in lockstep.
   Confirm 16 for now.

3. **Action version drift.** `@v6` for both checkout and setup-node
   matches the existing `check` job. If the existing job ever
   moves, both must move together. Note as a maintenance item.

4. **`prisma validate` placement.** After `migrate deploy` so the
   validation runs against a known-coherent DB. Could also run
   first (without DB) to catch schema-only errors faster. Brief
   chooses post-deploy for simpler reasoning. Confirm.

5. **Caching `prisma generate` output.** Marginal speed; complexity
   cost in cache key management. Skip for v1.

6. **Test data.** The job runs against an empty DB. If a future BU
   needs to seed before validating (e.g. backfill scripts), add a
   `prisma db seed` step then. Today: not needed.

7. **Failure mode visibility.** A broken migration produces a
   Postgres error in the `migrate deploy` step's logs. Consider
   adding `--verbose` if logs aren't informative. Default seems
   fine; revisit if a real failure is opaque.

(Claude Code: surface any further judgement calls during
implementation.)

---

## Context

**Specs:**
- `docs/build/phase-0-foundations.md` (F08 section is canonical)
- `docs/process/working-rhythm.md` (definition of done)

**Existing infra to read first:**
- `.github/workflows/ci.yml` (existing `check` job — preserve)
- `prisma/schema.prisma` (the contract; read-only)
- `prisma/migrations/**` (the SQL replayed by the new job)
- `package.json` (`db:generate` script)
- `docs/build/session-briefs/f07-coverage-floor.md` (paired brief —
  same branch)

**Prisma references:**
- `prisma migrate deploy`:
  https://www.prisma.io/docs/concepts/components/prisma-migrate/migrate-development-production
- `prisma validate`:
  https://www.prisma.io/docs/orm/reference/prisma-cli-reference#validate
- GitHub Actions service containers:
  https://docs.github.com/en/actions/using-containerized-services/about-service-containers

---

## What this brief does NOT cover

1. **F07** — coverage floor. First commit on this branch; separate
   brief.
2. **Two-phase migration patterns** — reviewer-checklist territory
   (F02), not automation.
3. **Snapshot diffing / round-trip checks** — future Tier B/C work.
4. **Production migration rollouts** — separate ops concern; CI is
   pre-merge only.
5. **Schema drift detection between branches** — out of scope; would
   require comparing schema state across branch points.
6. **Adding a `db:validate` script** — `npx` inline is sufficient.

---

## Slice convention

F08 is a **Phase 0 Foundations** chore. Pairs with F07 on
`phase-0/bu-ci-hardening` because both modify
`.github/workflows/ci.yml` and a single PR avoids merge-conflict
self-fights between parallel agents. Each lands as its own commit.

After F08:
- Migration PRs have a hard pre-merge check that the migration
  applies cleanly to a fresh DB
- Subsequent BU briefs that include schema changes can rely on this
  job catching trivial breakage
- Future tightening (snapshot diffs, two-phase pattern detection)
  can build on this scaffold

Small session. Should complete in 30 minutes including DoD checks.
