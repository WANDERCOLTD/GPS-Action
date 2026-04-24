# `eslint-rules/` — local ESLint plugin

Custom rules that mechanically enforce GPS Action's discipline conventions.
The five rules in this plugin catch mistakes that documentation alone can't:
the rules run in your editor, on commit, and in CI, with no human in the
loop.

**Build Unit:** F06 (Phase 0 foundations)
**Specs implemented:**

- D036 (feature flags) → rule 5
- D038 (traceability) → rule 1
- `process/api-contract-discipline.md` rules 2 & 7 → rules 2 & 4
- `product/analytics-events.md` PII policy → rule 3

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

All five rules ship at `error` severity (block CI).

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
