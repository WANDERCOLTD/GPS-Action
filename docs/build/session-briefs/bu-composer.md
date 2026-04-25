# SESSION BRIEF · BU-composer — Simple post creation form

*Brief version: 1.0 · Author: Paul · Date: April 2026*
*Refined from v0.9 after BU-feed executed. Key refinements based on*
*actual patterns CC shipped:*
*- Components flat at top-level (no `composer/` subdirectory)*
*- Server actions pattern for client-triggered mutations (mirrors FeedList load-more)*
*- Service-layer pattern matches `listPosts` in `server/services/post.ts`*
*- AM URL rendering already works in `components/PostCard.tsx`*
*- F13 active — every new file MUST have `@spec` tags*

---

## Objective

Build the post composer — the final piece of the demo loop. Eddie
clicks "New post" from the feed, fills a simple form, submits, returns
to the feed with his post at the top. The post card already shows
"Open in Activist Mailer" if the URL is present (BU-feed handled
this).

After this session, the demo is functional end-to-end:
**login → feed → compose → see new post → click AM link → opens campaign**.

**Simple form, not FAB cards.** Per D044, the eventual composer uses
intent-cards. BU-composer is a stepping stone — proves the wire-up
works. The full composer is BU-005 post-demo.

---

## Scope

### Build in this session

**Server — services:**
- `server/services/post.ts` (MODIFY — add `createPost()` business
  logic; preserve existing `listPosts` and types)

**Server — router:**
- `server/routers/post.ts` (MODIFY — add `.create` mutation using
  `authedProcedure`; preserve existing `.list`)

**Server — shared validation:**
- `shared/validation/post.ts` (new — Zod schemas including AM URL
  domain allowlist)
  - If `shared/validation/` doesn't exist yet, create the directory

**Client — page:**
- `app/compose/page.tsx` (new — server component that renders the form
  shell; redirects unauthenticated users to /dev/login)
- `app/compose/actions.ts` (new — server action `createPostAction`
  that wraps the tRPC mutation, mirrors `app/feed/actions.ts` pattern)

**Client — components (flat at top-level, matching CC's convention):**
- `components/PostForm.tsx` (new — client component with form state)
- `components/ActivistMailerField.tsx` (new — URL input with inline
  validation feedback)

**Client — feed integration:**
- `app/feed/page.tsx` (MODIFY — add a "New post" link to /compose,
  visible to authenticated users)
- `app/page.tsx` (MODIFY only if needed — should already redirect
  authenticated users to /feed)

**Tests:**
- `tests/integration/post-create.test.ts` (new — `post.create` end-to-end
  via createCaller; auth requirement, validation, audit log written)
- `tests/unit/post-validation.test.ts` (new — Zod schema for AM URL
  allowlist edge cases)

**Docs:**
- `CLAUDE.md` (MODIFY — small addition: `/compose` exists for
  creating posts in dev)

### Do NOT touch

- `prisma/schema.prisma` — no schema changes; Post fields exist
- `server/lib/auth.ts`, `server/lib/trpc.ts` — use only
- `server/services/audit.ts` — call `auditLog()` after successful
  create; do not modify the service
- `server/routers/context.ts`, `server/routers/dev.ts`,
  `server/routers/_app.ts` — already register `post`; no changes
- `components/PostCard.tsx` — AM URL rendering already works; no
  changes needed
- `components/FeedList.tsx` — loads posts; doesn't need changes
- `components/auth/LoggedInAs.tsx` — works as-is
- `scripts/seed.ts` — composer creates real posts; no seed changes
- `eslint.config.js`, `eslint-rules/**` — F06 + F13 apply, don't modify
- ADRs, decision-log.md — no new decisions
- All session briefs except possibly this one

### Out of scope for this session

- **FAB intent-cards composer** — BU-005 post-demo per D044
- **Image / attachment upload** — Phase 2 per `image-handling.md`
- **Draft saving** — parking-lot
- **Post editing after creation** — BU-020 admin surface
- **Markdown rendering** — body is plain text, line breaks preserved
- **Live preview** — no preview pane in MVP
- **Post type selection (PostType)** — deferred per D048
- **Post tone selection (PostTone)** — deferred per D048
- **Group tagging UI** — `groupTags` exists on schema, but UI is
  post-demo
- **Schedule for later / `expiresAt`** — post-demo
- **Mentions / user references** — post-demo
- **Deep-linking** — `/share?url=...` per D018 is BU-007
- **Optimistic UI** — full server roundtrip is fine; demo doesn't
  need optimistic
- **Cache invalidation strategy** — keep simple (full reload via
  redirect; covered below)

---

## Contracts

### Inputs consumed

- `prisma/schema.prisma` — Post model (no `type` field per D048;
  `activistMailerUrl: String?`, `visibility: PostVisibility`)
- `server/lib/auth.ts` — context shape and helpers
- `server/lib/trpc.ts` — `authedProcedure`, `router`
- `server/services/post.ts` — extend, follow same conventions; the
  file already has clean type interfaces (`PostListItem`, `PostAuthor`,
  `PostCursor`)
- `server/services/audit.ts` — call `auditLog()` on successful
  creation
- `server/routers/post.ts` — extend, follow same conventions
- `server/routers/_app.ts` — `post` router already registered; no
  changes
- `components/PostCard.tsx` — already renders AM URLs; references
  the eventual rendering of new posts (no modifications)
- `app/feed/actions.ts` — pattern reference for server actions
- `components/FeedList.tsx` — pattern reference for client components
- `docs/architecture/decision-log.md` — D045 (visibility default),
  D048 (type deferred)
- `docs/product/design-philosophy.md` — honest copy
- `docs/product/post-creation-flow.md` — note the supersession by
  D048; use as background only

### Outputs produced

Contracts future sessions rely on:

- **`createPost()` service function** — takes input + author ID,
  validates, creates row, audits
- **`post.create` tRPC mutation** — auth-required entry point
- **`createPostAction` server action** — client-callable wrapper
  that calls the mutation
- **`postCreateSchema` Zod schema** — exported from
  `shared/validation/post.ts`, reusable
- **AM URL allowlist validation** — env-configurable, defaults to
  `activistmailer.com`
- **`/compose` route** — composer page

---

## Acceptance criteria

### Functional (click-through verifiable)

- [ ] Eddie logged in → on /feed → sees "New post" button/link
- [ ] Click "New post" → goes to /compose
- [ ] /compose unauthenticated → redirects to /dev/login (with
  return-to query param so post-login lands back at /compose)
- [ ] Form has 4 fields: title, body, activistMailerUrl (optional),
  visibility (radio: public / authenticated only)
- [ ] Default visibility: `public` (per D045)
- [ ] Submit button: simple label like "Post" or "Publish" (NOT
  "Take Action!" or marketing copy per design-philosophy.md)
- [ ] Empty title or body → inline error, prevents submit
- [ ] Title min 3 chars, max 200 chars; trimmed on save
- [ ] Body min 10 chars, max 10000 chars; line breaks preserved
- [ ] AM URL optional. If present, must:
  - Pass URL parsing
  - Use https (not http)
  - Be from allowlisted domain (env-configurable)
- [ ] Successful submit → redirect to /feed → new post at top
- [ ] AM button on the new post card opens URL in new tab (PostCard
  handles this; just verify it works post-create)
- [ ] Cancel button on form → returns to /feed without saving
- [ ] Audit log entry written on successful create:
  - action: `post_created`
  - entityType: `post`
  - entityId: new post's id
  - userId: author's id
  - changes: metadata only (NOT body content — F06 rule 3 catches
    PII in logs)
  - context: `{ source: 'composer' }`

### Non-functional

- [ ] All F06 lint rules pass (header, no PII logs, no z.any, no
  inline auth, feature-flag gates if used)
- [ ] **F13 passes** — every new file has BOTH `@build-unit BU-composer`
  AND at least one `@spec` tag
- [ ] TypeScript strict; no `any`; no `@ts-ignore`
- [ ] No new `!` non-null assertions (BU-001-lite + BU-feed have 7
  combined; this session adds zero)
- [ ] Prettier clean
- [ ] Tests pass (existing 108 + new ~10-15)
- [ ] Boundary respected: `services/` may import from `db/` and
  `shared/`; `routers/` may not import from `db/` directly
- [ ] No DB queries in `server/lib/` or `server/routers/`

---

## Header convention reminder

Every new file gets a JSDoc header. F13 is now active and will fail
the build if `@spec` is missing on a file that has `@build-unit`.

**Template (match BU-feed's pattern):**

```typescript
/**
 * @build-unit BU-composer
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D045)
 *
 * (description here)
 */
```

For files where multiple specs apply, list them all. Examples:

- `server/services/post.ts` (modify): keep existing tags + add
  `@spec product/post-creation-flow.md` (or whichever new spec is
  most relevant to the create logic)
- `server/routers/post.ts` (modify): preserve existing
  `@spec architecture/api-contract.md`
- `components/PostForm.tsx`: `@spec product/design-philosophy.md` +
  `@spec architecture/api-contract.md`

---

## The post.create procedure — contract

### Server action approach

Mirror `app/feed/actions.ts`. The composer's submit flow:

1. Client form submits → server action `createPostAction(formData)`
2. Server action validates input via Zod
3. Server action calls tRPC mutation via `createCaller`
4. On success: revalidate `/feed`, redirect to `/feed`
5. On failure: throw an error that the client form catches + displays

Reasoning: tRPC `createCaller` from server-side gives type-safe
mutation invocation without HTTP roundtrip. Same pattern as feed's
load-more.

### Input schema (in `shared/validation/post.ts`)

```typescript
import { z } from 'zod';

const ALLOWED_DOMAINS = (
  process.env.ACTIVIST_MAILER_ALLOWED_DOMAINS ?? 'activistmailer.com'
)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const activistMailerUrlSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true; // optional, blank ok
      try {
        const url = new URL(val);
        if (url.protocol !== 'https:') return false;
        const host = url.hostname.toLowerCase();
        return ALLOWED_DOMAINS.some(
          (d) => host === d || host.endsWith(`.${d}`),
        );
      } catch {
        return false;
      }
    },
    {
      message:
        'Activist Mailer URL must be https and from an allowed domain',
    },
  );

export const postCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().min(10).max(10000),
  activistMailerUrl: activistMailerUrlSchema,
  visibility: z.enum(['public', 'authenticated_only']).default('public'),
});

export type PostCreateInput = z.infer<typeof postCreateSchema>;
```

### Service signature

```typescript
// server/services/post.ts (extend)

import type { PostCreateInput } from '@/shared/validation/post';
import { auditLog } from '@/server/services/audit';

export async function createPost(
  input: PostCreateInput,
  authorId: string,
): Promise<{ id: string }> {
  const post = await prisma.post.create({
    data: {
      title: input.title,
      body: input.body,
      activistMailerUrl: input.activistMailerUrl?.trim() || null,
      visibility: input.visibility,
      authorId,
    },
    select: { id: true },
  });

  await auditLog({
    action: 'post_created',
    entityType: 'post',
    entityId: post.id,
    userId: authorId,
    changes: {
      titleLength: input.title.length,
      bodyLength: input.body.length,
      visibility: input.visibility,
      hasActivistMailerUrl: Boolean(input.activistMailerUrl),
    },
    context: { source: 'composer' },
  });

  return post;
}
```

**Important:**
- Empty/blank `activistMailerUrl` stored as NULL (not empty string)
- `changes` log records metadata only — NOT body content (PII safety)
- `context` records source for future analytics

### Router signature

```typescript
// server/routers/post.ts (extend)

import { router, publicProcedure, authedProcedure } from '@/server/lib/trpc';
import { listPosts, createPost } from '@/server/services/post';
import { postCreateSchema } from '@/shared/validation/post';

export const postRouter = router({
  list: publicProcedure
    .input(/* existing */)
    .query(/* existing */),

  create: authedProcedure
    .input(postCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // ctx.user is non-null by virtue of authedProcedure
      return createPost(input, ctx.user.id);
    }),
});
```

---

## Form field spec

| Field | Input type | Validation | Default |
|---|---|---|---|
| `title` | `<input type="text">` | required, 3-200 chars, trimmed | empty |
| `body` | `<textarea>` (rows=10) | required, 10-10000 chars, preserve line breaks | empty |
| `activistMailerUrl` | `<input type="url">` | optional; if present, must pass URL + https + domain allowlist | empty |
| `visibility` | `<input type="radio">` (2 options) | exactly one selected | `public` |

**No type field. No tone field. No group tagging UI.** All deferred per D048 + parking-lot.

---

## Form component pattern

### `components/PostForm.tsx` — client component

```typescript
'use client';

/**
 * @build-unit BU-composer
 * @spec product/design-philosophy.md
 * @spec architecture/api-contract.md
 *
 * Post creation form. Client component — manages form state, calls
 * the createPostAction server action on submit.
 */

import { useState, useTransition } from 'react';
import { createPostAction } from '@/app/compose/actions';
import { ActivistMailerField } from './ActivistMailerField';

export function PostForm() {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // form state...

  return (
    <form action={(formData) => {
      startTransition(async () => {
        const result = await createPostAction(formData);
        if (result?.errors) {
          setErrors(result.errors);
        }
        // success: server action redirects, this returns void
      });
    }}>
      {/* fields */}
    </form>
  );
}
```

### Server action pattern

```typescript
// app/compose/actions.ts

'use server';

/**
 * @build-unit BU-composer
 * @spec architecture/api-contract.md
 *
 * Server action wrapping post.create for client-side form submit.
 * Mirrors app/feed/actions.ts pattern.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { postCreateSchema } from '@/shared/validation/post';
import { createCallerForRequest } from '@/server/routers/_app'; // verify exact path
import { TRPCError } from '@trpc/server';

export async function createPostAction(formData: FormData) {
  const raw = {
    title: formData.get('title')?.toString() ?? '',
    body: formData.get('body')?.toString() ?? '',
    activistMailerUrl: formData.get('activistMailerUrl')?.toString() || undefined,
    visibility: formData.get('visibility')?.toString() ?? 'public',
  };

  const parsed = postCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const caller = await createCallerForRequest();
    await caller.post.create(parsed.data);
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'UNAUTHORIZED') {
      redirect('/dev/login?returnTo=/compose');
    }
    return { errors: { _form: ['Could not create post. Try again.'] } };
  }

  revalidatePath('/feed');
  redirect('/feed');
}
```

**Note:** the exact name `createCallerForRequest` is illustrative —
check what BU-feed used in `app/feed/actions.ts` and match that
pattern.

---

## Known gotchas (refined from v0.9 + BU-feed learnings)

### Authentication

- Use `authedProcedure`, not `publicProcedure` — composer requires
  login
- F06 rule 4 (no inline auth) catches inline `ctx.user` checks; use
  the procedure helper instead
- If unauthenticated, server action redirects to `/dev/login?returnTo=/compose`

### Services boundary

- ALL Prisma queries in `server/services/post.ts`
- Router calls service; never queries DB directly
- Validators live in `shared/validation/post.ts` (per project
  convention — `shared/` is importable from anywhere)

### Audit log invariants

- ONLY successful creates get audited
- Failed creates (validation errors, auth errors) do NOT audit
- Changes record metadata only — never body content (F06 rule 3
  catches PII)
- Context indicates source: `'composer'`

### Empty / blank handling

- `activistMailerUrl` empty string from form → stored as `null`
- Title trimmed before save (Zod handles via `.trim()`)
- Body preserves whitespace as-is (don't trim — line breaks matter)

### Post-create UX

- After successful create: `revalidatePath('/feed')` then
  `redirect('/feed')` — user sees fresh feed with their post
- Don't try to do optimistic UI — full reload is fine for demo
- Don't try to keep the form data on error and redirect — let the
  form keep its state via React, errors come back via the server
  action's return value

### F13 (active now)

- Every new file MUST have `@build-unit BU-composer` + at least
  one `@spec` tag
- Lint will fail otherwise

### `!` assertions

- BU-001-lite + BU-feed have 7 legitimate `!` assertions
- BU-composer should add ZERO new ones
- Prefer type narrowing, early returns, or proper non-nullable
  types

### URL allowlist defaults

- Default in dev: `activistmailer.com`
- Configurable via `ACTIVIST_MAILER_ALLOWED_DOMAINS` env var
  (comma-separated)
- Surface in open questions whether `.env.example` should document
  this

### `shared/validation/` directory

- May not exist yet. Create it. Add an `index.ts` if the project
  convention is to re-export from one place; otherwise just the
  `post.ts` file.

### `createCaller` discovery

- The exact pattern for invoking tRPC server-side from a server
  action depends on what BU-feed used. Check `app/feed/actions.ts`
  and match it. The composer's server action follows the same
  shape.

---

## Tests required

### Integration: `tests/integration/post-create.test.ts`

- `post.create` with valid minimal input → success, returns id
- `post.create` with valid input + AM URL → success
- `post.create` with title too short → fails validation
- `post.create` with body too short → fails validation
- `post.create` with body too long → fails validation
- `post.create` with AM URL not https → fails validation
- `post.create` with AM URL from disallowed domain → fails
- `post.create` with empty AM URL → success (stores null)
- `post.create` unauthenticated context → UNAUTHORIZED
- `post.create` writes audit log entry with correct shape
- `post.create` with default visibility (omitted) → public

### Unit: `tests/unit/post-validation.test.ts`

- AM URL accepts `https://activistmailer.com/...`
- AM URL accepts `https://subdomain.activistmailer.com/...`
- AM URL rejects http
- AM URL rejects malformed URLs
- AM URL rejects disallowed domains
- AM URL accepts undefined / empty string
- Title trims whitespace
- Body preserves whitespace
- Visibility defaults to public when omitted

### Manual click-through verification

- Login as Eddie → /feed → see "New post" button → /compose →
  fill form → submit → /feed shows new post on top → AM button
  on the new card opens URL

---

## Open questions to surface

Pre-identified. Surface before major design decisions.

1. **Server action vs tRPC HTTP mutation from client.** Server
   action approach (mirror `app/feed/actions.ts`) is recommended.
   Confirm or propose alternative.

2. **Form library choice.** React's built-in form + useState is
   simpler. Alternatives: react-hook-form, formik. Recommend native
   form + useState. Confirm.

3. **AM URL allowlist — real domain.** Placeholder is
   `activistmailer.com`. What's the actual production domain?
   Surface; use placeholder for demo.

4. **`shared/validation/` directory exists?** Check before creating.
   If yes, add `post.ts`. If no, create the dir + file.

5. **`createCaller` import path.** Check what BU-feed used in
   `app/feed/actions.ts`. Match exactly. Surface the path used.

6. **Auth redirect approach.** When unauthenticated user hits
   /compose, server action throws or redirects. Recommend redirect
   with `returnTo` param. Confirm.

7. **Form error display.** Inline next to each field, or summary
   at top? Recommend inline. Confirm.

8. **Submit button state.** Disable while pending? Show spinner?
   Recommend disable + simple "Posting..." text. Confirm.

9. **Body textarea size.** Fixed height with scroll, or auto-grow?
   Recommend fixed height (rows=10), simple. Confirm.

10. **Cancel button behavior.** Plain link to /feed, or warn if
    fields are dirty? Recommend plain link (demo doesn't need
    dirty-state warning). Confirm.

11. **Character count indicator.** Subtle counter near body field
    when approaching 10000 limit? Recommend skip for demo.

12. **`returnTo` query param.** When unauth user hits /compose,
    redirect carries `?returnTo=/compose`. After login (in
    /dev/login's existing flow), should it honour `returnTo`?
    Surface — may require a tiny tweak to `/dev/login` action,
    or accept that user lands on / after login (acceptable for
    demo; can fix later).

(Claude Code: surface any further judgement calls.)

---

## Definition of done

- [ ] All files in "Build" list created/modified as specified
- [ ] No files in "Don't touch" list modified except `app/feed/page.tsx`
  (small "New post" link addition)
- [ ] `npx prisma validate` passes (no schema changes expected)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes:
  - 0 errors
  - F06 + F13 rules satisfied
  - Warning count ≤ 7 (the existing `!` assertions; no new ones)
- [ ] `npx prettier --check .` passes
- [ ] All tests pass (108 existing + ~10-15 new = ~120-125 total)
- [ ] Every new file has `@build-unit BU-composer` + at least one
  `@spec` tag (F13 enforces)
- [ ] Manual click-through works: login → feed → compose → submit →
  feed shows new post with working AM button
- [ ] Commit message:
  `feat(composer): BU-composer — simple post creation form (demo path)`
- [ ] Branch pushed; PR opened; CI green; merged

---

## Context

**Specs:**
- `docs/architecture/decision-log.md` — D045 (visibility), D048
  (PostType deferred), D038 (traceability), D042 (role grants)
- `docs/architecture/admin-surface.md` — role model
- `docs/architecture/api-contract.md` — tRPC procedure conventions
- `docs/product/design-philosophy.md` — honest, quiet copy
- `docs/product/post-creation-flow.md` — background only (note D048
  supersession)
- `docs/product/scenarios.md` — user journeys
- `docs/product/scale-and-audience.md` — scale context
- `docs/product/copy-library.md` — strings

**Existing code to read first (in order of priority):**
- `server/services/post.ts` — pattern to extend
- `server/routers/post.ts` — pattern to extend
- `app/feed/actions.ts` — server action pattern to mirror
- `components/FeedList.tsx` — client component pattern reference
- `server/services/auth.ts` — service-layer convention
- `server/services/audit.ts` — auditLog signature
- `prisma/schema.prisma` — Post + PostVisibility
- `eslint.config.js` — F06 + F13 active

**Process:**
- `docs/process/session-brief-template.md`
- `docs/process/session-hygiene.md` — context discipline
- `docs/process/api-contract-discipline.md` — tRPC rules
- `CLAUDE.md` — operating context

---

## What this brief does NOT cover

1. **FAB intent-cards composer** — BU-005 post-demo per D044
2. **Image / attachment upload** — Phase 2
3. **Draft saving / resume**
4. **Post editing after creation** — BU-020 admin
5. **Markdown / rich text rendering**
6. **Live preview**
7. **Group tagging UI**
8. **Post scheduling**
9. **Mentions / user references**
10. **Post type / tone selection** — deferred per D048
11. **Optimistic UI**
12. **Real auth flow** — dev stub still in use

---

## Slice convention

BU-composer is the third and final session on the demo path. After
it merges:

1. ✅ BU-001-lite — auth + audit
2. ✅ BU-feed — feed page + seed
3. ✅ **BU-composer — post creation**
4. **DEMO MILESTONE**

Conventions established in this session that future composer-related
work inherits:
- Server action wraps tRPC mutation for client form submit
- Validation lives in `shared/validation/`
- Audit metadata captures structure but never body content
- F13 catches missing `@spec` from day one (now active)

Future composer work that builds on this:
- BU-005: FAB intent-cards composer (replaces the simple form per
  D044)
- BU-007: Inbound sharing (`/share?url=...` deep-link with prefilled
  content per D018)
- Slice 2 full: Comment, Reaction, Attachment models extend what
  composer can create

---

## What lands after this session

- Eddie can click "New post" on /feed
- Form appears with 4 fields
- Submit creates a real Post row
- Audit log records the creation
- Feed shows the new post at top after redirect
- AM button works if URL provided
- **The demo loop is complete and recordable**

After this merges:
- Run `docs/process/demo-recording-prep.md` workflow
- Record 3-minute demo
- Share with Jeremy + team
- Gather feedback
- Re-plan Phase 2 priorities based on real feedback
