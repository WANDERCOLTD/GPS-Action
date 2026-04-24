# SESSION BRIEF · F13 — Enforce @spec traceability tag

*Brief version: 1.0 · Author: Paul · Date: April 2026*
*Priority: Phase 0 chore, runs between BU-feed and BU-composer to*
*prevent compounding traceability drift*

---

## Objective

Mechanically enforce that every source file has at least one `@spec`
JSDoc tag, not just `@build-unit`. This closes a gap in the current
F06 rule 1 (`require-build-unit-header`), which only enforces
`@build-unit`. `@spec` is written by convention but was missed on 3
files during BU-feed, proving the convention is not self-enforcing.

Success: a new ESLint rule — `require-spec-tag` (let's call it F13) —
fails lint on any file that has `@build-unit` but no `@spec`. The
repo passes lint with the rule active (meaning the 3 missing tags
are fixed first, separately, per the `traceability-fix.md` doc).

**Pairs with D038** (traceability) — this makes D038 mechanically
enforced rather than convention.

---

## Scope

### Build in this session

**New ESLint rule:**
- `eslint-rules/require-spec-tag.js` (new — or wherever the F06
  rules live; check `eslint.config.js` for the rules directory)
- Test file for the rule — if existing F06 rules have tests in a
  specific location, match that pattern

**Config wiring:**
- `eslint.config.js` (MODIFY — register the new rule)

**Documentation:**
- `docs/process/ratchet-discipline.md` or similar (MODIFY — add
  note about F13 alongside existing F06 rules)
- `docs/architecture/decision-log.md` D038 update — note that
  `@spec` is now mechanically enforced

### Do NOT touch

- Source code with @build-unit or @spec tags — they're fine or fixed
  by the separate traceability-fix branch
- `/prisma/schema.prisma` — no changes
- Feature code — no changes
- Any tRPC routers, services, pages — no changes
- `docs/architecture/admin-surface.md` — unchanged
- ADRs (except D038 brief update) — no new ADRs

### Out of scope for this session

- **Validating spec files actually exist at the referenced path** —
  that's a separate, larger concern (would require a repo-wide audit
  script, not a file-level lint rule)
- **Requiring ALL files to have `@spec`** — only those that already
  have `@build-unit`. Utility files without `@build-unit` pass as-is
- **Changing F06 rule 1 (`require-build-unit-header`)** — leave
  as-is; add F13 as a separate rule
- **Retro-fitting tags to files that predate D038** — in-scope only
  if such files exist; should be none since D038 was early
- **Complex spec reference parsing** (e.g., validating ADR numbers
  exist) — keep simple: presence check only

---

## Contracts

### Inputs consumed

- `eslint-rules/require-build-unit-header.js` — existing rule; use
  as template for structure, imports, error message shape
- `eslint.config.js` — how F06 rules are registered
- `docs/architecture/decision-log.md` D038 (traceability)
- `docs/process/api-contract-discipline.md` — conventions

### Outputs produced

- **`require-spec-tag` ESLint rule** — fails if `@build-unit` is
  present but no `@spec` tag
- **Clear error message** — tells developer exactly what to add
- **No false positives** — files without `@build-unit` pass
- **Registered in `eslint.config.js`** as error (not warning)

---

## The rule behaviour — spec

### What it checks

For each source file (`.ts`, `.tsx`):

1. Look at the first JSDoc comment block in the file (up to line ~50)
2. If the comment contains `@build-unit`:
   - Require at least one `@spec` tag in the same comment block
   - Fail if not present
3. If the comment does not contain `@build-unit`, skip (rule doesn't
   apply — utility files without build-unit are OK)
4. If the file has no JSDoc comment at all, skip (F06 rule 1 catches
   files missing `@build-unit`; that's its job, not this rule's)

### Error message

When the rule fails, the message should be precise:

```
File has @build-unit BU-feed but no @spec tag. Add at least one
@spec annotation (e.g., "@spec architecture/admin-surface.md") to
maintain traceability per D038.
```

Specific, cites the decision, tells the developer what to add.

### What the rule does NOT check

- Whether the `@spec` value is a real file (path validation is
  separate work)
- Whether the `@spec` format is correct (we accept any string after
  the tag for now)
- Whether the `@spec` is relevant to the file (human judgement
  required)

Keep the rule tight: presence check only, nothing semantic.

---

## Acceptance criteria

### Functional

- [ ] `eslint-rules/require-spec-tag.js` exists and exports a valid
  ESLint rule
- [ ] Rule registered in `eslint.config.js` as `error` severity
- [ ] Unit tests for the rule cover:
  - Passes: file with `@build-unit` + `@spec`
  - Passes: file with `@build-unit` + multiple `@spec` tags
  - Passes: file with no `@build-unit` (rule skips)
  - Passes: file with no JSDoc at all (rule skips)
  - Fails: file with `@build-unit` but no `@spec`
- [ ] `npm run lint` passes cleanly (after traceability-fix is
  merged — the 3 BU-feed files must be fixed first)
- [ ] Adding a test file without `@spec` tag causes `npm run lint` to
  fail with the expected message

### Documentation

- [ ] `docs/architecture/decision-log.md` D038 — add a small update
  noting F13 now enforces the tag
- [ ] `docs/process/ratchet-discipline.md` (or the doc listing F-rules)
  — add F13 to the list with description

### Non-functional

- [ ] Zero changes to feature code
- [ ] All existing tests pass
- [ ] Every new file has `@build-unit F13` AND `@spec` header (be
  the change you want to see)
- [ ] Prettier clean
- [ ] Commit message: `chore(lint): F13 — enforce @spec traceability tag`

---

## Implementation sketch

The rule's shape matches F06 rule 1. If rule 1 is at
`eslint-rules/require-build-unit-header.js`, copy its structure.

```javascript
// eslint-rules/require-spec-tag.js

/**
 * @build-unit F13
 * @spec architecture/decision-log.md (D038)
 *
 * ESLint rule: enforces that files with @build-unit also have
 * at least one @spec tag. Pairs with require-build-unit-header
 * (F06 rule 1) to maintain full traceability per D038.
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce @spec traceability tag on files with @build-unit',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const comments = context.sourceCode.getAllComments();
        // Look at the first block comment
        const firstBlock = comments.find((c) => c.type === 'Block');
        if (!firstBlock) return;

        const text = firstBlock.value;
        const hasBuildUnit = /@build-unit\s+\S+/.test(text);
        if (!hasBuildUnit) return;  // rule only applies to files with @build-unit

        const hasSpec = /@spec\s+\S+/.test(text);
        if (!hasSpec) {
          context.report({
            node: firstBlock,
            message:
              'File has @build-unit but no @spec tag. Add at least one ' +
              '@spec annotation (e.g., "@spec architecture/admin-surface.md") ' +
              'to maintain traceability per D038.',
          });
        }
      },
    };
  },
};
```

This is illustrative — exact shape depends on the ESLint flat config
conventions the project uses (seen in F06's existing rules).

---

## Tests — structure

Match whatever testing convention F06 rules use. Likely vitest-based
tests that invoke the rule against sample source strings.

```javascript
// eslint-rules/require-spec-tag.test.js

import { RuleTester } from 'eslint';
import rule from './require-spec-tag.js';

const tester = new RuleTester();

tester.run('require-spec-tag', rule, {
  valid: [
    {
      code: '/**\n * @build-unit BU-feed\n * @spec architecture/api-contract.md\n */\nexport const x = 1;',
    },
    {
      code: '/**\n * @build-unit BU-feed\n * @spec a.md\n * @spec b.md\n */\nexport const x = 1;',
    },
    {
      code: '/**\n * A plain comment\n */\nexport const x = 1;',
    },
    {
      code: 'export const x = 1;',
    },
  ],
  invalid: [
    {
      code: '/**\n * @build-unit BU-feed\n */\nexport const x = 1;',
      errors: [{ message: /File has @build-unit but no @spec/ }],
    },
  ],
});
```

Adjust to match the repo's test framework.

---

## Known gotchas

- **Rule runs on every file** — should be fast; the check is cheap
- **AST vs text matching** — using text regex on the comment value
  is simpler and matches F06 rule 1's approach. Don't over-engineer
  with AST walks
- **Flat config vs legacy config** — the project uses flat config
  (`eslint.config.js`). Rule registration pattern: import the rule,
  register it in the relevant override block
- **Don't require `@spec` on files without `@build-unit`** — many
  utility files (config files, type definitions) don't have build
  units; they pass this rule
- **Multi-line comments** — the first block comment may span many
  lines; the regex matches regardless
- **Do not require the LAST comment or ANY comment** — just the first
  block comment, consistent with F06 rule 1's behaviour

---

## Definition of done

- [ ] New rule file created and exports valid rule
- [ ] Rule registered in `eslint.config.js`
- [ ] 5+ test cases covering valid + invalid scenarios
- [ ] `npm run lint` passes against the whole repo (after traceability
  fix branch merges first)
- [ ] Docs updated (decision-log.md D038 + ratchet-discipline or equiv)
- [ ] All new files have `@build-unit F13` AND `@spec` headers
- [ ] Prettier + typecheck + test all pass
- [ ] Commit message per spec above
- [ ] Branch pushed, PR opened, CI green, merged

---

## Open questions to surface

Pre-identified. Do not assume silently.

1. **Rule name.** `require-spec-tag` or `require-spec-annotation`
   or `traceability/require-spec`? Recommend `require-spec-tag` for
   consistency with `require-build-unit-header`. Confirm.

2. **Error severity.** `error` (fails lint) or `warn` (reports but
   doesn't fail)? Recommend `error` — consistent with F06 rule 1.
   Confirm.

3. **Rule location.** `eslint-rules/` directory or somewhere else?
   Verify by checking where F06 rules live.

4. **File extensions in scope.** Default for ESLint: `.ts`, `.tsx`,
   `.js`, `.jsx`. Recommend all 4. Confirm.

5. **First block comment only, or any block comment?** First block
   is consistent with F06 rule 1 (header-style). Confirm.

6. **How to handle files where the JSDoc is NOT at the top** — e.g.,
   a file that has a license comment first, then the @build-unit
   comment. Recommend: look for the FIRST block comment containing
   `@build-unit`, not just the literal first block. Check F06 rule
   1's behaviour; mirror it.

7. **`@spec` value format.** Accept any non-empty string after the
   tag, or validate shape (e.g., `path/to/doc.md` or `doc.md (Dxxx)`)?
   Recommend: any non-empty string. Validation of spec existence is
   separate work.

8. **Where to document F13 for developers.** Decision-log is for ADRs.
   The F-rule descriptions might live in `docs/process/` or in a
   dedicated `docs/rules.md`. Verify existing convention; match it.

(Claude Code: surface any further judgement calls during implementation.)

---

## Context

**Specs:**
- `docs/architecture/decision-log.md` D038 (traceability)
- `docs/build/phase-0-foundations.md` — where F-rules fit
- `docs/process/ratchet-discipline.md` — the F-rule philosophy
- Existing `eslint-rules/` directory — the pattern to match

**Existing code to read first:**
- `eslint-rules/require-build-unit-header.js` (or wherever F06
  rule 1 lives) — the template to copy structure from
- `eslint.config.js` — registration pattern for flat config
- Any existing rule test file — testing convention

**Process:**
- `docs/process/session-brief-template.md`
- `CLAUDE.md`

---

## What this brief does NOT cover

1. **Validating that `@spec` paths reference real files** — future
   audit script, not a lint rule
2. **Validating that `@spec` references are relevant** — human
   judgement required, not mechanisable
3. **Warning on `@spec` tags that reference retired or renamed docs**
   — future audit concern
4. **Enforcing `@spec` on files WITHOUT `@build-unit`** — out of
   scope; utility files are allowed to not have either tag
5. **Changing existing F06 rule 1** — F13 is separate
6. **Migrating or fixing existing source files** — the 3 BU-feed
   files get fixed in `docs/traceability-fix.md` separately

---

## Slice convention

F13 is a **chore** session — no feature code. Commit type `chore(lint)`.
Establishes:

- Precedent for rules that depend on other rules (F13 only triggers
  where F06 rule 1 would pass)
- The `@build-unit` header AS the gate for requiring `@spec`
- Enforcement-over-convention as a repeated pattern

Future F-rules may follow similar shapes (F14: validate-spec-paths,
F15: ...).

---

## What lands after this session

- Every new file written in future sessions that has `@build-unit`
  must also have `@spec` — caught at lint time, blocked at commit
  time (Husky), blocked at PR time (CI)
- No more silent drift on traceability
- BU-composer (next demo-path session) will produce fully-traceable
  files by default

Next chore after F13: F04 (gitleaks) or F07 (CI hardening) — both
optional and not blocking the demo.
