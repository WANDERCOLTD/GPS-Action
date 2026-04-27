---
slug: f03-husky-commitlint
status: shipped
shipped_in: "#5"
phase: 0
---
# SESSION BRIEF · F03 — Husky pre-commit + commitlint

*Brief version: 1.0 · Author: Paul · Date: April 2026*

---

## Objective

Install Husky + lint-staged + commitlint so that every commit on every
developer's machine is checked **before it's created**. Catches the two
failure modes we've repeatedly hit today: (1) Prettier drift reaching
PRs, (2) lint violations reaching PRs. Also adds commit message format
enforcement so the history stays clean. Success looks like: try to
commit with a format error — Husky blocks it; try to commit with a bad
message ("stuff") — commitlint rejects it; clean commits sail through
with `Hooks ran successfully`.

---

## Scope

### Build in this session

- `package.json` (modify — add husky, lint-staged, @commitlint/cli,
  @commitlint/config-conventional as dev dependencies; add `prepare`
  script; add `lint-staged` config block)
- `.husky/pre-commit` (new — runs lint-staged)
- `.husky/commit-msg` (new — runs commitlint)
- `commitlint.config.js` (new — extends @commitlint/config-conventional
  with any project-specific tweaks)
- `.lintstagedrc.json` (new — maps file patterns to the right commands,
  OR this can live in package.json; see "Known gotchas")
- `docs/process/commit-conventions.md` (new — documents the commit
  message format the team uses)

### Do NOT touch

- `.github/workflows/*` — CI integration stays exactly as it is
- `eslint.config.js` — F06 rules stay, don't modify
- `prettier.config` / `.prettierrc` — stays
- Any code file — F03 is infrastructure only
- `prisma/schema.prisma` — don't touch
- Any existing session briefs or docs beyond the new commit-conventions doc

### Out of scope for this session

- **CI-side checks.** Separate concern. Local hooks are the new layer;
  CI already runs format/lint/test/typecheck independently.
- **Git hooks for push** (pre-push). Phase 2 — overkill for now; the
  commit-time hooks catch 95% of drift.
- **Signed commits / GPG.** Out of scope; developer choice.
- **Conventional Commits full enforcement.** We're using it as a
  strong convention, not a rigid gate. The minimum rule is
  "type(scope): subject" format; strict type/scope validation is
  configurable but not needed MVP.
- **Automated changelog generation** (e.g., semantic-release).
  Out of scope for MVP.

---

## Contracts

### Inputs consumed

- `/package.json` — read in full first; you'll extend it carefully
- `/.prettierrc` — the Prettier config lint-staged will invoke
- `/eslint.config.js` — the ESLint config lint-staged will invoke
- `/docs/process/session-brief-template.md` — this brief follows it
- `/CLAUDE.md` — operating context
- `/docs/process/session-hygiene.md` — small session; no handoff
  expected, but discipline applies

### Outputs produced

- **Husky installed** — `.husky/` directory exists with hooks
- **Pre-commit hook** — runs lint-staged on staged files; fails the
  commit on violation
- **Commit-msg hook** — runs commitlint; rejects commits with
  malformed messages
- **lint-staged configuration** — per-filetype commands
- **commit-conventions.md** — team reference for commit message format

---

## Acceptance criteria

- [ ] `npm install` installs husky, lint-staged, @commitlint/cli,
  @commitlint/config-conventional as dev dependencies
- [ ] `package.json` has `"prepare": "husky"` script (Husky 9+ syntax)
- [ ] `.husky/pre-commit` exists and runs `npx lint-staged`
- [ ] `.husky/commit-msg` exists and runs
  `npx --no-install commitlint --edit $1`
- [ ] `commitlint.config.js` exports
  `{ extends: ['@commitlint/config-conventional'] }` with project tweaks
  as needed
- [ ] lint-staged config maps:
  - `*.{ts,tsx,js,jsx}` → `eslint --fix` + `prettier --write`
  - `*.{md,json,css,prisma}` → `prettier --write`
- [ ] `docs/process/commit-conventions.md` documents the format with
  examples from real commits in your history
- [ ] **Manual test 1:** create a file with a Prettier violation, stage
  it, try to commit. Expected: hook auto-fixes and the commit goes
  through with the fixed content.
- [ ] **Manual test 2:** create a file with a lint error (e.g., unused
  `any`), stage, try to commit. Expected: hook blocks with error message.
- [ ] **Manual test 3:** try to commit with message `"stuff"`. Expected:
  commitlint rejects with format error.
- [ ] **Manual test 4:** try to commit with
  `feat(schema): add thing`. Expected: accepted.
- [ ] All existing tests still pass (no regressions)
- [ ] `npx prettier --check .` still passes on the repo
- [ ] `npm run lint` still passes
- [ ] `npm run typecheck` still passes
- [ ] No `@build-unit` header needed on config files (they're in
  excluded globs per F06)
- [ ] `docs/process/commit-conventions.md` has a `@build-unit F03` header

---

## Permission matrix

Not applicable — this is infrastructure, no role-based behaviour.

---

## Entity invariants

Not applicable — no schema changes.

---

## Tests required

- **Manual:** the 4 manual tests listed in acceptance criteria. Document
  the results in the session summary.
- **No automated tests** — Husky hooks resist unit-testing cleanly; the
  manual verification is the test.

---

## Scenarios to verify against

1. **Developer commits code with format drift:**
   hook auto-fixes via Prettier, commit includes the fix. Dev didn't
   have to run Prettier manually.

2. **Developer commits code with lint violation:**
   hook blocks the commit with the ESLint error. Dev fixes, re-stages,
   re-commits.

3. **Developer writes sloppy commit message** (`fix stuff`):
   commitlint rejects. Dev re-types with proper format.

4. **Developer commits a docs-only change** (e.g., README edit):
   Prettier runs on the .md file, no ESLint (MD files aren't linted).
   Commit succeeds.

5. **Developer bypasses hooks intentionally** with `--no-verify`:
   acceptable escape hatch for emergencies. Documented in
   commit-conventions.md as "use sparingly."

---

## Known gotchas

### Husky 9 vs older Husky

Husky 9+ uses a different setup than earlier versions. Use `npx husky init`
for initialization; no more `husky install` script. The brief targets
Husky 9 syntax.

### lint-staged config location

Can live in `package.json` (under `"lint-staged"` key) OR in
`.lintstagedrc.json`. Prefer `.lintstagedrc.json` — keeps package.json
tidier. Choose one; don't have both.

### Commit-msg hook on Windows

The `--edit $1` syntax works on Unix but Windows developers may need a
tweak. If the project targets Mac/Linux only, not a concern. Note in
`commit-conventions.md` that Windows support isn't tested.

### The `prepare` script

The `"prepare"` script in package.json runs automatically after
`npm install`. It should set up Husky for any developer who clones the
repo. Don't skip this — without it, other developers won't have hooks.

### npm install the first time

After the session merges, every developer needs to `npm install` once
to pick up the new dev deps + trigger `prepare` and set up hooks
locally. Document this in README.md's Quick start (minor addition,
optional this session).

### Conventional commit types we use

Based on today's actual commits:
- `feat(scope):` — new feature or capability
- `fix(scope):` — bug fix
- `chore(scope):` — maintenance, cleanup
- `docs(scope):` — documentation only
- `style(scope):` — formatting (rare; usually automated)
- `refactor(scope):` — code restructure without behaviour change
- `test(scope):` — adding or updating tests
- `perf(scope):` — performance improvement

Commitlint's `config-conventional` enforces these by default. Document
them in commit-conventions.md.

### Breaking the hooks during a working session

If hooks block a commit and you need to get unstuck, `git commit --no-verify`
bypasses them. Use sparingly. Document in commit-conventions.md.

### Keep hooks FAST

Pre-commit hooks run on every commit. If they take >5 seconds, developers
hate them and learn to `--no-verify` habitually. lint-staged's trick is
it only runs on *staged* files, not the whole repo. Keep it that way.

---

## Definition of done

- [ ] All 6 files in "Build" list present
- [ ] No files in "Don't touch" list modified
- [ ] `npm install` runs clean; no peer-dep warnings beyond pre-existing ones
- [ ] All 4 manual tests pass
- [ ] Commit with the expected message
  `chore(build): F03 — Husky pre-commit hooks + commitlint`
- [ ] Push; open PR
- [ ] CI passes on PR
- [ ] `docs/process/commit-conventions.md` is clear and includes
  real examples from the project

---

## Open questions to surface

Pre-identified:

1. **lint-staged config location.** `package.json` vs
   `.lintstagedrc.json`. Recommend `.lintstagedrc.json`. Confirm.

2. **Commit type set.** Conventional commits' defaults (feat, fix,
   chore, docs, style, refactor, test, perf, ci, build, revert) —
   accept all, or narrow to a project-specific subset? Recommend
   accept all; narrowing is premature optimisation.

3. **Subject case rule.** Conventional commits defaults to
   `subject-case: ['lower-case']`. Today's commits mix (
   "F06 — 5 custom ESLint rules" is title-cased; "post-F06 cleanup"
   is lowercase). Options:
   - **Strict:** enforce `lower-case` — all future subjects must be
     lowercase
   - **Relaxed:** disable `subject-case` rule — accept any case
   Recommend: **relaxed**. Our commits are readable either way.

4. **Max subject length.** Default is 72 characters. Some of today's
   commits are longer (the Slice 1 "feat(schema): ERD Slice 1 — …" one
   exceeds 72). Options:
   - Keep 72 — future commits must be shorter
   - Raise to 100 — more room for descriptive names
   Recommend: **100**. GitHub displays fine at 100 and our scope names
   are informative.

5. **Body/footer rules.** Most of our commits have no body. Default
   config is lenient. Accept defaults.

6. **Should the pre-commit hook also run typecheck?** It would catch
   TypeScript errors at commit time. But typecheck is slow (~5s).
   Options:
   - Run typecheck in pre-commit (slow, safer)
   - Skip it (fast, CI catches it anyway)
   Recommend: **skip**. Keep pre-commit fast. CI runs typecheck.

(Claude Code: add any further judgement calls you encounter.)

---

## Context

**Documentation:**
- `/docs/process/session-brief-template.md`
- `/docs/process/session-hygiene.md`
- `/CLAUDE.md`

**Existing config to read:**
- `/package.json` — read fully before modifying
- `/.prettierrc`
- `/eslint.config.js`

**Husky / commitlint references:**
- Husky 9 docs: https://typicode.github.io/husky/
- commitlint docs: https://commitlint.js.org/
- lint-staged docs: https://github.com/lint-staged/lint-staged

---

## What this brief does NOT cover

1. **CI configuration.** CI is separate infrastructure.
2. **Pre-push hooks.** Phase 2.
3. **Automated changelog generation.** Not needed MVP.
4. **Signed commits.** Developer choice, not enforced.
5. **Repo-level policy enforcement** (GitHub rulesets). That's F01;
   separate session.
6. **Auto-fixing ESLint rules we haven't written yet.** The current
   F06 rules are error-only; auto-fix variants are future work.

---

## Slice convention

F03 is a **Phase 0 Foundations** session. Like F06, it adds mechanical
discipline that every future session inherits without needing to
remember it.

After F03:
- Future Claude Code sessions get auto-format on commit. Prettier drift
  that reached PR #2 and #3 today won't happen again.
- Every commit message follows a parseable format, enabling future
  tooling (changelog, release notes, version bumping) when we want it.
- Developers have a fast local feedback loop — seconds to discover a
  violation, not minutes to wait for CI.

Small session. Should complete in 30-45 minutes.
