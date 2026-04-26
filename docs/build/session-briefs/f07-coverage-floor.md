# SESSION BRIEF · F07 — Coverage floor on new code (BU-coverage)

*Brief version: 1.0 · Author: Paul · Date: April 2026*
*Priority: Phase 0 chore. Lands alongside F08 in `phase-0/bu-ci-hardening`*
*to avoid two parallel agents fighting over `.github/workflows/ci.yml`.*

---

## Objective

Add a coverage floor on **new** code (patch coverage), not total
project coverage. The mechanism is: Vitest emits an `lcov.info` in
CI; CI uploads it to Codecov; Codecov enforces patch-coverage on the
diff against `main`. Total coverage stays informational. This means
"I'll add tests later" stops working — every new line of code gets
its tests now or the PR fails the patch-coverage gate.

Critically, **the gate lives in Codecov's config, not in the CI
YAML.** Encoding "fail at <80%" inside the workflow file would be
brittle and would duplicate Codecov's job. Instead, this brief ships
a `codecov.yml` at repo root with the recommended thresholds; once
the repo is connected to Codecov, that config takes over.

Success looks like: `npm run test:coverage` produces an `lcov.info`
locally and in CI; `codecov.yml` declares `patch.default.target: 80%`;
PR descriptions document that patch-coverage is enforced via Codecov,
not via CI YAML.

---

## Scope

### Build in this session

- `package.json` (MODIFY — add `@vitest/coverage-v8` to devDeps; add
  `test:coverage` script)
- `vitest.config.ts` (MODIFY — add a `coverage` block per F07 spec
  in `docs/build/phase-0-foundations.md`)
- `.github/workflows/ci.yml` (MODIFY — add a coverage step after
  `npm test`, then upload to Codecov, gated on a `CODECOV_TOKEN`
  secret being present)
- `codecov.yml` (NEW — repo-root Codecov config: project coverage
  informational, patch coverage 80%)
- `.gitignore` (verify `coverage/` is ignored — already present per
  current `.gitignore`; no change expected)
- `docs/build/phase-0-foundations.md` (MODIFY — F07 row → ✅; PR
  column updated)
- `docs/build/session-briefs/f07-coverage-floor.md` (NEW — this
  file)

### Do NOT touch

- `prisma/schema.prisma` — contract-locked per CLAUDE.md
- Any router / service / component / page code — out of scope
- `eslint-rules/**` and `.eslintrc.*` / `eslint.config.js` — F06
  territory; not relevant
- `.github/workflows/*` other than `ci.yml`
- The existing test suite — we're not adding tests, we're adding the
  enforcement scaffold
- `tests/**` — fixtures and existing tests untouched

### Out of scope for this session

- **Backfilling tests for already-low-coverage files.** Patch
  coverage only enforces on the diff. The existing codebase isn't
  retroactively gated.
- **Project-coverage thresholds.** Stays informational forever (or
  until a separate decision raises it).
- **Other coverage tools** (Istanbul vs v8). v8 is fast and aligns
  with Vitest's recommendation.
- **Codecov UI configuration.** This brief ships the YAML; Paul
  connects the repo to Codecov and provisions `CODECOV_TOKEN` as a
  GitHub Actions secret in a separate manual step.
- **Reporters beyond `text`, `json`, `html`, `lcov`.** lcov is the
  Codecov contract; the others are local DX.
- **Removing any existing test.** This brief adds plumbing, doesn't
  modify behaviour.

---

## Contracts

### Inputs consumed

- `vitest.config.ts` — read in full first; preserve existing
  `test.include`, `resolve.alias`, `css` settings exactly
- `package.json` — read in full first; keep existing scripts and
  devDeps
- `.github/workflows/ci.yml` — read in full first; insert the new
  steps without disturbing existing ones
- `docs/build/phase-0-foundations.md` — F07 section spells out the
  intended config; this brief implements it

### Outputs produced

Contracts later sessions and Codecov rely on:

- **`npm run test:coverage`** — runs Vitest with v8 coverage,
  produces `coverage/lcov.info` (and the other reporters)
- **`coverage/lcov.info`** — uploaded to Codecov by CI
- **`codecov.yml`** — declares the patch-coverage gate (80%, no
  threshold drift, hard target) and the project-coverage stance
  (informational, target `auto`)
- **CI workflow** — coverage step + Codecov upload step; upload is
  conditional on `CODECOV_TOKEN` secret being present (so the build
  doesn't break before the secret is provisioned)

---

## The behaviour — spec

### `npm run test:coverage`

Runs `vitest run --coverage`. Coverage provider is v8. Reporters:
`text` (terminal summary), `json` (machine-readable), `html`
(browseable local report at `coverage/index.html`), `lcov` (the
Codecov format).

Excludes from coverage:
- `node_modules/**`
- `.next/**`
- `coverage/**`
- `**/*.d.ts`
- `**/*.config.*`
- `eslint-rules/**` (the rules have their own tests; not feature
  code)
- `prisma/migrations/**`
- `prisma/seed.ts` if present (per F07 spec; harmless if absent)
- `tests/**` (the tests themselves shouldn't count toward coverage)

Plus any other `exclude` entries already present in
`vitest.config.ts` (today there are none beyond the implicit
defaults).

### CI step

After the existing `Test` step, two new steps:

```yaml
- name: Coverage
  run: npm run test:coverage
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: false
  if: ${{ secrets.CODECOV_TOKEN != '' }}
```

`fail_ci_if_error: false` means upload failures don't break the
build. `if:` gates the upload on a token being present — until
Paul connects Codecov and adds the secret, the upload is a no-op
and CI stays green.

### `codecov.yml`

```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 0%
        informational: true
    patch:
      default:
        target: 80%
        threshold: 0%
```

`project.default.informational: true` means project coverage
shows up in PR comments but does not fail the build. `patch.default
.target: 80%` is the actual gate — added/changed lines need 80%
coverage. `threshold: 0%` means no slippage tolerance.

### Where the gate lives

The 80% gate **lives in Codecov's check** on the PR, not in the CI
YAML. CI's job is to upload `lcov.info`; Codecov's job is to compute
patch coverage and post a status check. Once the repo is connected,
that check becomes a required status check on PRs to `main` (Paul
configures this in branch protection — F01 territory).

Until Codecov is connected, the gate doesn't fire. CI still passes;
PRs still merge. This is intentional — the YAML lands first so the
plumbing is in place; Codecov flips on whenever Paul provisions the
token. Document this state explicitly in the PR body.

---

## Acceptance criteria

- [ ] `package.json` includes `@vitest/coverage-v8` in devDependencies
- [ ] `package.json` includes a `test:coverage` script:
  `"test:coverage": "vitest run --coverage"`
- [ ] `vitest.config.ts` has a `test.coverage` block with provider
  `v8`, the four reporters, and the seven exclude globs (plus any
  pre-existing excludes preserved)
- [ ] `vitest.config.ts` `test.include`, `resolve.alias`, `css`
  settings unchanged
- [ ] `.github/workflows/ci.yml` adds a `Coverage` step after `Test`
  that runs `npm run test:coverage`
- [ ] `.github/workflows/ci.yml` adds an `Upload coverage` step that
  uses `codecov/codecov-action@v4`, references
  `./coverage/lcov.info`, sets `fail_ci_if_error: false`, and is
  gated by `if: ${{ secrets.CODECOV_TOKEN != '' }}`
- [ ] All other CI steps (Install, db:generate, Typecheck, Lint,
  Audit, gitleaks, Format check, Trace, Test) preserved exactly
- [ ] `codecov.yml` exists at repo root with the recommended config
  (project informational, patch 80%)
- [ ] `coverage/` is ignored by `.gitignore` (already present —
  verify, no change expected)
- [ ] `npm run test:coverage` runs locally without error and emits
  `coverage/lcov.info`
- [ ] No `coverage/` directory committed (verify via `git status`)
- [ ] `docs/build/phase-0-foundations.md` F07 row marked ✅; PR
  column references this PR
- [ ] Brief file (`f07-coverage-floor.md`) committed
- [ ] `npm run typecheck`, `npm run lint`, `npm test`,
  `npx prettier --check .`, `npm run trace:check` all clean
- [ ] PR body documents that patch-coverage gating is enforced by
  Codecov, not by CI YAML; notes that Codecov token / repo
  connection is a follow-up

---

## Permission matrix

Not applicable — infrastructure / CI configuration.

---

## Entity invariants

Not applicable — no schema changes.

---

## Tests required

- **Manual:** run `npm run test:coverage` locally; verify
  `coverage/lcov.info` appears; verify the directory is gitignored
- **CI:** the merged workflow on the PR's branch must pass through
  the new `Coverage` step (Codecov upload is gated and may be a
  no-op until the secret is provisioned — that's expected)
- **No new automated tests** — this brief adds plumbing, not
  behaviour

---

## Scenarios to verify against

Not applicable — no user-facing behaviour. Verify by running the DoD
checks locally and watching the PR's CI green.

---

## Known gotchas

### `@vitest/coverage-v8` peer dependency

The package version must match the Vitest major version (the repo
uses Vitest `^2.1.5`). Pin to `^2.1.5` for safety.

### Reporter ordering in Vitest

Vitest accepts reporters as an array. All four (`text`, `json`,
`html`, `lcov`) can be specified together; they don't conflict.

### Codecov action version

`codecov/codecov-action@v4` is current at time of writing. v5 exists
but v4 is widely used and stable. Pin v4 explicitly.

### `if:` on the upload step

Without the `if:` gate, the upload step runs even when no token is
configured. With `fail_ci_if_error: false`, that's a soft failure —
but the cleaner pattern is to skip the step entirely until the
secret exists. Use both belt and braces.

### `coverage/` is already gitignored

Verified in `.gitignore` — line `coverage/` exists. No change
needed. Defensive check is part of DoD.

### v8 vs istanbul

v8 uses Node's built-in coverage and is significantly faster.
Istanbul is the older default but slower. F07 spec calls for v8;
stick with that.

### Local report

Opening `coverage/index.html` in a browser gives a per-file drill-
down. Useful DX; not required by CI.

---

## Definition of done

- [ ] All files in "Build" list created/modified per acceptance
  criteria
- [ ] No files in "Don't touch" list modified
- [ ] `npm install` runs clean after package.json changes
- [ ] `npm run test:coverage` succeeds locally; `coverage/lcov.info`
  exists; `git status` shows no `coverage/` artifacts staged
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` clean
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` clean
- [ ] Commit message:
  `chore(ci): BU-coverage — patch-coverage floor on new code (F07)`
- [ ] Branch `phase-0/bu-ci-hardening`; PR opened (paired with F08
  commit in the same branch)

---

## Open questions to surface

Pre-identified:

1. **`@vitest/coverage-v8` version pin.** Pinning to `^2.1.5` to
   match Vitest. If a later Vitest upgrade lands, bump together.
   Confirm.

2. **Codecov action version.** v4 is the conservative choice (v5 is
   newer but less battle-tested in this repo). Confirm.

3. **`fail_ci_if_error: false`.** Means a Codecov outage doesn't
   break CI. Tradeoff: a real upload failure is silent. Acceptable
   for now; Codecov reliability is good. Confirm.

4. **Codecov repo connection + token provisioning.** Out of session
   scope (manual GitHub + Codecov UI work). Documented as follow-up
   in PR body. Confirm Paul will handle.

5. **Branch protection adding Codecov as a required check.** F01
   territory; out of session scope. Once Codecov is wired up and
   posting checks, Paul adds it to required status checks for
   `main`. Confirm.

6. **`prisma/seed.ts` exclude.** F07 spec mentions it as
   conditional ("if F10 has landed; harmless to include either
   way"). Today the file lives at `scripts/seed.ts` per
   `package.json`'s `db:seed` script, not `prisma/seed.ts`. Include
   `prisma/seed.ts` in the exclude list anyway (harmless when
   absent); also exclude `scripts/**` if a follow-up audit shows
   they're not test-relevant. Surface for confirmation.

7. **Codecov.yml `patch.default.target` value.** Spec says 80%.
   Confirm; revise only with explicit decision.

(Claude Code: surface any further judgement calls during
implementation.)

---

## Context

**Specs:**
- `docs/build/phase-0-foundations.md` (F07 section is canonical)
- `docs/process/working-rhythm.md` (definition of done)
- `docs/process/reviewer-checklist.md` (mechanical checks)

**Existing infra to read first:**
- `vitest.config.ts`
- `.github/workflows/ci.yml`
- `package.json`
- `.gitignore`
- `docs/build/session-briefs/f06-eslint-rules.md` (brief shape)
- `docs/build/session-briefs/f15-require-design-tokens.md` (brief
  shape)

**Codecov references:**
- Codecov YAML reference: https://docs.codecov.com/docs/codecov-yaml
- `codecov/codecov-action`: https://github.com/codecov/codecov-action
- Vitest coverage docs: https://vitest.dev/guide/coverage

---

## What this brief does NOT cover

1. **F08** — Prisma migration validation in CI. Lands as the second
   commit on the same branch; separate brief at
   `docs/build/session-briefs/f08-migration-validation.md`.
2. **Codecov repo connection.** Manual UI step, not a code change.
3. **Branch protection updates.** F01 territory.
4. **Test backfill for low-coverage existing files.** Patch coverage
   only gates new code; existing code is grandfathered.
5. **Coverage budgets per directory.** v1 is global. Per-directory
   targets are a future Codecov config tweak.

---

## Slice convention

F07 is a **Phase 0 Foundations** chore. Pairs with F08 in the same
PR (`phase-0/bu-ci-hardening`) because both touch
`.github/workflows/ci.yml` and a single PR avoids merge-conflict
self-fights between parallel agents. Each lands as its own commit
for clean review.

After F07:
- New code without tests fails the Codecov patch-coverage check
  (once Codecov is connected)
- `npm run test:coverage` is the local DX equivalent
- Subsequent BU briefs can assume coverage is enforced — no need to
  re-litigate "should we have a coverage floor"

Small session. Should complete in 30-60 minutes including DoD checks.
