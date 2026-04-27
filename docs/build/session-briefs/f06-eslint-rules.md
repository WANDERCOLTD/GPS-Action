---
slug: f06-eslint-rules
status: shipped
shipped_in: "#2"
phase: 0
---
# SESSION BRIEF · F06 — Custom ESLint rules (traceability + safety)

*Brief version: 1.1 · Author: Paul · Date: April 2026*

*Changes from v1.0: (1) Corrected package-manager references from `pnpm`
to `npm` to match project reality. (2) Added explicit Prettier check
to Definition of Done so CI doesn't catch drift post-hoc. (3) Added
guidance on extending the existing `eslint.config.js` without breaking
Slice 1's entries.*

---

## Objective

Build five custom ESLint rules — packaged as a local plugin — that
mechanically enforce the highest-risk discipline conventions documented
across the project (D038 traceability, api-contract-discipline.md, PII
policy in analytics-events.md, D036 feature flags). Each rule has tests
proving it correctly flags violations and correctly ignores compliant
code. Success looks like: running `npm run lint` against deliberately-
violating example code fails with clear messages; running it against
compliant code passes; the rules are wired into the existing ESLint
config so all real code is checked from this point forward.

---

## Scope

### Build in this session

- `eslint-rules/` (new directory at repo root)
- `eslint-rules/index.js` (new — exports all rules as a plugin)
- `eslint-rules/package.json` (new — declares it as a local package)
- `eslint-rules/README.md` (new — documents what each rule does, why,
  and how to extend)
- `eslint-rules/rules/require-build-unit-header.js` (new)
- `eslint-rules/rules/no-trpc-any.js` (new)
- `eslint-rules/rules/no-pii-in-logs.js` (new)
- `eslint-rules/rules/no-inline-auth-check.js` (new)
- `eslint-rules/rules/feature-must-have-flag.js` (new)
- `eslint-rules/tests/require-build-unit-header.test.js` (new)
- `eslint-rules/tests/no-trpc-any.test.js` (new)
- `eslint-rules/tests/no-pii-in-logs.test.js` (new)
- `eslint-rules/tests/no-inline-auth-check.test.js` (new)
- `eslint-rules/tests/feature-must-have-flag.test.js` (new)
- `eslint.config.js` (modify — register the local plugin and enable rules;
  see "Extending eslint.config.js" in Known gotchas)
- `package.json` (modify — add `eslint-rules` as a local dependency if
  needed, and verify lint/test scripts work)

### Do NOT touch

- Any file under `prisma/` (Slice 1 schema is locked once landed; rules
  apply to it but don't modify it)
- Any file under `docs/` (decisions are made; rules implement them, don't
  change them)
- Any file under `app/`, `server/`, `components/` — feature code is not
  in scope
- `.husky/` — pre-commit integration is a separate Phase 0 item (F03)
- `.github/workflows/` — CI integration is a separate Phase 0 item
- The `prettier` config — formatting discipline is separate from linting

### Out of scope for this session

Things this brief is aware of but explicitly not building:

- **Pre-commit hook integration.** F03 covers Husky setup; the rules
  will run pre-commit once F03 lands.
- **CI integration.** F05 / general CI setup runs ESLint on PRs; the
  rules apply automatically once registered.
- **The remaining 25+ standards we have documented.** This brief covers
  the 5 highest-risk ones. Other rules (e.g., schema convention
  checking, honest-copy detection) are future sessions.
- **Refactoring existing code to comply.** If the rules flag existing
  code (Slice 1 schema, READMEs, etc.), those should be fixed in
  separate PRs after this session lands. This session ships the rules
  themselves, not the cleanup.
- **Auto-fixers for the rules.** Some ESLint rules can auto-fix
  violations (`--fix`). For MVP, error-only is fine; auto-fix is a
  future enhancement per rule.
- **Custom severity levels.** All five rules ship at `error` severity.
  Adjusting per-rule severity is a future config concern.

---

## Contracts

### Inputs consumed

Documents the session must read before generating any rule code. These
define what each rule must enforce. If the rule and these docs conflict,
the docs win.

- `/docs/architecture/decision-log.md` — specifically:
  - **D036** (Feature flags — homegrown, DB-driven; rule 5 enforces flag
    declarations)
  - **D038** (Traceability infrastructure — file headers; rule 1
    enforces this)
- `/docs/process/api-contract-discipline.md` — specifically:
  - **Rule 2** (No `z.any()` — drives ESLint rule 2)
  - **Rule 7** (Authorisation via middleware, not inline — drives ESLint
    rule 4)
- `/docs/product/analytics-events.md` — the **PII policy** section
  (drives ESLint rule 3 — what fields/expressions must never appear in
  log calls)
- `/docs/build/phase-0-foundations.md` — F06 section describes the five
  rules at a high level
- `/eslint.config.js` — **read this first** before writing any changes
  to it. Slice 1 created entries in it; F06 adds to those, doesn't
  replace them. See "Extending eslint.config.js" in Known gotchas.

### Outputs produced

These are commitments to other sessions and to CI. Their behaviour
becomes a contract.

- **Rule 1: `require-build-unit-header`** — fails any file under `app/`,
  `server/routers/`, `server/services/`, or `components/` that doesn't
  have a `@build-unit` JSDoc tag in the first 10 lines.
- **Rule 2: `no-trpc-any`** — fails any use of `z.any()` (or
  `z.unknown()` if explicitly forbidden) in any file under
  `server/routers/`.
- **Rule 3: `no-pii-in-logs`** — fails any `console.log`, `logger.*`,
  or `Sentry.captureMessage` call that includes an expression matching
  PII patterns (`.email`, `.phone`, `.postcode`, `.body`, `.displayName`,
  etc. — see analytics-events.md PII policy).
- **Rule 4: `no-inline-auth-check`** — fails any tRPC procedure that
  references `ctx.user.role`, `ctx.user.permissions`, or similar in
  `.mutation(...)` or `.query(...)` bodies without having
  `.use(requireRole(...))` (or equivalent middleware) in the chain.
- **Rule 5: `feature-must-have-flag`** — fails any file that starts
  with the comment `// @feature-gated` but doesn't import and call
  `isFeatureEnabled`.
- **Plugin export** — `eslint-rules/index.js` exports a plugin object
  conforming to ESLint v9 plugin API, importable from `eslint.config.js`.

---

## Acceptance criteria

Each criterion is testable by running the test suite or by running
ESLint against fixture code.

- [ ] All 5 rule files created in `eslint-rules/rules/`
- [ ] All 5 test files created in `eslint-rules/tests/`
- [ ] `eslint-rules/index.js` exports a plugin with all 5 rules
  registered under `local-rules/<rule-name>` (or similar consistent
  namespace)
- [ ] `eslint-rules/package.json` declares the plugin as a local package
  (`"name": "eslint-plugin-local-rules"` or similar)
- [ ] `eslint.config.js` imports the plugin and enables all 5 rules
  at `error` severity, scoped to appropriate file globs — **extending
  existing config, not replacing it** (see Known gotchas)
- [ ] `npm run test` (or the dedicated eslint-rules test script)
  passes — all rule tests pass
- [ ] `npm run lint` runs successfully on the existing repo (rules may
  flag existing code — see "Known gotchas")
- [ ] Each rule's test file includes at least: 3 valid examples (rule
  doesn't fire), 3 invalid examples (rule fires with correct message),
  edge cases noted
- [ ] `eslint-rules/README.md` documents each rule with: purpose,
  what it checks, examples of compliant + violating code, how to
  extend
- [ ] All file headers include `@build-unit F06`, `@spec
  process/api-contract-discipline.md`, `@spec architecture/decision-log.md`
  (per D038 — but note: rule 1 itself enforces this convention; the
  rules' own files are written in JS, not TS, so the header convention
  applies more loosely; document this exception in the README)
- [ ] No TypeScript files written in this session (rules are JS for
  ESLint compatibility)
- [ ] No changes to any file outside the scope list
- [ ] **`npx prettier --check .` passes on all modified/created files**
  (or equivalently, run `npx prettier --write .` on the created files
  and commit the formatting result)

---

## Permission matrix

*(Adapted from template — ESLint rules don't have permissions; they
apply to all developers running the lint. The "matrix" here is which
rules apply to which file globs.)*

| Rule | File glob it applies to |
|---|---|
| `require-build-unit-header` | `app/**/*.{ts,tsx}`, `server/routers/**/*.ts`, `server/services/**/*.ts`, `components/**/*.{ts,tsx}` |
| `no-trpc-any` | `server/routers/**/*.ts` |
| `no-pii-in-logs` | `app/**/*.{ts,tsx}`, `server/**/*.ts` |
| `no-inline-auth-check` | `server/routers/**/*.ts` |
| `feature-must-have-flag` | All files (only fires if `// @feature-gated` directive present) |

Excluded globs (rules don't apply):
- `eslint-rules/**` (the rules themselves)
- `prisma/**` (schema files have their own linter)
- `docs/**` (markdown — different linter)
- `tests/**`, `*.test.{ts,js}` (tests can use any patterns; no header
  convention)
- `node_modules/**`
- `.next/**`, `dist/**`, `build/**`

---

## Entity invariants

*(Adapted from template — for an ESLint-rules session, "invariants" are
the rule semantics each rule must enforce.)*

### Rule 1: `require-build-unit-header`

**Fires when:** First 10 non-blank lines of file have no `@build-unit`
JSDoc tag.

**Doesn't fire when:**
- File has `/**\n * @build-unit BU-XXX\n */` (or single-line JSDoc with
  the tag) within first 10 non-blank lines
- File is in an excluded path (see permission matrix above)

**Edge cases:**
- Files starting with `'use client'` directive — header should follow
  the directive
- Files starting with imports — header should appear before or after,
  but within the 10-line window
- Empty files — not lintable, no error
- Files with shebang lines (`#!/usr/bin/env...`) — header follows
  shebang

**Error message:** `"File must include @build-unit JSDoc tag in first
10 lines (per D038 traceability)"`

### Rule 2: `no-trpc-any`

**Fires when:** A `z.any()` call appears anywhere in `server/routers/**/*.ts`.

**Doesn't fire when:**
- `z.unknown()` is used (acceptable per api-contract-discipline.md)
- `z.any()` appears in a comment
- `z.any()` appears in a string literal
- File is outside `server/routers/`

**Edge cases:**
- `z.any().describe(...)` — still fires; the chain doesn't excuse it
- `z.array(z.any())` — fires; nested z.any() still violates
- Custom alias like `const Any = z.any` — out of scope; rule only
  catches the literal `z.any()` call expression

**Error message:** `"z.any() is forbidden in tRPC routers (per
api-contract-discipline.md rule 2). Use a discriminated union or
z.unknown() if truly dynamic."`

### Rule 3: `no-pii-in-logs`

**Fires when:** A logging call (`console.log`, `console.info`,
`console.warn`, `console.error`, `logger.*`, `Sentry.captureMessage`,
`Sentry.captureException`) includes an expression matching PII
patterns.

**PII patterns checked:**
- Property access: `.email`, `.phone`, `.phoneNumber`, `.postcode`,
  `.address`, `.body`, `.displayName`, `.firstName`, `.lastName`,
  `.fullName`
- Variable names matching: `email`, `phone`, `postcode`, `password`,
  `apiKey`, `secret`, `token`

**Doesn't fire when:**
- Hashed value: `user.emailHash`, `user.phoneHash` (the `*Hash`
  variants are PII-safe)
- The PII appears as a key (e.g., `{ email: 'masked' }`) but not as a
  value being logged
- The expression is a literal string ("user.email" the string is fine;
  `user.email` the expression is not)
- The log is inside a file under `tests/**` or `*.test.*`

**Edge cases:**
- Template literals: `` console.log(`Email: ${user.email}`) `` — fires
- Object spread: `console.log({ ...user })` — fires (spreading a user
  object likely includes PII)
- Specific safe property: `console.log(user.id)` — does NOT fire (id
  is not in the PII list)

**Error message:** `"Logging PII is forbidden (per analytics-events.md
PII policy). Use hashed values or omit the field."`

### Rule 4: `no-inline-auth-check`

**Fires when:** A tRPC procedure body references `ctx.user.role`,
`ctx.user.permissions`, `ctx.session.role`, etc. without the procedure
chain including `.use(requireRole(...))` or equivalent middleware
(`.use(adminProcedure)`, `.use(authMiddleware)`).

**Doesn't fire when:**
- Authorisation is via middleware: `procedure.use(requireRole('admin')).mutation(...)`
- The reference is reading `ctx.user.id` or `ctx.user.displayName`
  (not auth-related)
- The file is not under `server/routers/`

**Edge cases:**
- Multiple chained middlewares: `.use(authMiddleware).use(requireRole(...))`
  — passes
- Conditional logic on role inside body even with middleware: still
  passes (middleware ran; inline conditional is fine on top)
- Custom middleware names: rule looks for any `.use()` call before
  `.mutation()` / `.query()` — pragmatic; assumes middleware does the
  check

**Error message:** `"Authorisation must be via .use(requireRole(...))
middleware, not inline (per api-contract-discipline.md rule 7)."`

### Rule 5: `feature-must-have-flag`

**Fires when:** A file starts with the comment `// @feature-gated` but
doesn't import `isFeatureEnabled` from anywhere AND doesn't call
`isFeatureEnabled` at least once.

**Doesn't fire when:**
- The `// @feature-gated` directive is absent
- The directive is present AND `isFeatureEnabled` is imported AND
  called at least once

**Edge cases:**
- Directive present but no calls: fires
- Imports present, no directive: doesn't fire (rule is opt-in)
- Multiple `@feature-gated` directives: ignores duplicates; one is
  enough
- Directive in a comment block (not line comment): also recognised

**Error message:** `"File marked @feature-gated must import and call
isFeatureEnabled (per D036 feature flag discipline)."`

---

## Tests required

Per ESLint convention, each rule has its own test file using ESLint's
`RuleTester` API.

For each rule, the test file must include:

**Valid examples (3+ minimum):**
- Code that doesn't trigger the rule
- Edge cases that look suspicious but are correctly compliant
- Code that uses the alternative pattern (e.g., `z.unknown()` for
  rule 2)

**Invalid examples (3+ minimum):**
- Clearly violating code with expected error message
- Subtle violations (e.g., template literal interpolation for rule 3)
- Edge cases that should fire but might be missed by a naive
  implementation

**Test framework:** ESLint's built-in `RuleTester` (works with any
test runner: Jest, Vitest, Mocha). Use Vitest for consistency with
the rest of the project (per D003).

Required setup:
```javascript
// eslint-rules/tests/require-build-unit-header.test.js
import { RuleTester } from 'eslint';
import rule from '../rules/require-build-unit-header.js';
import { describe, it } from 'vitest';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('require-build-unit-header', () => {
  it('passes valid examples and rejects invalid', () => {
    ruleTester.run('require-build-unit-header', rule, {
      valid: [...],
      invalid: [...],
    });
  });
});
```

**Not required:**
- Performance benchmarks
- Integration tests against real codebase (the rules will be exercised
  by future PRs naturally)
- 100% coverage of every conceivable edge case (3+ valid + 3+ invalid
  is the floor)

---

## Scenarios to verify against

*(Adapted from template — ESLint rules don't directly map to user
scenarios. Instead, verify the rules correctly enforce the documented
discipline.)*

After all rules and tests are written:

1. **Run `npm run test`** (or the dedicated eslint-rules test script) —
   all tests pass
2. **Manually run ESLint against a deliberately-violating fixture file**
   to confirm rules fire as expected (create temp file, lint, observe
   error, delete)
3. **Run `npm run lint` against the existing repo** — record any
   violations found in existing code (likely the Slice 1 schema files
   need headers added). Document these for follow-up but do NOT fix
   them in this session (out of scope)
4. **Run `npx prettier --check .`** — confirm no format drift from the
   session's changes

---

## Known gotchas

### Extending `eslint.config.js` — IMPORTANT

Slice 1 modified `eslint.config.js` to add entries (most likely related
to the new `server/admin/` directory). **Read the existing file first
before making any changes.** The correct pattern:

1. **Read** `eslint.config.js` in full
2. **Add** new entries (plugin import, rule configurations) without
   removing or reordering existing entries
3. **Preserve** Slice 1's entries exactly — don't rewrite them to
   "match your style"
4. **Test** with `npm run lint` that existing lint still works

If the existing config uses ESLint v9 flat config (array of config
objects), the pattern to extend is:

```javascript
// ESLint v9 flat config pattern
import localRules from './eslint-rules/index.js';

export default [
  // ... existing config entries (preserved exactly) ...
  
  // New entries for F06 custom rules:
  {
    files: ['app/**/*.{ts,tsx}', 'server/**/*.ts', 'components/**/*.{ts,tsx}'],
    plugins: { 'local-rules': localRules },
    rules: {
      'local-rules/require-build-unit-header': 'error',
    },
  },
  {
    files: ['server/routers/**/*.ts'],
    plugins: { 'local-rules': localRules },
    rules: {
      'local-rules/no-trpc-any': 'error',
      'local-rules/no-inline-auth-check': 'error',
    },
  },
  // ... etc per rule glob ...
];
```

**If in doubt, surface a question rather than guessing.** Breaking
existing lint configuration affects every subsequent session.

### Other gotchas

- **ESLint v9 flat config.** The project uses ESLint v9. Local plugins
  must export the v9 format, not the legacy format. Reference:
  https://eslint.org/docs/latest/extend/plugins
- **Plugin namespace.** Conventional name is `local-rules` (so rules
  appear as `local-rules/require-build-unit-header` in config). Verify
  this works with the project's existing config.
- **JSDoc parsing.** Rule 1 needs to parse JSDoc tags. ESLint's
  built-in `@typescript-eslint/utils` has helpers; vanilla ESLint can
  use AST + comment scanning.
- **AST node types vary.** Rule 4 needs to traverse the procedure
  chain — `MemberExpression` chains can be deeply nested. Test
  carefully against realistic tRPC patterns.
- **Existing files may violate.** When you run lint against the repo
  after registering the rules, existing files (especially Slice 1's
  schema files and the transitional Ping files) may flag. Surface this
  as a list of files needing follow-up; do NOT fix in this session.
- **`prisma/schema.prisma` is not JS/TS.** Rule 1 doesn't apply to
  Prisma files (they have their own format and their own header
  convention via comments at the top — different syntax).
- **Vitest config.** If the project's vitest config doesn't include
  `eslint-rules/` in its test paths, add it.
- **Prettier drift.** Prettier is configured (`.prettierrc` exists
  with `printWidth: 100`, single quotes, trailing commas). Run
  `npx prettier --write .` on the created files before committing
  OR include "fix formatting" as part of the commit.
- **Editor integration.** VS Code's ESLint extension should pick up
  the rules automatically once `eslint.config.js` references them.
  If not, restart the ESLint server (Cmd+Shift+P → "ESLint: Restart
  ESLint Server").

---

## Definition of done

All these must pass before declaring the session complete.

- [ ] All 13 files in "Build" list created
- [ ] No files in "Don't touch" list modified (except the two listed
  modify items: `eslint.config.js` and `package.json`)
- [ ] `npm run test` (or the dedicated eslint-rules test script) passes
  — all 5 rule tests pass
- [ ] `npm run lint` runs against the repo without crashing (may flag
  existing code; that's OK — document, don't fix in this session)
- [ ] Each rule has 3+ valid and 3+ invalid examples in its test file
- [ ] Each rule has a clear error message
- [ ] `eslint-rules/README.md` documents all 5 rules with purpose,
  examples, and extension guide
- [ ] **`npx prettier --check .` passes** (or run `--write` and commit
  the formatting result — do not let Prettier drift reach the PR)
- [ ] **Slice 1's existing entries in `eslint.config.js` are preserved
  exactly** — diff against the previous version should show only
  additions, no modifications to pre-existing lines
- [ ] No `TODO` or `// FIXME` comments left in committed code
- [ ] Open questions list (next section) populated with any judgement
  calls made
- [ ] Commit message follows convention: `feat(lint): F06 — 5 custom
  ESLint rules for traceability + safety enforcement`
- [ ] Branch pushed; PR opened (against `main`)

---

## Open questions to surface

Things this session cannot decide autonomously. Claude Code: list
these at the end of the session, do NOT make assumptions silently.

Pre-identified open questions:

1. **Plugin name and namespace.** Should the plugin be
   `eslint-plugin-local-rules` (npm convention) or something more
   project-specific like `eslint-plugin-gpsaction`? Affects import
   names. Surface a recommendation.

2. **Severity levels.** Should all 5 rules be `error` (block CI), or
   should some start as `warn` (visible but non-blocking)? Brief says
   `error` for all; confirm or revise.

3. **Auto-fix support.** Some rules could auto-fix (e.g., rule 1
   could insert a TODO header). Brief says no auto-fix in MVP; confirm
   or revise.

4. **PII pattern list extensibility.** Rule 3's PII pattern list is
   defined in the rule code. Should it be configurable via ESLint
   options (so projects can extend it) or hardcoded for now? Surface
   recommendation.

5. **Existing code violations.** When lint runs against the repo, how
   many files currently violate? List them in the session summary so
   a follow-up cleanup PR can address them. Do not fix in this
   session.

6. **Performance.** ESLint rules run on every file on every save in
   editors. If any rule is noticeably slow (> 50ms per file), flag
   it for optimisation in a follow-up.

7. **Rule 1 file glob accuracy.** The brief lists specific paths the
   header rule applies to. If the actual project structure (after
   Slice 1) has slightly different paths, adjust and surface the
   change.

8. **Merging with Slice 1's eslint.config.js changes.** If the
   existing file's structure makes extension awkward (e.g., uses
   non-standard export, has conflicting rules), surface exactly
   what's there and propose the minimal-diff extension approach.

(Claude Code: add any further judgement calls you encounter.)

---

## Context

Read these before starting. Listed in priority order.

**Documentation defining what each rule enforces:**
- `/docs/architecture/decision-log.md` (D036 feature flags, D038
  traceability)
- `/docs/process/api-contract-discipline.md` (rules 2, 7)
- `/docs/product/analytics-events.md` (PII policy section)
- `/docs/build/phase-0-foundations.md` (F06 section)

**Process (how to work):**
- `/docs/process/session-brief-template.md` — this brief follows that
  template
- `/CLAUDE.md` — operating context for any Claude Code session

**ESLint v9 documentation:**
- ESLint v9 flat config: https://eslint.org/docs/latest/use/configure/configuration-files
- Custom rules: https://eslint.org/docs/latest/extend/custom-rules
- RuleTester API: https://eslint.org/docs/latest/integrate/nodejs-api#ruletester
- Plugin authoring: https://eslint.org/docs/latest/extend/plugins

**Existing config to read first:**
- `/eslint.config.js` (**READ THIS IN FULL before modifying** — Slice 1
  added entries; preserve them exactly)
- `/package.json` (see existing scripts and dev dependencies; confirm
  project uses `npm` not `pnpm`)
- `/.prettierrc` (formatting standard; F06 output must comply)

---

## What this brief does NOT cover

(Naming gaps explicitly, per the discipline.)

1. **The other 25+ documented standards.** This brief enforces 5; many
   more (schema conventions, honest copy detection, design philosophy
   compliance) need separate sessions.
2. **Pre-commit hook integration.** F03 (separate Phase 0 item)
   wires Husky to run lint pre-commit.
3. **CI step for ESLint.** Already exists in CI presumably; rules
   apply automatically when CI runs lint.
4. **Auto-fix implementations.** Brief explicitly out of scope.
5. **Schema convention enforcement** (e.g., "every entity has
   displayName"). This is a separate kind of check (Prisma plugin,
   not ESLint). Future session.
6. **Refactoring existing code to comply with new rules.** Surface
   violations; fix in separate PR.
7. **Editor configuration** (VS Code ESLint extension settings,
   etc.). Documented in README, not enforced.
8. **Dependency management.** If the rules need new npm packages
   beyond ESLint itself and Vitest (e.g., a JSDoc parser), add them
   minimally and document.

---

## Slice convention

This session is **F06 of Phase 0 Foundations**. It does not extend
existing files except:
- `eslint.config.js` (extend existing entries, preserve what's there)
- `package.json` (add minimal dependencies if needed, preserve scripts)

It creates a new `eslint-rules/` package at the repo root. Future
custom-rule additions extend `eslint-rules/rules/` with new rule
files; the convention established here (file structure, naming, test
format) becomes the pattern.

The README documents this convention so future sessions adding rules
inherit it.
