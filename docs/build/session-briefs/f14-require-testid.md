# SESSION BRIEF · F14 — Enforce `data-testid` on interactive UI

_Brief version: 1.0 · Author: Paul · Date: April 2026_
_Priority: Phase 0 chore. Slots in alongside F13 in the F-rules family._
_Pairs with F06 rule 1 (`require-build-unit-header`) and F13 (`require-spec-tag`)
as a sibling enforcement rule. No dependency on F13; can ship in parallel._

---

## Objective

Mechanically enforce that every interactive DOM element in feature code has
a `data-testid` attribute, and that the value matches a stable naming
convention. Today there is no automated check — UI components ship with or
without testids depending on what a session author thought to add. As scenario
coverage grows (currently 17 prose scenarios in `docs/product/scenarios.md`,
many more to come) the cost of unstable selectors compounds.

Success: a new ESLint rule — `require-testid` (F14) — fails lint on any
interactive DOM element missing a well-formed `data-testid`, AND a companion
convention document (`docs/process/testid-convention.md`) defines the format
so the rule has something to enforce against. The rule, the convention doc,
and a tiny configuration file for canonical area prefixes are the deliverable.

**Pairs with D038** (traceability) in spirit — testids are the binding point
between scenarios and the DOM. Adopting Gherkin or any other automated
scenario runner later (parking lot) is materially easier when testids are
already stable.

---

## Scope

### Build in this session

**New ESLint rule:**

- `eslint-rules/rules/require-testid.js` (new)
- `eslint-rules/tests/require-testid.test.js` (new)

**Plugin registration:**

- `eslint-rules/index.js` (MODIFY — register `require-testid` alongside
  the six existing rules; preserve existing imports and exports)

**Plugin documentation:**

- `eslint-rules/README.md` (MODIFY — add §7 documenting the new rule with
  purpose, fires-when, compliant + violating examples, edge cases; match
  the voice of §1–§6)

**Configuration:**

- `eslint-rules/canonical-areas.json` (new — list of approved area
  prefixes, mirroring the table in the convention doc)

**Convention document:**

- `docs/process/testid-convention.md` (new — the standard the rule
  enforces; the `@spec` target for any code referencing testids)

**Lint config wiring:**

- `eslint.config.js` (MODIFY — add a new entry registering
  `local-rules/require-testid` at `error` severity, scoped to feature UI
  paths; extend the existing F06-rules section without disturbing it)

### Do NOT touch

- Any feature code currently in `app/`, `components/`, or `server/` —
  this session ships the rule, not the cleanup. Existing components
  missing testids will be flagged when CI runs; **list them in the
  open-questions section but do NOT fix them in this session.**
- `prisma/schema.prisma` — no schema changes
- Any other ESLint rule under `eslint-rules/rules/` — leave existing
  rules exactly as they are
- `docs/architecture/decision-log.md` — no new ADR required for this
  rule (per the same precedent as F06 and F13)
- `docs/product/scenarios.md` — Scenario 18 lands in a separate change
- Any `.feature` files anywhere — Gherkin adoption is a separate
  parking-lot decision

### Out of scope for this session

- **Fixing existing components that lack testids.** The rule will flag
  them; surface the list, do NOT fix in this session. Cleanup is a
  follow-up PR or absorbed into the next BU touching each surface.
- **Validating that testids are referenced from any test or scenario.**
  This rule checks presence and format only. Coverage (every testid is
  used somewhere) is a separate, optional future check.
- **Custom React components.** The rule applies at the leaf-DOM level.
  `<Button />` is a custom component and is exempt; the underlying
  `<button>` inside `Button.tsx` is what the rule checks. This is by
  design and matches the existing F06 pattern (rules apply where the
  enforcement is meaningful).
- **Changing the existing six rules.** F14 is additive.
- **Adopting Gherkin or any test runner that consumes testids.** That
  is a separate parking-lot item with its own ADR if/when it lands.
- **Auto-fix support.** Errors only; no auto-fix in MVP.

---

## Contracts

### Inputs consumed

- `eslint-rules/rules/require-spec-tag.js` — F13 rule. Use as the
  primary structural template (file header convention, ESM `export
  default`, `meta` shape, `messages` map, `Program` AST visitor).
- `eslint-rules/rules/require-build-unit-header.js` — F06 rule 1. Skim
  for AST patterns relevant to scanning JSX (the testid rule visits
  `JSXOpeningElement`, not `Program` — but the file-header conventions
  are the same).
- `eslint-rules/index.js` — existing plugin entry; new rule registers
  here.
- `eslint.config.js` — existing flat config; new entry appended without
  disturbing existing entries (per F06's "Extending eslint.config.js"
  guidance).
- `docs/process/testid-convention.md` — written in this same session;
  defines the format the rule enforces. The rule code references it in
  error messages.
- `~/spec-driven-staging/eslint-rules/require-testid.js` — a pre-session
  sketch of the rule logic. Useful as a behavioural reference but does
  NOT match the F06 plugin conventions. **The rule shipped in this
  session must conform to F06 conventions** (ESM `export default`,
  `@build-unit` + `@spec` header, `messageId`-based reporting, schema
  validation, etc.) — not the staged sketch's CommonJS style.

### Outputs produced

- **`require-testid` ESLint rule** — fails any interactive DOM element
  missing `data-testid` or carrying one that violates the format.
- **Configurable area prefix list** — `canonical-areas.json` is the
  single source of truth for valid `<area>` prefixes. The rule reads
  it on load.
- **`docs/process/testid-convention.md`** — the `@spec` target. Future
  components touching the convention will write `@spec
  process/testid-convention.md` in their headers.
- **README §7** — developer documentation.

---

## The rule behaviour — spec

### What it checks

For each `JSXOpeningElement` in scope:

1. **Skip custom React components.** If the element name starts with an
   uppercase letter (`<Button />`, `<PostForm />`), exit. Custom
   components are responsible for their own internal testids.
2. **Determine if the element is interactive.** Interactive =
   - Tag name in `{ button, a, input, select, textarea, form, label }`,
     OR
   - Has any of these handler attributes: `onClick`, `onChange`,
     `onSubmit`, `onKeyDown`, `onKeyUp`, `onKeyPress`, `onFocus`, `onBlur`
3. If not interactive, exit.
4. **Look for `data-testid` attribute.** If absent → fire `missing`.
5. **Check the value is a static string literal.** If it's a
   `JSXExpressionContainer` (template literal, variable, expression) →
   fire `notStatic`. Dynamic ids belong in a separate `data-*` attribute
   (e.g. `data-post-id`), not embedded in the testid.
6. **Check the value matches the format** `^[a-z]+(-[a-z0-9]+){2,}$` —
   lowercase, hyphenated, 3+ segments. If not → fire `badFormat`.
7. **Check the first segment is a canonical area prefix** loaded from
   `eslint-rules/canonical-areas.json`. If not → fire `unknownArea`.

### Error messages

```
missing      "<{{tag}}> is interactive but missing data-testid. See
              docs/process/testid-convention.md."

notStatic    "data-testid must be a static string literal, not an
              expression. Use a fixed testid and put dynamic ids in a
              separate data-* attribute (e.g. data-post-id). See
              docs/process/testid-convention.md."

badFormat    "data-testid '{{value}}' must match
              <area>-<element>-<variant> (lowercase, hyphenated, 3+
              segments). See docs/process/testid-convention.md."

unknownArea  "data-testid '{{value}}' uses area prefix '{{area}}' which
              is not in the canonical list. Add it to
              eslint-rules/canonical-areas.json AND update
              docs/process/testid-convention.md in the same PR."
```

### What the rule does NOT check

- Whether the testid is referenced from any test, scenario, or page
  object (out of scope; future check).
- Whether the testid value semantically matches the element's role
  (human judgement required).
- Custom React components' internals (out of scope; checked at their
  own definition site).
- Server-rendered HTML strings, only JSX in `app/**` and `components/**`.

### Configuration loading

`canonical-areas.json` is loaded once at module load (not per file).
If the file is missing or malformed, the rule throws — failing loud is
better than silently passing testids with unknown prefixes. F06 rules
follow the same fail-loud pattern.

Schema:

```json
{
  "_comment": "Canonical area prefixes for data-testid values. Must mirror docs/process/testid-convention.md. Adding an area here AND updating the doc must happen in the same PR.",
  "areas": ["auth", "feed", "compose", "post", "nav", "admin"]
}
```

The initial seed list reflects what bu-composer ships with plus the
adjacent surfaces already in the codebase. Future Build Units add
areas as they introduce new surfaces.

---

## Acceptance criteria

### Functional

- [ ] `eslint-rules/rules/require-testid.js` exists and exports a
      valid ESLint rule
- [ ] `eslint-rules/canonical-areas.json` exists with the seed area list
- [ ] Rule registered in `eslint-rules/index.js` under
      `local-rules/require-testid`
- [ ] Rule wired into `eslint.config.js` at `error` severity, scoped
      to `app/**/*.{ts,tsx}` and `components/**/*.{ts,tsx}`
- [ ] Unit tests for the rule cover at minimum:
  - Passes: well-formed testid on `<button>`
  - Passes: well-formed testid on `<a>`, `<input>`, `<form>`
  - Passes: well-formed testid on a `<div>` with `onClick`
  - Passes: custom component `<Button />` with no testid
  - Passes: non-interactive `<div>` with no testid
  - Fails: `<button>` with no testid → `missing`
  - Fails: `<input>` with no testid → `missing`
  - Fails: `<button data-testid={`feed-${id}`}>` → `notStatic`
  - Fails: `<button data-testid="feedNewpostSubmit">` (camelCase) → `badFormat`
  - Fails: `<button data-testid="feed_newpost_submit">` (underscores) → `badFormat`
  - Fails: `<button data-testid="feed-button">` (2 segments) → `badFormat`
  - Fails: `<button data-testid="widgets-foo-bar">` (unknown area) → `unknownArea`
  - Fails: typo `<button testid="feed-foo-bar">` → `missing`
- [ ] `docs/process/testid-convention.md` exists with: the format, the
      canonical area table, compliant + violating examples, the dynamic
      identity pattern, the custom-component exemption note, and the
      explicit note that area prefixes are deliberately separate from
      Build Unit IDs
- [ ] `npm run test` passes

### Non-functional

- [ ] Zero changes to feature code in `app/` or `components/`
- [ ] All existing tests pass
- [ ] Every new file has `@build-unit F14` AND `@spec` headers (be the
      change you want to see — and F06 + F13 will require it anyway)
- [ ] Prettier clean (`npx prettier --check .`)
- [ ] `eslint-rules/README.md` §7 documents the new rule in the same
      voice as §1–§6
- [ ] Existing F06 entries in `eslint.config.js` preserved exactly —
      diff shows only additions
- [ ] Commit message: `chore(lint): F14 — enforce data-testid on interactive UI`

### What "ready to merge" looks like

- All acceptance criteria pass
- `npm run lint` runs against the repo and produces a clean **rule**
  exit (the rule itself works), even if the rule reports violations in
  existing feature code. **Existing violations are documented in open
  questions, not fixed in this session.**

---

## Implementation notes

### File header for the rule itself

Mirror F13's pattern exactly:

```javascript
/**
 * @build-unit F14
 * @spec process/testid-convention.md
 *
 * ESLint rule: enforces that interactive DOM elements carry a
 * data-testid attribute matching the canonical convention. Pairs with
 * require-build-unit-header (F06 rule 1) and require-spec-tag (F13)
 * as the third sibling in the traceability + safety ratchet.
 *
 * The convention is documented at docs/process/testid-convention.md.
 * Canonical area prefixes are listed in eslint-rules/canonical-areas.json.
 */
```

### File header for the convention doc

```markdown
---
build-unit: F14
spec: this document defines the testid convention; the rule
      eslint-rules/rules/require-testid.js enforces it.
---
```

### File globs for the lint config

The rule applies only to UI surfaces:

```js
{
  files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
  plugins: { 'local-rules': localRules },
  rules: {
    'local-rules/require-testid': 'error',
  },
},
```

NOT `server/**` (no DOM). NOT `tests/**` (already excluded globally).
NOT `eslint-rules/**` (already excluded globally).

### Plugin registration

Add to `eslint-rules/index.js` import block:

```js
import requireTestid from './rules/require-testid.js';
```

And in the `rules` map:

```js
rules: {
  // ... existing six rules ...
  'require-testid': requireTestid,
},
```

Preserve the order of existing entries; append.

### Tests — structure

Match `eslint-rules/tests/require-spec-tag.test.js` exactly. Use
ESLint's `RuleTester` API with vitest-flavoured `describe` / `it`
hooks per the existing convention:

```js
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run('require-testid', rule, {
  valid: [ /* ... */ ],
  invalid: [ /* ... */ ],
});
```

Each test case includes a `name` field per the F13 test file pattern.

### The pre-session sketch

`~/spec-driven-staging/eslint-rules/require-testid.js` exists from
earlier work and contains the core logic in CommonJS. Use it as a
behavioural reference for AST patterns and the four check categories,
but **rewrite as ESM matching F13's shape**. Do not copy verbatim.

The sketch's "module" prefix terminology is replaced by "area" in this
session — area prefixes are deliberately separate from Build Unit IDs
(stability surface vs. work primitive) and the doc must say so.

---

## Known gotchas

- **JSX detection in tests.** The `RuleTester` config must enable JSX
  via `parserOptions.ecmaFeatures.jsx: true`, otherwise test code
  containing `<button>` parses as a comparison expression.
- **Member expressions on JSX attributes.** `node.name.name` works for
  `<button>` but JSX namespaced names (`<svg:rect>`) have a different
  AST shape. The rule should defensively check `node.name.type ===
  'JSXIdentifier'` before accessing `.name`. Pragmatic: if it's not a
  plain identifier, treat as custom and exit.
- **`data-testid` vs. `data-test-id`.** The rule looks for the exact
  attribute name `data-testid`. If a developer uses `data-test-id` or
  `dataTestId`, the rule does NOT find a testid and fires `missing`.
  Document this in the convention doc.
- **The bookmark "interactive" rule.** A `<div onClick>` is interactive
  but we don't want every `<div>` checked. The rule checks `onClick`,
  `onChange`, `onSubmit`, `onKeyDown`, `onKeyUp`, `onKeyPress`,
  `onFocus`, `onBlur`. Other handlers (`onMouseEnter`, `onMouseLeave`)
  are intentionally excluded — they're typically decorative.
- **Existing repo violations.** When the rule lands and CI runs, every
  `<button>` in `app/` and `components/` without a testid will fire.
  This is expected. List them in open questions; cleanup is a
  follow-up PR.
- **Fail-loud on canonical config.** If `canonical-areas.json` is
  missing or malformed, the rule throws at load time. This is
  intentional — silent fallback risks accepting testids with unknown
  prefixes.

---

## Definition of done

- [ ] All files in "Build" list created or modified per scope
- [ ] No files in "Don't touch" list modified
- [ ] `npm run test` passes
- [ ] `npm run lint` runs (rule itself executes; may flag existing
      feature code — document, don't fix)
- [ ] `npx prettier --check .` clean
- [ ] Rule has 5+ valid and 8+ invalid test cases
- [ ] All new files carry `@build-unit F14` AND at least one `@spec`
      tag (the convention doc; F06 + F13 will enforce this anyway)
- [ ] `eslint-rules/README.md` §7 written in the voice of §1–§6 with:
      purpose, fires-when, compliant + violating examples, edge cases
- [ ] `docs/process/testid-convention.md` exists, complete, mobile-
      readable, with the canonical area table mirroring
      `canonical-areas.json`
- [ ] Existing entries in `eslint.config.js` preserved exactly (diff
      shows only additions)
- [ ] Commit message: `chore(lint): F14 — enforce data-testid on interactive UI`
- [ ] Branch: `phase-0/f14-require-testid`, pushed, PR opened against
      `main`, CI green, merged
- [ ] Open-questions section populated with the list of existing
      feature-code violations the rule fires on

---

## Open questions to surface

Things this session cannot decide autonomously. Surface; do not assume.

1. **Initial canonical area list.** I've seeded `["auth", "feed",
   "compose", "post", "nav", "admin"]` based on what's in the codebase
   at the time of writing. Are these the right starters? Is there an
   area I've missed (e.g. `network`, `inbox`, `me` per the bottom-tab
   nav from D030)? Recommend adding `network`, `inbox`, `me` if the
   tab structure is committed; surface for confirmation.

2. **Existing repo violations.** When the rule lands, list every file
   that fires it. Estimated count based on what shipped in BU-feed +
   bu-001-lite: handful of components in `app/feed/`, `app/dev/login/`,
   `components/PostCard.tsx`, etc. Do NOT fix in this session; report
   for follow-up triage.

3. **Severity at landing.** All other F-rules ship at `error`. F14
   ships at `error` per the same precedent. Confirm this won't block
   the next merge to `main` more than is acceptable. (Mitigation: if
   too many existing violations, ship as `warn` for one PR cycle, then
   ratchet to `error` once cleanup is done. **Recommend ship-as-error
   immediately;** with `warn` the cleanup never happens.)

4. **Custom component exemption boundary.** Should `<svg>`,
   `<image>`, `<path>` etc. count as interactive? Default: no — only
   the seven HTML tags listed plus elements with handler attributes.
   Confirm.

5. **Static-string check on TypeScript expressions.** A constant
   defined elsewhere and referenced as `data-testid={CONSTANT}` would
   fire `notStatic` even if `CONSTANT` is a string literal. This is
   intentional (the rule cannot resolve cross-file constants
   tractably). Confirm or revise.

6. **Future BU-005 (full FAB composer) area.** Per D044, the FAB
   intent-cards composer is a future BU. When that lands, do its
   testids share the `compose-` area or split (`fab-`, `intent-`)?
   Current recommendation: `compose-` covers the whole compose
   experience. Surface for review when BU-005 starts.

7. **What about pages, not just elements?** The rule does not check
   that pages have a wrapping testid (e.g. `<main
   data-testid="compose-page">`). Should it? Recommend: out of scope;
   add a separate rule (`require-page-testid`) later if useful.

8. **The `~/spec-driven-staging/` artefacts.** After F14 merges, the
   sketches in that directory have served their purpose. Recommend:
   leave in place as a personal note; do not commit to the repo.

(Claude Code: add any further judgement calls encountered during
implementation.)

---

## Context

**Specs (read first):**

- `docs/process/testid-convention.md` — the standard this rule
  enforces (written in this same session)
- `docs/architecture/decision-log.md` — D038 (traceability discipline,
  philosophical parent of all F-rules)
- `docs/build/phase-0-foundations.md` — where F-rules fit in the
  Phase 0 roadmap

**Existing code to read first:**

- `eslint-rules/rules/require-spec-tag.js` — F13's rule. Primary
  structural template.
- `eslint-rules/rules/require-build-unit-header.js` — F06 rule 1.
  Reference for AST patterns and JSDoc-header scanning idioms.
- `eslint-rules/tests/require-spec-tag.test.js` — F13's tests.
  Primary test-style template.
- `eslint-rules/index.js` — registration pattern.
- `eslint-rules/README.md` — §1–§6 voice + structure for §7.
- `eslint.config.js` — extension pattern (read in full before editing
  per F06's "Extending eslint.config.js" guidance).

**The pre-session sketch:**

- `~/spec-driven-staging/eslint-rules/require-testid.js` — behavioural
  reference. Do not copy; rewrite to F06 conventions.
- `~/spec-driven-staging/eslint-rules/tests/require-testid.test.js` —
  test reference; same advice.
- `~/spec-driven-staging/eslint-rules/canonical-modules.json` — area
  list reference (note: rename from "modules" to "areas" in the
  shipped version per the vocabulary decision).

**Process:**

- `docs/process/session-brief-template.md` — this brief follows that
  template
- `CLAUDE.md` — operating context for any Claude Code session
- `docs/process/ratchet-discipline.md` — the F-rule philosophy

---

## What this brief does NOT cover

(Naming gaps explicitly, per the discipline.)

1. **Cleaning up existing components missing testids.** Surface; fix
   in a follow-up PR.
2. **Adopting Gherkin or any other automated scenario runner.**
   Separate parking-lot decision; needs its own ADR.
3. **Linking testids to scenario IDs (`SCN-XX`).** No coupling now.
   Stable testids leave that future possibility open without
   committing to it.
4. **Coverage check (every testid is referenced from a test or
   scenario).** Out of scope; possible future rule.
5. **Auto-fix support.** Errors only.
6. **Per-element severity tuning.** All violations are `error`.
7. **The new prose Scenario 18 (Eddie demo flow).** That goes in
   `docs/product/scenarios.md` as a separate change. Not coupled to
   F14; can land before, with, or after.
8. **Refactoring `eslint.config.js`.** Append, don't restructure.

---

## Slice convention

F14 is a **chore** session — no feature code. Commit type
`chore(lint)`. Establishes:

- Precedent for rules that target DOM-level discipline (the first six
  F-rules target file headers, type usage, logging, auth, flags;
  F14 is the first to traverse JSX)
- The pattern of pairing a rule with a process-doc `@spec` target
  (the convention doc is the canonical reference)
- Area prefixes as a stable taxonomy independent of Build Unit IDs

Future F-rules in this family may include `require-page-testid`,
`require-aria-label`, or `coverage-by-scenario` — all parking-lot.

---

## What lands after this session

- Every new interactive element written in future sessions must carry
  a well-formed `data-testid` — caught at lint time, blocked at commit
  time (Husky), blocked at PR time (CI).
- The convention is documented and stable.
- Stable testids are in place if/when a Gherkin or Cucumber adoption
  decision is made.
- A follow-up PR triages existing violations.

Next chore after F14: TBD — depends on cleanup PR scope. Existing
F-rules family is now seven rules deep and Phase 0 lint discipline is
substantively complete.
