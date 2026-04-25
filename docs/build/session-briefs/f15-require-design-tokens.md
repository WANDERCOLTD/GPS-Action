# SESSION BRIEF · F15 — Enforce design token usage

*Brief version: 1.0 · Author: Paul · Date: April 2026*
*Priority: Phase 0 chore. Slots in alongside F13 + F14 in the F-rules family.*
*Pairs with the existing design system at `styles/tokens.css` and `styles/components.css`.*

---

## Objective

Mechanically enforce that feature code uses the established design
tokens rather than hardcoded values. The token system already exists
(`styles/tokens.css` defines flag-blue primary, warm cream canvas,
dark mode, semantic roles, spacing grid, type scale, motion tokens,
etc.). It is not consistently used — for example
`components/PostCard.tsx` defines an `AVATAR_COLOURS` array with
hardcoded hex values that are already named in tokens.

Without enforcement this drift compounds with every new component.
Same shape of problem F13 solved for `@spec` traceability:
convention-only doesn't survive growth.

This session ships TWO things in one PR:

- **Part A** — A new ESLint rule `require-design-tokens` that bans
  hardcoded hex colours and `rgb()/rgba()` values in `.tsx`, `.jsx`,
  `.ts`, `.css` (excluding `tokens.css` itself)
- **Part B** — Retrofit of existing feature components so they pass
  the rule cleanly

Demo recording happens AFTER this lands. Subsequent feature briefs
(BU-link-share, BU-reactions, BU-read-state) assume tokens are
mandatory.

---

## Scope

### Build in this session — Part A (the rule)

**New ESLint rule:**

- `eslint-rules/rules/require-design-tokens.js` (new)
- `eslint-rules/tests/require-design-tokens.test.js` (new)

**Plugin registration:**

- `eslint-rules/index.js` (MODIFY — register `require-design-tokens`
  alongside the seven existing rules; preserve everything else)

**Plugin documentation:**

- `eslint-rules/README.md` (MODIFY — add §8 for the new rule with
  purpose, fires-when, compliant + violating examples, edge cases,
  matching the voice of the previous sections)

**Configuration:**

- `eslint-rules/canonical-tokens.json` (new — list of approved CSS
  variable names that values can be compared against if we want
  smart suggestions; for v1 just used to suggest "did you mean
  `var(--colour-primary)`?" in error messages)

**Convention document:**

- `docs/process/design-tokens-convention.md` (new — the convention
  the rule enforces; the `@spec` target for any code referencing
  the token system; describes lenient mode + future strict mode)

**Lint config wiring:**

- `eslint.config.js` (MODIFY — add a new entry registering
  `local-rules/require-design-tokens` at `error` severity, scoped
  to feature code paths; extend the existing F-rules section
  without disturbing it)

### Build in this session — Part B (the retrofit)

After Part A is wired up, run `npm run lint`. The new rule will
report violations in existing components. Fix every violation by
replacing hardcoded values with token references.

**Files likely to need changes (verify by lint output):**

- `components/PostCard.tsx` — `AVATAR_COLOURS` hex array
- Any other inline `style={{ color: '#...', background: '#...' }}`
  in `.tsx` / `.jsx` files
- Any hex / rgb in `.css` files outside `tokens.css`

**The retrofit is mechanical:**

- For each hardcoded hex, find the closest token in `tokens.css`
- Replace with `var(--colour-...)` (or appropriate variable)
- For colours that don't have a clean token match, surface the
  decision in open questions (don't invent new tokens silently)

### Do NOT touch

- `styles/tokens.css` — the canonical source; not modified by this
  session. (Future BUs may add tokens; this isn't one of them.)
- `styles/components.css` — already token-based; should not need
  changes
- `prisma/schema.prisma` — no schema changes
- Any other ESLint rule under `eslint-rules/rules/` — leave alone
- Existing `@spec` / `@build-unit` JSDoc headers — preserve
- Tests for OTHER rules — preserve
- Feature behaviour — this session changes how things look, not
  what they do
- `docs/architecture/decision-log.md` — no new ADR (consistent with
  F06, F13, F14 precedent)

### Out of scope for this session

- **Strict-mode enforcement** (banning inline `style={{}}` props
  where `.gps-*` classes exist) — note in convention doc as future
  work; F15 ships in lenient mode
- **Pixel-value enforcement** (e.g. `padding: '12px'` instead of
  `padding: 'var(--space-3)'`) — also future. Lenient F15 only
  enforces colours
- **Tailwind utility class banning** (e.g. `bg-blue-500`) — surface
  in open questions; only fix in this session if Tailwind colour
  classes are present in feature code (probably not)
- **Validating that `var(--...)` references point to a real token**
  — future audit script. v1 only checks for hex/rgb absence
- **Auto-fix support in the rule** — manual fixes only; ESLint
  auto-fix can land later
- **Migration of `styles/components.css` itself** — already
  token-compliant
- **New tokens** for any colour that doesn't have a match — surface,
  don't invent

---

## Contracts

### Inputs consumed

- `styles/tokens.css` — the canonical token list
- `styles/components.css` — example of correct usage
- `eslint-rules/rules/require-build-unit-header.js` — rule
  shape/style template
- `eslint-rules/rules/require-spec-tag.js` — F13 rule, pattern
  for tag-presence checks (different problem, similar structure)
- `eslint-rules/rules/require-testid.js` — F14 rule once it exists;
  for now just match the established pattern from F06 rule 1
- `eslint.config.js` — registration pattern
- `eslint-rules/index.js` — plugin export pattern
- `eslint-rules/README.md` — documentation style

### Outputs produced

Contracts future sessions rely on:

- **`require-design-tokens` ESLint rule** — fails build on
  hardcoded hex / rgb in feature files
- **`canonical-tokens.json`** — token list for error message
  suggestions; future expansion to validate references
- **`docs/process/design-tokens-convention.md`** — the convention
  doc; subsequent feature briefs `@spec` to it

---

## The rule behaviour — spec

### What `require-design-tokens` checks

For every `.tsx`, `.jsx`, `.ts`, `.css` file (with file-extension
allowlist; excluding `styles/tokens.css` itself):

1. Search file content for hardcoded colour patterns:
   - `#[0-9a-fA-F]{3,8}` (hex colours, 3/4/6/8 digit forms)
   - `rgb\(...\)` and `rgba\(...\)` literals
   - `hsl\(...\)` and `hsla\(...\)` literals
2. Each match is a violation
3. Error message includes the file location and a hint:
   "Use `var(--colour-...)` from `styles/tokens.css` instead. See
   `docs/process/design-tokens-convention.md`."

### What the rule does NOT check (lenient mode)

- Pixel values (`padding: '12px'`, `margin: '8px 16px'`) — out of
  scope for v1; subsequent F-rule could add this
- Inline `style={{}}` props vs class-based styling — recommendation
  in convention doc, not enforced
- Tailwind utility classes for colour (`bg-blue-500`, `text-gray-700`)
  — out of scope for v1 unless Tailwind is in active use in feature
  files
- Whether the chosen `var(--...)` reference points at a real token
  — future audit work

### Exemptions

The rule MUST exempt:

- `styles/tokens.css` itself (the only file allowed to define hex)
- Comment-only matches (a hex value inside a `/* ... */` or `//`
  comment)
- String-literal exceptions in test files that test the rule itself
  (the test file for `require-design-tokens.js` will contain hex
  values as test fixtures — exempt by file path or by use of a
  pragma like `/* eslint-disable local-rules/require-design-tokens */`)

### Error message template

```
Hardcoded colour value '#1851cc' is not allowed.
Use a design token from styles/tokens.css instead.
Closest match: var(--colour-primary)
See docs/process/design-tokens-convention.md
```

The "closest match" suggestion is best-effort. Read
`canonical-tokens.json` to map hex → token name. If no match,
say "no exact match — review `tokens.css` and choose the closest
semantic role."

### Severity

`error` (fails lint and CI). Consistent with other F-rules.

### File scope (in `eslint.config.js`)

Rule applies to:
- `app/**/*.{ts,tsx}`
- `components/**/*.{ts,tsx}`
- `styles/**/*.css` (except `tokens.css`)

Rule does NOT apply to:
- `eslint-rules/**` (where the rule itself lives)
- `tests/**` (test fixtures may need hex)
- `prisma/**`
- `server/**` (no UI)
- `shared/**` (no UI)
- `scripts/**` (no UI)

Surface in open questions if any of these scopes seem off.

---

## Acceptance criteria

### Functional — Part A (rule)

- [ ] `eslint-rules/rules/require-design-tokens.js` exists and
  exports a valid ESLint rule
- [ ] `eslint-rules/index.js` registers the rule
- [ ] `eslint.config.js` wires the rule at `error` severity for
  feature paths
- [ ] `eslint-rules/canonical-tokens.json` contains a list of every
  variable name from `styles/tokens.css` keyed by approximate hex
  value (script-extracted or hand-written; surface choice in open
  questions)
- [ ] Tests cover:
  - Pass: file with `var(--colour-primary)`
  - Pass: file with no colour at all
  - Pass: comment containing hex (`/* #1851cc */`)
  - Pass: `tokens.css` with hex (exempt)
  - Pass: rule's own test file with hex (exempt)
  - Fail: hex in `.tsx`
  - Fail: rgb in `.css` (outside tokens.css)
  - Fail: hsl in `.tsx`

### Functional — Part B (retrofit)

- [ ] `npm run lint` passes with 0 errors after retrofit
- [ ] Every hardcoded hex / rgb in feature files replaced with a
  token reference
- [ ] No new tokens added to `tokens.css` without explicit
  surfacing in open questions
- [ ] If a colour has no clean token match, the closest semantic
  role is used and the choice is documented in a code comment
- [ ] Visually verify by running `npm run dev`:
  - Feed page renders with cream background + flag-blue accents
  - Post cards use the warm raised surface tone
  - The "New post" link uses primary blue
  - Forms use the design system's input styling
  - Buttons use design tokens (no greys from Tailwind defaults)

### Documentation

- [ ] `docs/process/design-tokens-convention.md` exists and covers:
  - Why we have a token system (the rationale F13 articulated for
    traceability — same shape, applied to design)
  - The token taxonomy (brand, semantic, cultural, surface, border,
    text, spacing, type, motion)
  - How to use them (`var(--colour-...)`, class names from
    `components.css`)
  - What lenient mode means (today: colours only; tomorrow:
    pixels + Tailwind classes)
  - Anti-patterns (hardcoded hex, inline style with hex, etc.)
  - When to add a new token (rare; surface in PR)
- [ ] `eslint-rules/README.md` adds §8 for the new rule
- [ ] `docs/build/phase-0-foundations.md` adds F15 to the
  enforcement checklist (alongside F06, F13, F14)

### Non-functional

- [ ] Zero changes to feature behaviour
- [ ] All existing tests pass
- [ ] Every new file has `@build-unit F15` AND at least one `@spec`
  tag (F13 catches missing tags)
- [ ] No new `data-testid` attributes added (F14 territory; not
  this session)
- [ ] Prettier clean
- [ ] Commit message:
  `chore(lint): F15 — enforce design token usage + retrofit components`

---

## Header convention reminder

Every new file gets a JSDoc header:

```typescript
/**
 * @build-unit F15
 * @spec process/design-tokens-convention.md
 * @spec process/ratchet-discipline.md
 *
 * (description here)
 */
```

For modified existing files, do not change their existing header.
For documentation files (`.md`), use a comment-style top section if
the file format permits.

---

## Implementation sketch

### Rule shape

The rule's structure mirrors `require-spec-tag` (F13) — a regex
search across the file body. Don't over-engineer with AST.

```javascript
// eslint-rules/rules/require-design-tokens.js

/**
 * @build-unit F15
 * @spec process/design-tokens-convention.md
 *
 * ESLint rule: enforces design token usage. Bans hardcoded hex,
 * rgb(), rgba(), hsl(), hsla() colour values in feature code.
 * Pairs with the design token system at styles/tokens.css.
 */

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_PATTERN = /rgba?\([^)]+\)/g;
const HSL_PATTERN = /hsla?\([^)]+\)/g;

const EXEMPT_FILES = [
  'styles/tokens.css',
  'eslint-rules/rules/require-design-tokens.js',
  'eslint-rules/tests/require-design-tokens.test.js',
];

module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce design token usage; ban hardcoded colours' },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.filename || context.getFilename();
        if (EXEMPT_FILES.some((p) => filename.endsWith(p))) return;

        const sourceText = context.sourceCode.getText();
        // Skip comment content — strip JS/TS/CSS comments before scanning
        const stripped = stripComments(sourceText, filename);

        const violations = [];
        for (const re of [HEX_PATTERN, RGB_PATTERN, HSL_PATTERN]) {
          let match;
          while ((match = re.exec(stripped)) !== null) {
            violations.push({
              value: match[0],
              index: match.index,
            });
          }
        }

        for (const v of violations) {
          context.report({
            node,
            message:
              `Hardcoded colour '${v.value}' is not allowed. ` +
              `Use a design token from styles/tokens.css. ` +
              `See docs/process/design-tokens-convention.md.`,
          });
        }
      },
    };
  },
};
```

`stripComments` is helper logic for skipping content inside
`/* ... */`, `// ...`, and CSS comments. Implement carefully — false
matches inside comments are bad UX.

### Tests

Match the shape of `require-spec-tag.test.js`. RuleTester with
sample source strings. Cover the 8 cases listed in acceptance.

### canonical-tokens.json

Two ways:

**Option a:** hand-curate the list (~30 token-to-hex pairs)
```json
{
  "#1851cc": "--colour-primary",
  "#1441a8": "--colour-primary-hover",
  "#0f6e56": "--colour-success",
  "#f4f1ea": "--colour-surface-canvas"
}
```

**Option b:** parse `tokens.css` at build time and generate the JSON

Recommend (a) for v1. Mechanical, predictable. (b) is nicer but
introduces a dependency on the token file format.

Surface choice in open questions.

---

## Retrofit guidance

After Part A is wired up and `npm run lint` runs, here's how to
handle each violation:

### `components/PostCard.tsx` — AVATAR_COLOURS

Currently:
```typescript
const AVATAR_COLOURS = [
  '#4577e8', // blue
  '#0f6e56', // green
  // ...
];
```

This is harder than a single colour. The avatar logic picks one of
several colours per author. We have two options:

**Option a:** use existing tokens
```typescript
const AVATAR_COLOURS = [
  'var(--colour-primary-bright)',
  'var(--colour-success)',
  'var(--colour-cultural)',
  'var(--colour-info)',
  'var(--colour-warning)',
];
```

**Option b:** add new avatar-specific tokens to `tokens.css`
(out of scope for this session — surface in open questions)

Recommend (a). Reuses existing semantic colours. The visual result
will be on-brand even if not bespoke.

### Inline styles with hex

If any feature file has `style={{ color: '#...', background: '#...' }}`,
replace with `var(--...)`:

```typescript
// before
<div style={{ background: '#1851cc', color: 'white' }}>

// after
<div style={{
  background: 'var(--colour-primary)',
  color: 'var(--colour-primary-contrast)',
}}>
```

### Surface anything that doesn't fit

If a hex doesn't have a good token match, do NOT silently invent a
token. Surface it in the open-questions section of the brief or in
a code comment, and pick the closest semantic role. The decision
about new tokens is a deliberate design conversation.

### What the visual result should look like

After retrofit and `npm run dev`:

- Feed background: warm cream (`#f4f1ea`)
- Cards: white raised surface
- "New post" link: flag-blue (`#1851cc`)
- "Open in Activist Mailer" button: primary blue
- Avatars: cycle through semantic colours
- Text: warm dark grey on cream
- No greys from Tailwind defaults visible

If the feed still looks generic-Tailwind after retrofit, the
retrofit isn't done. Visual verification is part of acceptance.

---

## Known gotchas

- **Stripping comments in CSS** — different syntax from JS.
  CSS uses `/* ... */` only (no `//` line comments). Treat them
  separately
- **Multi-line strings in JS that contain hex** — e.g. a template
  literal with embedded SVG. Rare in this codebase but possible.
  Strip carefully
- **Tailwind classes look like utility names, not hex** — the rule
  won't catch `bg-blue-500`. Note in open questions whether to
  extend the rule to ban these
- **`tokens.css` import path** — confirm CC reads `styles/tokens.css`
  (not `gps-tokens.css` per the doc-comment header which mentions a
  different name; the actual file IS named `tokens.css`)
- **Theme switching** — `[data-theme="dark"]` overrides apply via
  CSS cascade. Components consume tokens; they don't care which
  theme is active. The retrofit doesn't need to handle this — it's
  already handled by `tokens.css`
- **Reduced-motion media query** — already in `tokens.css`. Don't
  duplicate
- **The avatar colour decision** — the `AVATAR_COLOURS` reuse vs
  bespoke choice is a real design call. Option (a) is cheap; (b)
  is bespoke. Surface
- **`@build-unit F15` header on `canonical-tokens.json`** — JSON
  doesn't support comments. Document the file's purpose in the
  README rather than in the file itself

---

## Tests required

### Unit / rule tests (`require-design-tokens.test.js`)

- Pass: `<div style={{ color: 'var(--colour-primary)' }} />`
- Pass: file with no colours
- Pass: comment containing hex
- Pass: `tokens.css` with many hex (exempt by filename)
- Pass: rule's own test file with hex (exempt)
- Fail: hex in `.tsx` body
- Fail: hex in template literal
- Fail: rgb in inline style
- Fail: hsl in `.css` (non-tokens)
- Fail: rgba in CSS file
- Edge: 3-digit hex (`#fff`) — should fail
- Edge: 8-digit hex (`#11223344` for alpha) — should fail
- Edge: hex inside JSX text content (e.g. `<p>colour #ffffff</p>`)
  — fail (uncommon but principled)

### Integration

After retrofit, `npm run lint` returns 0 errors.

### Visual

Manual click-through after retrofit:
- Feed shows cream + blue
- Compose page shows cream + form styled per components.css
- Post cards use raised white surface

---

## Open questions to surface

Pre-identified. Surface before major design decisions.

1. **`canonical-tokens.json`** — hand-curate (option a) or auto-
   generate from `tokens.css` parsing (option b)? Recommend a.

2. **`AVATAR_COLOURS` retrofit** — reuse existing semantic colours
   (option a) or add new avatar-specific tokens (option b)?
   Recommend a; b is out of scope.

3. **Tailwind utility class banning** — out of scope for v1
   (lenient mode). Defer to F16. Confirm.

4. **Pixel value enforcement** — `padding: '12px'` should ideally
   be `padding: 'var(--space-3)'`. Out of scope for v1 (lenient).
   Defer to F16. Confirm.

5. **Inline `style={{}}` vs `.gps-*` class enforcement** — current
   `PostForm.tsx` uses inline styles with `var(--space-5)`. That
   passes the lenient rule (no hex). Strict mode would require
   migrating to `<form className="gps-form">`. Out of scope; future
   F-rule. Confirm.

6. **Existing components that should be migrated to `.gps-*`
   classes** — surface in retrofit. Don't migrate inline styles
   to classes in this session. Confirm.

7. **Test file scope in lint config** — should `tests/**` be
   exempt entirely from F15, or only test files for the rule
   itself? Recommend the latter (only this rule's test file).

8. **What if `npm run lint` finds violations in files we
   considered "established"?** — surface them in the PR body so
   reviewers see the full retrofit footprint.

9. **Adding a new token** — if any retrofit can't find a clean
   match, surface in open questions; don't add the token in this
   session. New tokens are a follow-up PR + a design conversation.

10. **Header on JSON files** — JSON has no comments. The
    `canonical-tokens.json` file has no `@build-unit` / `@spec`
    header. Verify F13 doesn't fire on `.json` files. If it does,
    decide whether F13's regex should exempt `.json` or whether
    JSON files should be in lint's ignore list.

(Claude Code: surface any further judgement calls during
implementation.)

---

## Definition of done

- [ ] Rule file created and exports valid ESLint rule
- [ ] Rule registered in `eslint-rules/index.js` and
  `eslint.config.js`
- [ ] 12+ test cases (the bulleted list in "Tests required")
- [ ] Convention doc `docs/process/design-tokens-convention.md`
  exists
- [ ] `eslint-rules/README.md` §8 added
- [ ] `docs/build/phase-0-foundations.md` lists F15
- [ ] `canonical-tokens.json` exists
- [ ] `npm run lint` returns 0 errors across the whole repo
- [ ] `npm run typecheck` passes
- [ ] All tests pass (existing + new)
- [ ] Prettier clean
- [ ] Visual verification: `npm run dev`, log in as Eddie, see
  cream + blue palette
- [ ] Every new file has `@build-unit F15` + `@spec` tags
- [ ] Commit message per spec
- [ ] Branch pushed; PR opened; CI green; merged

---

## Context

**Specs:**
- `styles/tokens.css` — the canonical source
- `styles/components.css` — example of correct usage
- `docs/process/ratchet-discipline.md` — F-rule philosophy
- `docs/architecture/decision-log.md` — D038 (traceability) for
  pattern reference

**Existing code to read first:**
- `eslint-rules/rules/require-spec-tag.js` (F13) — closest pattern
  match for an absence-check rule
- `eslint-rules/rules/require-build-unit-header.js` (F06 rule 1)
- `eslint-rules/index.js` — plugin export pattern
- `eslint.config.js` — registration pattern
- `eslint-rules/README.md` — docs voice
- `styles/tokens.css` — every token name and hex
- `styles/components.css` — every `.gps-*` class
- `components/PostCard.tsx` — known retrofit target
- `components/PostForm.tsx` — passes lenient (uses var(...))
- `components/ActivistMailerField.tsx` — likely needs review
- `components/FeedList.tsx` — likely needs review
- `app/feed/page.tsx`, `app/compose/page.tsx`, `app/page.tsx` — likely
  need review

**Process:**
- `docs/process/session-brief-template.md`
- `docs/process/session-hygiene.md`
- `CLAUDE.md`

---

## What this brief does NOT cover

1. **Strict-mode token usage** (banning inline styles where
   `.gps-*` exists) — future F-rule
2. **Tailwind utility class banning** — future F-rule
3. **Pixel value enforcement** — future F-rule
4. **`var(--...)` reference validation** (does the variable exist?)
   — future audit
5. **Adding new tokens** — future PR; not this session
6. **Migrating components to use `.gps-*` semantic classes** —
   recommendation in convention doc, not enforced
7. **Visual redesign** — this session preserves visual intent;
   only mechanically replaces values

---

## Slice convention

F15 is a chore session — no feature code. Commit type
`chore(lint)`. Establishes:

- Precedent for design-system enforcement (parallel to traceability
  enforcement via F13, testid stability via F14)
- Lenient → strict progression as a pattern (other rules can adopt
  this if appropriate)
- Token-first thinking baked into subsequent feature briefs

Future F-rules that follow this shape:
- F16: design-tokens-strict (pixel + Tailwind enforcement)
- F17: validate-token-references (existence check)
- Others as discipline grows

---

## What lands after this session

- Every new file with hardcoded hex fails lint
- Existing components retrofitted to use tokens
- Demo's actual visual rendering matches the design system
  (cream + flag-blue, not Tailwind grey)
- Subsequent feature briefs (BU-link-share, BU-reactions,
  BU-read-state) land on a clean visual foundation

Next session: BU-link-share — feature work resumes with the
discipline scaffold complete.
