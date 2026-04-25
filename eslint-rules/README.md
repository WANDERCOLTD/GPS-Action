# `eslint-rules/` — local ESLint plugin

Custom rules that mechanically enforce GPS Action's discipline conventions.
The eight rules in this plugin catch mistakes that documentation alone can't:
the rules run in your editor, on commit, and in CI, with no human in the
loop.

**Build Unit:** F06 (Phase 0 foundations)
**Specs implemented:**

- D036 (feature flags) → rule 5
- D038 (traceability) → rules 1 & 6
- `process/api-contract-discipline.md` rules 2 & 7 → rules 2 & 4
- `product/analytics-events.md` PII policy → rule 3
- `process/design-tokens-convention.md` → rule 7
- `process/testid-convention.md` → rule 8 (F14)

**Plugin namespace:** `local-rules` — rules appear as
`local-rules/<rule-name>` in `eslint.config.js`.

---

## How it's wired

`eslint.config.js` imports this plugin and scopes each rule to the right file
glob:

| Rule                                                        | File glob it applies to                                                                              |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`require-build-unit-header`](#1-require-build-unit-header) | `app/**/*.{ts,tsx}`, `server/routers/**/*.ts`, `server/services/**/*.ts`, `components/**/*.{ts,tsx}` |
| [`no-trpc-any`](#2-no-trpc-any)                             | `server/routers/**/*.ts`                                                                             |
| [`no-pii-in-logs`](#3-no-pii-in-logs)                       | `app/**/*.{ts,tsx}`, `server/**/*.ts`, `components/**/*.{ts,tsx}`                                    |
| [`no-inline-auth-check`](#4-no-inline-auth-check)           | `server/routers/**/*.ts`                                                                             |
| [`feature-must-have-flag`](#5-feature-must-have-flag)       | `app/**/*.{ts,tsx}`, `server/**/*.ts`, `components/**/*.{ts,tsx}` (opt-in via directive)             |
| [`require-spec-tag`](#6-require-spec-tag)                   | `app/**/*.{ts,tsx}`, `server/routers/**/*.ts`, `server/services/**/*.ts`, `components/**/*.{ts,tsx}` |
| [`require-design-tokens`](#7-require-design-tokens)         | `app/**/*.{ts,tsx}`, `components/**/*.{ts,tsx}`                                                      |
| [`require-testid`](#8-require-testid)                       | `app/**/*.{ts,tsx}`, `components/**/*.{ts,tsx}`                                                      |

All eight rules ship at `error` severity (block CI).

Excluded paths (rules don't apply): `eslint-rules/**`, `prisma/**`, `tests/**`,
`*.test.{ts,js}`, `node_modules/**`, `.next/**`, `dist/**`, `build/**`.

---

## The rules

### 1. `require-build-unit-header`

**Purpose:** Per D038, every code file in the application's source tree must
declare which Build Unit it belongs to. The header is the bottom rung of the
traceability ladder — without it, `scripts/trace.ts` can't follow code back
to its scenario or spec.

**Fires when:** First 10 non-blank lines have no `@build-unit` JSDoc tag.

**Compliant:**

```typescript
/**
 * @build-unit BU-003
 * @scenarios SCN-02
 * @spec §3.4
 */
export function publishPost() { ... }
```

```typescript
'use client';
/**
 * @build-unit BU-005
 */
export const FeedItem = () => { ... };
```

**Violating:**

```typescript
// no header at all
export function publishPost() { ... }
```

```typescript
/**
 * Some module that does things.
 * @author paul
 */
// → no @build-unit tag, fires
export function publishPost() { ... }
```

**Edge cases:**

- Empty files are exempt.
- A leading `'use client'` directive does not count against the 10-line
  scan window — the header just needs to land within 10 _non-blank_ lines.
- A leading import block consumes lines from the scan window. If you have
  more than 9 leading imports, the header has to come before them.

---

### 2. `no-trpc-any`

**Purpose:** Per `api-contract-discipline.md` rule 2, `z.any()` defeats
tRPC's contract. If a payload truly is dynamic, use a discriminated union or
`z.unknown()` — both keep the contract honest.

**Fires when:** `z.any()` appears in `server/routers/**/*.ts`.

**Compliant:**

```typescript
const schema = z.object({ context: z.unknown() });
const attachment = z.discriminatedUnion('type', [
  z.object({ type: z.literal('image'), url: z.string().url() }),
  z.object({ type: z.literal('link'), url: z.string().url(), title: z.string() }),
]);
```

**Violating:**

```typescript
const schema = z.any(); // bare
const schema = z.array(z.any()); // nested
const schema = z.object({ payload: z.any() }); // in property
const schema = z.any().describe('legacy'); // chained
```

**Edge cases:**

- `z.unknown()` is permitted — it forces the consumer to narrow.
- `z.any()` inside a string literal or comment is ignored.
- An aliased call like `const Any = z.any` followed by `Any()` is **not**
  caught — the rule only matches the literal `z.any()` call expression.
  Pragmatic for MVP; revisit if anyone tries this trick.

---

### 3. `no-pii-in-logs`

**Purpose:** Per `analytics-events.md`'s PII policy, no email, phone,
postcode, address, body, or display name ever touches structured logs,
Sentry, or analytics. The same risk pattern applies to `console.*` calls
that survive into production.

**Fires when:** A logging call (`console.{log,info,warn,error,debug}`,
`logger.*`, `Sentry.{captureMessage,captureException}`) includes an
expression that touches a PII field.

**PII patterns checked:**

| Kind           | Names                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Property names | `email`, `phone`, `phoneNumber`, `postcode`, `address`, `body`, `displayName`, `firstName`, `lastName`, `fullName` |
| Variable names | `email`, `phone`, `phoneNumber`, `postcode`, `password`, `apiKey`, `secret`, `token`                               |
| Safe variants  | `*Hash` (e.g. `emailHash`, `phoneHash`, `displayNameHash`)                                                         |

The rule walks template literals (`` `Failed for ${user.email}` ``), object
expressions, conditionals, binary expressions, and nested calls. Object
spreads (`{ ...user }`) inside log arguments fire — spreading any object
into a log call is a PII vector.

**Compliant:**

```typescript
console.log(user.id);
logger.info({ userId: user.emailHash });
console.log({ email: 'masked' }); // PII as key, not value
```

**Violating:**

```typescript
console.log(user.email);
logger.error(`Failed for ${user.email}`);
Sentry.captureMessage('boom', { ...user });
console.warn(email); // PII variable name
logger.info({ email }); // shorthand property
```

**Edge cases:**

- Tests are exempt (the lint config excludes `tests/**` and `*.test.*`).
- The string literal `"user.email"` is fine — only the AST expression
  `user.email` fires.
- A logging call that takes a variable named `body` will fire if the
  variable is named that way. Rename the variable if it's safe content.

---

### 4. `no-inline-auth-check`

**Purpose:** Per `api-contract-discipline.md` rule 7, authorisation belongs
in middleware, not inline conditionals. Inline auth is forgettable, hard to
test uniformly, and inconsistent across procedures. The rule catches
procedures that read `ctx.user.role` (and similar) without a `.use()`
middleware in their chain.

**Fires when:** A `.mutation()`, `.query()`, or `.subscription()` body
contains `ctx.user.role`, `ctx.user.permissions`, `ctx.session.role`, etc.,
AND the procedure chain has no `.use(...)` call.

**Compliant:**

```typescript
const adminProcedure = t.procedure.use(requireRole('admin'));

export const banUser = adminProcedure.input(/* ... */).mutation(({ ctx }) => {
  // Fine — middleware ran. Reading ctx.user.role here is OK.
  return doThing(ctx);
});

export const listFlags = t.procedure.use(authMiddleware).query(({ ctx }) => {
  return ctx.user.role; // middleware present — OK
});
```

**Violating:**

```typescript
export const banUser = t.procedure.mutation(({ ctx }) => {
  if (ctx.user.role !== 'admin') throw new Error('no'); // inline, forgettable
  return doThing();
});
```

**Edge cases:**

- The rule doesn't inspect what `.use()` is called with — it assumes
  middleware does its job. Pragmatic; per the brief, "any `.use()` before
  `.mutation()`/`.query()` is enough."
- Reading `ctx.user.id` or `ctx.user.displayName` does NOT fire — only
  `role`, `roles`, `permissions` are auth fields.
- `ctx.session.role` and `ctx.session.permissions` also fire.

---

### 5. `feature-must-have-flag`

**Purpose:** Per D036, every substantial feature ships behind a flag. The
discipline is opt-in: a file marked `// @feature-gated` has explicitly
volunteered for the check. The rule then verifies that
`isFeatureEnabled` is actually imported and called.

**Fires when:** A file contains the comment `@feature-gated` (line or block)
but does not have a satisfying combination of an `isFeatureEnabled` import
and an `isFeatureEnabled` call.

**Satisfying combinations:**

- `import { isFeatureEnabled } from '...'` + `isFeatureEnabled(...)` (bare call)
- `import * as flags from '...'` + `flags.isFeatureEnabled(...)` (member call)

**Compliant:**

```typescript
// @feature-gated
import { isFeatureEnabled } from '@/server/lib/flags';

export function go(ctx) {
  if (!isFeatureEnabled('ff_x', ctx)) return null;
  return run();
}
```

```typescript
/* @feature-gated */
import * as flags from '@/server/lib/flags';

export function go(ctx) {
  return flags.isFeatureEnabled('ff_x', ctx) ? run() : null;
}
```

**Violating:**

```typescript
// @feature-gated
export const x = 1; // no import, no call → fires
```

```typescript
// @feature-gated
import { isFeatureEnabled } from './flags';
export const x = 1; // imported but never called → fires
```

**Edge cases:**

- No directive ⇒ rule never fires (opt-in by design).
- Multiple `@feature-gated` directives are deduplicated; one is enough.
- The directive in a JSDoc block (`/** @feature-gated */`) is recognised.

---

### 6. `require-spec-tag`

**Purpose:** Per D038, every code file with a `@build-unit` tag must also carry
at least one `@spec` tag pointing at the relevant spec or decision document.
Rule 1 (`require-build-unit-header`) enforces the `@build-unit` tag; this rule
enforces the companion `@spec` tag. Together they maintain full traceability.

**Fires when:** First 10 non-blank lines contain `@build-unit` but no
`@spec <value>` tag.

**Compliant:**

```typescript
/**
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 */
export function createPost() { ... }
```

```typescript
/**
 * @build-unit BU-012
 * @spec architecture/decision-log.md (D038)
 * @spec product/scenarios.md
 */
export const FlagButton = () => { ... };
```

**Violating:**

```typescript
/**
 * @build-unit BU-feed
 */
// → has @build-unit but no @spec, fires
export function createPost() { ... }
```

```typescript
/**
 * @build-unit BU-003
 * @scenarios SCN-02
 */
// → @scenarios is not @spec, fires
export function publishPost() { ... }
```

**Edge cases:**

- Files without `@build-unit` are not checked — utility files pass freely.
- Empty files are exempt.
- `@spec` must have a non-empty value (bare `@spec` with no path does not satisfy).
- The rule does not validate that the referenced spec file exists — that's
  future audit work, not a lint rule.

---

### 7. `require-design-tokens`

**Purpose:** Per `design-tokens-convention.md`, every UI file must use
design tokens from `styles/tokens.css` rather than hardcoded colour values.
Without enforcement, hardcoded hex values drift into components and the
visual identity fragments — same shape of problem F13 solved for `@spec`
traceability.

**Fires when:** File contains a hardcoded colour value:

- Hex: `#1851cc`, `#fff`, `#11223344` (3/4/6/8-digit forms)
- RGB: `rgb(...)`, `rgba(...)`
- HSL: `hsl(...)`, `hsla(...)`

Comments are exempt — hex inside `/* ... */` or `// ...` is ignored.

**Compliant:**

```tsx
<div style={{ color: 'var(--colour-primary)' }} />;

const COLOURS = ['var(--colour-primary-bright)', 'var(--colour-success)', 'var(--colour-cultural)'];
```

**Violating:**

```tsx
<div style={{ color: '#1851cc' }} />;

const COLOURS = ['#4577e8', '#0f6e56'];

const overlay = 'rgba(0, 0, 0, 0.5)';

const accent = 'hsl(220, 70%, 45%)';
```

**Edge cases:**

- `styles/tokens.css` is exempt — it's the canonical source of hex values.
- The rule's own test file is exempt by filename.
- Hex values inside comments are not flagged (comments are stripped before
  scanning).
- Error messages include a "closest match" suggestion from
  `canonical-tokens.json` when a mapping exists.
- `var(--colour-...)` references are allowed regardless of whether the
  variable actually exists — validating references is future work.
- This is **lenient mode** (v1). Future rules may enforce pixel values
  (`padding: '12px'` → `var(--space-3)`) and Tailwind utility classes.

---

### 8. `require-testid`

**Purpose:** Per `testid-convention.md`, every interactive DOM element in
feature code carries a stable `data-testid` attribute matching the
canonical format. Tests, scenario walk-throughs, and any future automated
runner select on testids — drift breaks them silently. The rule is the
third sibling to `require-build-unit-header` (F06 rule 1) and
`require-spec-tag` (F13): traceability + DOM-stability ratchet.

**Fires when:** A built-in HTML interactive element (`button`, `a`,
`input`, `select`, `textarea`, `form`, `label`) OR any element with an
interactive handler attribute (`onClick`, `onChange`, `onSubmit`,
`onKeyDown`, `onKeyUp`, `onKeyPress`, `onFocus`, `onBlur`) lacks a
well-formed `data-testid`.

**Format:** `^[a-z]+(-[a-z0-9]+){2,}$` — lowercase, hyphenated, 3+
segments, first segment from the canonical area list at
`eslint-rules/canonical-areas.json`.

**Compliant:**

```tsx
<button data-testid="feed-newpost-submit">Publish</button>
<a data-testid="post-am-link" href={url}>Open in AM</a>
<input data-testid="compose-title-input" />
<form data-testid="auth-devlogin-form">…</form>

// Custom React components are exempt — checked at their definition site
<Button>Save</Button>

// Non-interactive elements are exempt
<div className="wrapper">content</div>

// List items: stable testid + dynamic identity in a separate data-* attr
<article data-testid="post-card" data-post-id={post.id}>…</article>
```

**Violating:**

```tsx
<button onClick={...}>Go</button>                              // missing
<button data-testid={`feed-${id}`}>Go</button>                 // notStatic
<button data-testid="feedNewpostSubmit">Go</button>            // badFormat
<button data-testid="feed_newpost_submit">Go</button>          // badFormat
<button data-testid="feed-button">Go</button>                  // badFormat (2 segments)
<button data-testid="widgets-foo-bar">Go</button>              // unknownArea
<button testid="feed-foo-bar">Go</button>                      // missing (typo)
<button data-test-id="feed-foo-bar">Go</button>                // missing (wrong attr name)
```

**Edge cases:**

- **Custom components are exempt at the use site.** `<PostForm />` is
  not checked; the underlying `<form>` inside `PostForm.tsx` is.
- **Decorative handlers** (`onMouseEnter`, `onMouseLeave`, `onScroll`)
  are intentionally excluded — they don't make an element a test target.
- **Namespaced JSX names** (`<svg:rect>`) are treated as custom and
  skipped — defensive AST handling.
- **Canonical area list is fail-loud.** If
  `eslint-rules/canonical-areas.json` is missing or malformed, the rule
  throws at load time. Silent fallback risks accepting unknown prefixes.
- **Adding an area:** update `eslint-rules/canonical-areas.json` AND
  `docs/process/testid-convention.md` in the same PR.
- **No auto-fix.** Errors only — the test author has to choose the
  testid intentionally.

---

## Header convention exception for these files

D038 says every code file in the source tree carries a `@build-unit` header.
The rule files in this directory are JS-not-TS (because ESLint plugins must
be ECMAScript modules consumable by ESLint v9), and they live outside the
application source tree. The header convention applies to them more loosely:
each rule file _does_ carry an `@build-unit F06` header for traceability,
but `require-build-unit-header` itself is configured to skip
`eslint-rules/**` so it doesn't recursively check itself.

---

## How to run the tests

```bash
npm run test
```

The repo's vitest config picks up `eslint-rules/tests/**/*.test.js`
alongside the regular `tests/` folder, so all rule tests run with the rest
of the suite. Each rule's test file uses ESLint's `RuleTester` API and
includes at least 3 valid + 3 invalid examples plus edge cases.

---

## How to add a new rule

When a future session needs to enforce a new convention:

1. **Read the spec.** A rule's behaviour must match the documented policy.
   If the policy isn't written, write it first and link to it from the
   rule's header.
2. **Create `eslint-rules/rules/<rule-name>.js`.** Each rule exports a
   default object with `meta` (type, docs, messages, schema) and `create`.
   Use ESLint v9's flat `RuleModule` shape.
3. **Create `eslint-rules/tests/<rule-name>.test.js`** with at least 3
   valid + 3 invalid examples and a comment noting any deliberate gaps in
   coverage.
4. **Register the rule in `eslint-rules/index.js`** under the
   `local-rules` namespace.
5. **Wire the rule into `eslint.config.js`** with the right `files` glob
   and severity. Preserve existing entries — append, don't rewrite.
6. **Format and validate:**
   ```bash
   npx prettier --write eslint-rules/
   npm run test
   npm run lint
   ```
7. **Document the rule in this README** under "The rules" with purpose,
   fires-when, compliant + violating examples, and edge cases.

---

## What this plugin does NOT do

- **Auto-fixes.** None of the rules have an auto-fix implementation. If
  fixing is mechanical (e.g., inserting a `@build-unit TODO` header), a
  future enhancement can add `fixable: 'code'` and a `fix()` function. For
  MVP, the failure is the prompt to fix it manually.
- **Configuration via ESLint options.** None of the rules accept options
  yet (their `schema` is `[]`). PII patterns, AUTH field names, and
  function names are hardcoded constants in their respective rules. If we
  need per-project tuning, we'll add an options schema.
- **Severity tuning.** All rules are `error`. If a rule needs to start as
  `warn` and graduate to `error`, change the severity in `eslint.config.js`
  for that rule's entry.
- **Editor configuration.** VS Code's ESLint extension picks up the rules
  automatically once `eslint.config.js` references them. If it doesn't,
  Cmd+Shift+P → "ESLint: Restart ESLint Server".
- **Schema-shape checks** (e.g., "every Prisma entity has a displayName").
  That's a different kind of check — Prisma schema lint, not ESLint.
  Future session.
- **Refactoring existing code to comply.** When this plugin lands, it will
  flag pre-existing files. Surface the list; fix in a follow-up PR.
