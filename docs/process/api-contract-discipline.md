# API contract discipline

**Purpose:** tRPC + Zod gives us end-to-end typed contracts for free — _but only if
we follow the rules below_. This document exists because Claude Code sessions will
drift without explicit guardrails. Reviewer uses the checklist at the bottom on
every PR touching routers.

**Applies to:** All code under `server/routers/` and the Zod schemas colocated with
each procedure.

**See also:** D003 (stack), D038 (traceability), `docs/process/reviewer-checklist.md`.

---

## The ten rules

### 1. Every procedure has an explicit input schema

```typescript
// ✅ GOOD
export const publishPostInput = z.object({
  body: z.string().min(1).max(2000),
  region: z.string(),
  postType: z.enum(['action', 'seeking', 'outcome', 'community', 'coordination']),
});

publishPost: t.procedure.input(publishPostInput).mutation(async ({ input, ctx }) => {
  /* ... */
});

// ❌ BAD — no schema, rejected in review
publishPost: t.procedure.mutation(async ({ input, ctx }) => {
  /* ... */
});
```

A procedure with no input schema accepts anything. That's not a contract.

### 2. No `z.any()`. Ever.

`z.any()` defeats the entire point of Zod. If you need polymorphism, use a
discriminated union:

```typescript
// ✅ GOOD
const attachmentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('image'), url: z.string().url(), alt: z.string() }),
  z.object({ type: z.literal('link'), url: z.string().url(), title: z.string() }),
  z.object({
    type: z.literal('file'),
    url: z.string().url(),
    filename: z.string(),
    size: z.number(),
  }),
]);

// ❌ BAD
const attachmentSchema = z.any(); // rejected — what IS an attachment?
```

If truly dynamic data must cross the boundary (rare), wrap it in `z.record(z.string(),
z.unknown())` with a clear comment explaining why, and treat every field as
untrusted on arrival.

### 3. Output types are declared, not inferred from return values

```typescript
// ✅ GOOD
export const publishPostOutput = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  regionSlug: z.string(),
});

publishPost: t.procedure
  .input(publishPostInput)
  .output(publishPostOutput)
  .mutation(async ({ input, ctx }) => {
    /* ... */ return result;
  });

// ❌ BAD — client sees whatever we happen to return today
publishPost: t.procedure.input(publishPostInput).mutation(async ({ input, ctx }) => {
  /* ... */ return result;
});
```

Why: declared outputs survive refactoring. Inferred outputs silently break
clients when someone adds a field or changes a type.

### 4. Errors are typed, thrown via `TRPCError`, never as plain `Error`

```typescript
// ✅ GOOD
import { TRPCError } from '@trpc/server';

if (!userInRegion(ctx.user, input.region)) {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: "You don't have access to this region",
  });
}

// ❌ BAD
throw new Error('no access'); // client sees generic INTERNAL_SERVER_ERROR
throw 'no access'; // never throw strings
```

**Approved error codes only** (no others without an ADR):

| Code                    | When                                               |
| ----------------------- | -------------------------------------------------- |
| `BAD_REQUEST`           | Input passed Zod but failed business rules         |
| `UNAUTHORIZED`          | No valid session                                   |
| `FORBIDDEN`             | Authenticated but not allowed                      |
| `NOT_FOUND`             | Resource genuinely doesn't exist for this user     |
| `CONFLICT`              | State conflict (duplicate, stale, concurrent edit) |
| `TOO_MANY_REQUESTS`     | Rate limit hit                                     |
| `INTERNAL_SERVER_ERROR` | Unexpected — our bug. Should also page Sentry.     |

### 5. Inputs are validated, not coerced

```typescript
// ✅ GOOD — strict
z.string().datetime(); // ISO8601 only
z.coerce.number().int(); // explicit coercion where intended

// ❌ BAD — silently accepts garbage
z.preprocess((s) => new Date(s as string), z.date());
```

Validate at the boundary. If the client sends bad data, tell them. Don't paper
over it.

### 6. Schemas colocated with procedures, exported by name

```typescript
// server/routers/post.ts

export const publishPostInput = z.object({
  /* ... */
});
export const publishPostOutput = z.object({
  /* ... */
});

export const postRouter = t.router({
  publish: t.procedure.input(publishPostInput).output(publishPostOutput).mutation(/* ... */),
});
```

Named exports mean tests and other procedures can import them. Enables fixture
reuse and prevents accidental duplication.

### 7. Authorisation is a middleware, never inline logic

```typescript
// ✅ GOOD
const requireRole = (role: Role) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user || !hasRole(ctx.user, role)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next();
  });

const adminProcedure = t.procedure.use(requireRole('admin'));

export const moderateRouter = t.router({
  banUser: adminProcedure.input(/* ... */).mutation(/* ... */),
});

// ❌ BAD
banUser: t.procedure.mutation(async ({ ctx }) => {
  if (ctx.user?.role !== 'admin') throw new Error('no'); // inline, untested, forgettable
  /* ... */
});
```

Inline auth checks get forgotten, duplicated inconsistently, and are hard to
test uniformly. Middleware centralises the policy.

### 8. Pagination is mandatory on list endpoints — cursor-based, not offset

```typescript
// ✅ GOOD
export const listPostsInput = z.object({
  regionSlug: z.string(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().nullish(),
});

export const listPostsOutput = z.object({
  items: z.array(postSchema),
  nextCursor: z.string().nullable(),
});

// ❌ BAD
listPosts: t.procedure.input(z.object({ regionSlug: z.string() })).query(async () => {
  return db.posts.findMany({ where: { region } });
}); // unbounded
```

Offset pagination (`skip: 200`) gets slow on large tables and produces duplicate
rows under concurrent writes. Cursors are stable, indexable, and cheap.

### 9. Mutation responses include enough to update the UI optimistically

```typescript
// ✅ GOOD — returns the full entity
.output(postSchema)
.mutation(async ({ input }) => {
  const post = await createPost(input)
  return post  // client inserts into cache directly
})

// ❌ BAD — forces the client to refetch
.output(z.object({ success: z.boolean() }))
```

Clients should be able to update local cache from the mutation response alone.
Forcing a refetch is latency the user feels.

### 10. Breaking changes require a new procedure name; the old is marked deprecated

```typescript
// Step 1 — introduce v2 alongside v1
publishPost:   deprecatedProcedure.input(publishPostInputV1).mutation(/* old */),
publishPostV2: t.procedure        .input(publishPostInputV2).mutation(/* new */),

// Step 2 — migrate clients
// Step 3 — remove old in the next "nothing new" week
```

No silent contract breaks. The deprecated procedure lives at least one release
cycle so clients can migrate.

---

## Reviewer checklist (runs through these on every router PR)

- [ ] Input schema present and not `z.any()`?
- [ ] Output schema declared?
- [ ] Authorisation via middleware, not inline?
- [ ] Errors typed as `TRPCError` with approved code?
- [ ] Test covers happy path AND at least one error case per error code?
- [ ] No PII in logs (check for `ctx.user.email`, post bodies, comment text)?
- [ ] Pagination on any list endpoint (cursor, max limit)?
- [ ] Mutation returns the full entity, not `{ success: true }`?
- [ ] Breaking change? Old procedure marked deprecated, not replaced?
- [ ] File header includes `@build-unit`, `@scenarios`, `@spec` annotations (D038)?

---

## When to break the rules

One-shot admin endpoints behind a feature flag in an internal-only dashboard
may skip **rule 8 (pagination)** if the list is inherently bounded (e.g. "list
of admin users" — known to be <50).

Everything else is non-negotiable. Document any exception in the PR description
with reasoning.

---

## Rationale

These rules exist because:

1. **tRPC's value is the contract.** Every shortcut taken here erodes it.
2. **Claude Code sessions are consistent when the pattern is explicit, inconsistent when it isn't.** Rules 1, 3, 4, 6, 7 exist specifically to give Claude Code an unambiguous pattern to follow.
3. **The cost of these rules is 30 seconds per procedure. The cost of skipping them is days of debugging weeks later.**
