# SESSION BRIEF · BU-trace-fix — Trace exclusion is scoped to repo-relative paths

_Brief version: 1.0 · Author: Paul + Claude · Date: 2026-04-26_
_Priority: Bug fix. Blocks every traceability run from inside a
worktree. Has already caused matrix drift on F10 and forced a manual
matrix workaround on F12._
_Pairs with: D038 (the traceability discipline) and D053 (the
trace.ts output contract). No new ADR — same contract, fixed
implementation._

---

## Objective

`scripts/trace.ts` matched `EXCLUDED_PATH_FRAGMENTS` against
**absolute paths**. When the script ran from inside
`/Users/<user>/projects/gps-action/.claude/worktrees/<name>/`, every
file path contained the substring `.claude/worktrees`, so the walker
excluded the entire repo. Result:

- `npm run trace:matrix` from a worktree wiped every BU row and
  marked every shipped scenario (SCN-3, SCN-18, SCN-20) as a
  `⚠ gap`.
- `npm run trace:check` silently passed because the rendered matrix
  matched the (now-empty) walked file set, and there was nothing to
  check against.

This is a single-character-of-intent bug: the exclusion list is
correct, the comparison scope is wrong. The fix matches fragments
against paths **relative to REPO_ROOT**.

Success: from any worktree under `.claude/worktrees/<name>/`,
`npm run trace:matrix` produces the same matrix as from the primary
repo. `npm run trace:check` reports the real state — clean if no
drift, specific drift if any. Existing primary-repo behaviour is
unchanged: `.claude/worktrees/<sub>/` files are still excluded when
walked from the primary root.

---

## Scope

### Build in this session

- `scripts/trace.ts` (MODIFY — surgical):
  - Change `walkSource(rootDir)` to `walkSource(rootDir, repoRoot)`.
    Match `EXCLUDED_PATH_FRAGMENTS` against `relative(repoRoot,
    absPath)` instead of the absolute `dir`. Export the function so
    the test can drive it.
  - Update the single caller in `loadGraphFromDisk` to pass
    `REPO_ROOT`.
- `tests/unit/trace.test.ts` (MODIFY — append):
  - Three new test cases under `describe('walkSource — exclusion is
    scoped to repo-relative paths')`:
    1. Files under a simulated `.claude/worktrees/<name>/` are
       INCLUDED when that path is the supplied REPO_ROOT.
    2. Files under `<primary-repo>/.claude/worktrees/<sub>/` are
       EXCLUDED when scanned from the primary repo.
    3. `node_modules` is still excluded in both setups (regression
       guard so the fix doesn't accidentally widen the net).
- `scripts/trace.README.md` (MODIFY — append a short section
  "Worktree-safe exclusion" documenting the relative-path rule and
  why it matters).

### Do NOT touch

- `EXCLUDED_PATH_FRAGMENTS` itself — keep `.claude/worktrees` in the
  list. The bug is matching scope, not the list contents. Removing
  the entry would re-introduce the original problem from the primary
  repo's perspective.
- `package.json`, ESLint config, CI workflow — no surface change.
- Any feature code, scenarios.md, decision-log.md, or the existing
  matrix file. The matrix may regenerate cleanly OR with legitimate
  drift — neither is in scope to chase down here.
- D053 — the script's output contract is unchanged. No new ADR
  needed.

### Out of scope for this session

- Refactoring `walkSource` for clarity, generalising the exclusion
  rules, or extracting a path-utility module. Surgical fix only.
- Auto-detecting "is this a worktree?" — irrelevant once the
  exclusion is relative-scoped.
- Any other trace.ts behaviour (lookup, check, matrix render,
  impact). Unchanged.

---

## Contracts

### Inputs consumed

- `scripts/trace.ts` itself — current implementation.
- `docs/architecture/decision-log.md` D038 §6, D053 — the contract
  the script honours. Unchanged.

### Outputs produced

- `walkSource(rootDir, repoRoot?)` is now exported. `repoRoot`
  defaults to `rootDir` for backward-compatibility in any future
  caller; the production caller passes the real REPO_ROOT.
- A documented invariant: exclusion fragments are checked against
  `path.relative(repoRoot, absolutePath)`, not the absolute path.

---

## Acceptance criteria

- [ ] `walkSource` exported from `scripts/trace.ts` with signature
      `walkSource(rootDir: string, repoRoot?: string): string[]`.
- [ ] Exclusion check uses the repo-relative path, not the absolute
      `dir`.
- [ ] Three new test cases added; all pass.
- [ ] All existing 26 tests in `tests/unit/trace.test.ts` still pass
      (29 total).
- [ ] `npm run typecheck` clean.
- [ ] `npm run lint` clean.
- [ ] `npm test` clean.
- [ ] `npx prettier --check .` clean.
- [ ] **From the worktree**: `npm run trace:matrix` produces the same
      matrix as from the primary repo (or only legitimate drift, NOT
      a wholesale wipe of every shipped scenario).
- [ ] **From the worktree**: `npm run trace:check` reports the real
      state, not a false pass.
- [ ] `scripts/trace.README.md` documents the relative-path rule.

---

## Tests required

Three cases under `describe('walkSource — exclusion is scoped to
repo-relative paths')`:

1. **Worktree shape — included.** Build a tmp dir at
   `<tmp>/.claude/worktrees/agent-xyz/app/feed/page.tsx`. Call
   `walkSource(<tmp>/.claude/worktrees/agent-xyz/app, <tmp>/.claude/worktrees/agent-xyz)`.
   Assert the file is found.
2. **Primary-repo shape — excluded.** Build a tmp dir with both
   `app/feed/page.tsx` and `.claude/worktrees/sub/app/foo.tsx`. Call
   `walkSource(<tmp>/app, <tmp>)` — only `app/feed/page.tsx` returned.
   Then call `walkSource(<tmp>/.claude, <tmp>)` — empty result.
3. **node_modules regression guard.** Confirm `node_modules` is still
   excluded under both scopes.

---

## Known gotchas

- **Don't just remove `.claude/worktrees` from the list.** That
  regresses the original intent: when running from the primary repo,
  in-flight agent work under `.claude/worktrees/<sub>/` should NOT
  appear in the matrix. The bug is the wrong matching scope, not the
  fragment.
- **The `entry === frag` short-circuit.** The current code also
  checks `entry === frag`, which catches the directory name at one
  level. Keep this — it's a small early-exit and doesn't change
  behaviour. The bug is in the second clause (`dir.includes(frag)`).
- **`relative()` returns OS-native separators.** On macOS / Linux
  this is `/`; on Windows it would be `\`. The exclusion fragments
  use `/`. Tests run only on macOS / Linux CI, so the shipped check
  is safe; if Windows support ever lands, normalise the separator
  first. Out of scope here.

---

## Definition of done

- [ ] All four acceptance gates green (typecheck, lint, test, prettier).
- [ ] Smoke test from this worktree:
      `npm run trace:matrix` && `git diff --stat
      docs/architecture/traceability-matrix.md` shows no wholesale
      gap-flip.
- [ ] Smoke test of `trace:check` from the worktree reports the real
      state.
- [ ] Brief carries `BU-trace-fix` (semantic, per D051).
- [ ] Commit message references the bug and the fix shape; PR body
      covers symptom, fix, and prior damage (matrix workarounds in
      F10 / F12).

---

## Open questions to surface

None — fix is mechanical, contract unchanged, no naming or product
decisions involved.

---

## Context

- `scripts/trace.ts` (the file with the bug)
- `tests/unit/trace.test.ts` (where the regression test lives)
- `docs/architecture/decision-log.md` D038, D053 (unchanged contract)
- `CLAUDE.md` BU naming convention (D051) — `BU-trace-fix`, no number
