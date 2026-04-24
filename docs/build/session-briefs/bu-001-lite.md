# SESSION BRIEF · BU-001-lite — Dev auth stub + audit service

*Brief version: 1.0 · Author: Paul · Date: April 2026*

---

## Objective

Build the minimum auth infrastructure needed to demo GPS Action on a
laptop: a dev-only "pick a user" login page, a cookie-based session
stub, middleware for role-gating future procedures, and a real (but
minimal) audit log service that records mutations as they happen.

Success looks like: visit `/dev/login`, see a list of seeded users,
click "Log in as Eddie Morales" → cookie set, header shows "Logged in
as Eddie" on every page. Click "Switch user" → back to picker. Any
future tRPC mutation can gate itself with `.use(requireRole('admin'))`
and any service can call `auditLog(...)` to write a real row.

**No real auth.** No passwords, no magic links, no 2FA. Those belong
to BU-002 post-demo, per `docs/build/bu-sequence.md` and
`docs/architecture/environments.md`.

---

## Scope

### Build in this session

**Server layer:**
- `/server/lib/auth.ts` (new — `getCurrentUser()`, cookie helpers;
  refuses to run in production per NFR)
- `/server/lib/trpc.ts` (modify — add `requireRole` middleware; add
  `authedProcedure` helper if not present; preserve existing exports)
- `/server/services/audit.ts` (new — real `auditLog()` function that
  writes AuditLog rows)
- `/server/routers/dev.ts` (new — dev-only router exposing
  `listUsers` for the picker; refuses to register in production)
- `/server/routers/_app.ts` (modify — register `dev` router only when
  not production)

**Client layer:**
- `/app/dev/login/page.tsx` (new — lists seeded users, "Log in as X"
  buttons, sets cookie, redirects)
- `/app/dev/login/actions.ts` (new — server actions for set-cookie /
  clear-cookie; OR do via tRPC — surface as open question if unclear)
- `/components/LoggedInAs.tsx` (new — small header component showing
  current user or "Not logged in"; used in root layout)
- `/app/layout.tsx` (modify — add `<LoggedInAs />` to the header;
  preserve existing layout; add `@build-unit BU-001-lite` to the
  existing `@build-unit BU-000-scaffold` header as a second tag or
  update to reflect both)

**Tests:**
- `/tests/integration/auth-stub.test.ts` (new — verifies `getCurrentUser`
  reads cookie, returns null for absent, returns null in production,
  returns user when present)
- `/tests/integration/audit-service.test.ts` (new — verifies
  `auditLog()` writes rows with correct shape, handles null actor,
  stores diff correctly)
- `/tests/unit/requireRole.test.ts` (new — verifies middleware
  rejects anonymous, rejects wrong role, allows correct role; passes
  context through)

**Seed extension:**
- `/scripts/seed-dev.ts` (modify — ensure the 5 demo users exist;
  see "Seed users" below. If BU-feed's seed script doesn't exist yet,
  this session creates it minimally with just users + roles. BU-feed
  will extend it with posts.)

**Docs:**
- `/CLAUDE.md` (modify — tiny addition noting `/dev/login` exists
  in dev; how to switch user mid-development)

### Do NOT touch

- `/prisma/schema.prisma` — no schema changes needed
- `/docs/architecture/admin-surface.md` — spec unchanged
- `/docs/architecture/decision-log.md` — no new ADRs needed
- `/eslint.config.js` — F06 rules apply, don't modify
- Any file in `/server/admin/` — that directory's contents stay for
  BU-020
- Any existing tests — add new ones, don't modify existing
- `/package.json` beyond verifying scripts still work

### Out of scope for this session

- **Real auth** (magic links, email verification, passwords, 2FA) —
  BU-002 post-demo
- **Full admin UI** (entity list, edit pages, grant/revoke UI) — BU-020
  post-demo
- **Session expiry / refresh** — dev stub has no expiry; cookie
  persists until cleared
- **Multiple device support** — single cookie per browser is fine
- **"Remember me" logic** — N/A for dev stub
- **Register / signup flows** — no public signup in demo; seeded
  users only
- **Password hashing infrastructure** — not in dev stub
- **Role grant UI** — roles are seeded; UI for changing them is
  BU-020
- **Coordinator profile admin** — BU-020
- **Sophisticated audit log querying / display** — write-only now;
  read UI is BU-020
- **Feature flag enforcement** — flags are DB-driven per D036 but no
  UI flips them in MVP; BU-001-lite doesn't build flag UI either

---

## Contracts

### Inputs consumed

- `/prisma/schema.prisma` — User, RoleGrant, AuditLog, SystemRole,
  CoordinatorProfile models
- `/server/admin/entity-metadata.ts` — for future-ref, not modified
- `/docs/architecture/admin-surface.md` — roles and audit invariants
- `/docs/architecture/decision-log.md` — D042 (role grants), B07
  (audit log invariants)
- `/docs/architecture/environments.md` — dev/staging/prod separation;
  auth stub refuses in production
- `/docs/process/api-contract-discipline.md` — the 10 rules for tRPC
  procedures
- `/docs/process/security-baseline.md` — data protection implications
  of storing user state
- `/docs/product/design-philosophy.md` — honest copy, no marketing
  voice
- `/docs/product/copy-library.md` — relevant strings

### Outputs produced

Contracts future sessions rely on:

- **`getCurrentUser(req)`** from `server/lib/auth.ts` — returns the
  logged-in User or null. Future procedures use this via tRPC context.
- **`requireRole(role)` middleware** from `server/lib/trpc.ts` — F06
  rule 4 (`no-inline-auth-check`) enforces its use in routers.
- **`authedProcedure`** — helper that requires auth but no specific
  role. Used for member-only procedures (e.g., `post.create`).
- **`auditLog(...)` from `server/services/audit.ts`** — every future
  mutation calls this. Signature documented below.
- **Cookie name `gps_dev_user_id`** — the single source of truth for
  "who's logged in" in dev.
- **`/dev/login` route** — the user-switcher UI.
- **`<LoggedInAs />` component** — every page shows current user.

---

## Acceptance criteria

### Functional (click-through verifiable)

- [ ] Visit `/dev/login` with no cookie → see list of 5 users with
  "Log in as X" buttons
- [ ] Click "Log in as Eddie Morales" → cookie set; redirected to `/`
  (or `/feed` if that exists); header shows "Logged in as Eddie"
- [ ] Navigate to any route — header persists showing current user
- [ ] Click "Switch user" in header → back to `/dev/login`; cookie cleared
- [ ] Click "Log in as Cary Whitfield" → now Cary is shown
- [ ] Each seeded user has the expected role grants (Eddie: member only;
  Cary: queue_manager; Bette: admin; Humphrey: member; Ingrid: member)
- [ ] Try to access a future `requireRole('admin')` procedure as Eddie
  (via Cypress or manual test helper) → 403; as Bette → succeeds

### Non-functional

- [ ] `getCurrentUser` throws if invoked in `NODE_ENV === 'production'`
- [ ] Dev login page is NOT registered in production (route returns 404)
- [ ] Dev router (`/server/routers/dev.ts`) is NOT registered in production
  (verified by checking `_app.ts` conditional)
- [ ] No password-like concepts anywhere — pure cookie presence check
- [ ] `auditLog()` writes correct shape: action, entityType, entityId,
  userId (actor, nullable), targetUserId (nullable), changes (JSON),
  context (JSON), ipAddress, userAgent
- [ ] `auditLog()` does not throw on failure — audit write errors log
  to console but don't break the calling procedure (audit is best-
  effort, not blocking)
- [ ] All tests pass; 0 lint violations; 0 typecheck errors
- [ ] Prettier clean
- [ ] Every new file has `@build-unit BU-001-lite` JSDoc header per D038
- [ ] F06 rules pass (no inline auth, no PII in logs, etc.)

---

## Seed users (for BU-001-lite's seed extension)

Five users, realistic but clearly invented, no real-person collisions:

| Name | Email | Role | Notes |
|---|---|---|---|
| **Eddie Morales** | eddie@demo.gps-action.test | member | The demo member. Default user. |
| **Cary Whitfield** | cary@demo.gps-action.test | queue_manager | For demoing queue features later |
| **Bette Rosenthal** | bette@demo.gps-action.test | admin | For demoing admin features later |
| **Humphrey Kline** | humphrey@demo.gps-action.test | member | Another member for feed variety |
| **Ingrid Blum** | ingrid@demo.gps-action.test | member | Another member, different voice |

**Important:** these are **INVENTED CHARACTERS**, not real people.
Names riff on old film stars (Eddie Murphy, Cary Grant, Bette Davis,
Humphrey Bogart, Ingrid Bergman) with fabricated surnames. All
accounts have `verifiedAt: <seed time>` so they're active.

Seed script:
- Idempotent (uses `upsert`; safe to re-run)
- Each user gets their User row
- Role grants created for Cary (queue_manager) and Bette (admin) with
  `grantedReason: "Seeded dev-environment role for demo purposes"`
- Eddie / Humphrey / Ingrid get no role grants (they're regular members)

---

## Audit service — signature

```typescript
// server/services/audit.ts

import { prisma } from '@/server/db/client';

/**
 * @build-unit BU-001-lite
 * @spec architecture/admin-surface.md
 * @spec architecture/decision-log.md (B07)
 *
 * Immutable, append-only audit log writer. Every mutation in the
 * system should call this. Never throws — audit failures log to
 * console but don't block the caller.
 */
export async function auditLog(entry: {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;           // the actor
  targetUserId?: string | null;     // if the action targets a user
  changes?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId ?? null,
        targetUserId: entry.targetUserId ?? null,
        changes: entry.changes ?? undefined,
        context: entry.context ?? undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit log must NEVER block a mutation. Log and move on.
    console.error('[audit] write failed', { entry, error: err });
  }
}
```

---

## Auth stub — contract

```typescript
// server/lib/auth.ts

import { cookies } from 'next/headers';
import { prisma } from '@/server/db/client';
import type { User } from '@prisma/client';

/**
 * @build-unit BU-001-lite
 * @spec architecture/admin-surface.md
 * @spec architecture/environments.md
 *
 * DEV-ONLY auth stub. Refuses in production. Real auth lands in BU-002.
 */

const COOKIE_NAME = 'gps_dev_user_id';

export async function getCurrentUser(): Promise<User | null> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[auth] Dev auth stub invoked in production. Real auth (BU-002) is required.',
    );
  }
  const jar = await cookies();
  const userId = jar.get(COOKIE_NAME)?.value;
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
  });
}

export async function setDevUser(userId: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[auth] setDevUser cannot run in production.');
  }
  const jar = await cookies();
  jar.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // No expiry — persists until cleared explicitly.
  });
}

export async function clearDevUser(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
```

---

## `requireRole` middleware — contract

```typescript
// server/lib/trpc.ts (additions)

import { TRPCError } from '@trpc/server';
import type { SystemRole } from '@prisma/client';
import { prisma } from '@/server/db/client';

/**
 * Middleware: requires an authenticated user with an active grant
 * for the specified role. Rejects anonymous with UNAUTHORIZED,
 * wrong-role with FORBIDDEN.
 *
 * Usage in routers:
 *   t.procedure.use(requireRole('admin')).mutation(...)
 *
 * F06 rule 4 (no-inline-auth-check) enforces using this rather than
 * inline ctx.user.role checks.
 */
export const requireRole = (role: SystemRole) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    const grant = await prisma.roleGrant.findFirst({
      where: { userId: ctx.user.id, role, revokedAt: null },
    });
    if (!grant) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

/**
 * Helper: procedure that requires an authenticated user (any role).
 * For member-only actions like post.create.
 */
export const authedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
```

---

## Known gotchas

### Cookie reading in Next.js 15

Next.js 15's `cookies()` helper is async. `await cookies()` is the
correct pattern. If Claude Code generates the older sync form, it'll
fail at runtime.

### tRPC context must include `user`

The tRPC context builder needs to call `getCurrentUser()` and put
the result on `ctx.user`. Update `createTRPCContext` (or whatever
it's called in the current setup) to include this. Check what's
there before writing.

### Dev router registration

The `_app.ts` router registration must be production-safe. Pattern:

```typescript
import { devRouter } from './dev';

export const appRouter = router({
  ...(process.env.NODE_ENV !== 'production' ? { dev: devRouter } : {}),
  // other routers
});
```

Or conditional import. Either way: dev router is unreachable in prod.

### The `/dev/login` page in production

Either:
- Route returns 404 based on `NODE_ENV` check at the top of the page
- Or middleware at the `app/dev/` folder level denies in production

Second option is cleaner. Use `app/dev/middleware.ts` or similar.

### Server actions vs tRPC for cookie-set

Setting a cookie from a button click can be done via:
- A server action (Next 15 pattern)
- A tRPC mutation

Server actions are more idiomatic for login flows in Next 15. Prefer
server actions unless there's a good reason otherwise. Surface this
choice as an open question if unclear.

### Audit log is NOT for every read

The brief's audit service is for **mutations**. Reading a page doesn't
write to the audit log. Only state-changing actions do. Don't add
audit calls to `.query()` procedures.

### What counts as an audit action

For BU-001-lite, only two actions are expected:
- `user_logged_in` (actor = the user themselves, written from the
  dev-login action)
- `user_logged_out` (actor = the user, written from logout)

Future Build Units add more action types. Don't pre-emptively define
them here.

### Audit entry shape — entityType

When the "thing being audited" IS the user themselves (login/logout),
use:
- `entityType: 'user'`
- `entityId: <the user's id>`
- `userId: <the user's id>` (they acted on themselves)

### Don't over-engineer the dev login page

It's a list of 5 buttons. Not a searchable table. Not an editable
user manager. Just:

```
Pick a user:

  [Eddie Morales]    member
  [Cary Whitfield]   queue_manager
  [Bette Rosenthal]  admin
  [Humphrey Kline]   member
  [Ingrid Blum]      member
```

Honest copy. No "Welcome! 👋".

### Don't build a real admin page

If you find yourself starting `/admin/users` — stop. That's BU-020.
The only page this session builds is `/dev/login`.

### CSS / styling

Use existing design tokens from `styles/tokens.css`. Don't invent new
tokens. The dev-login page doesn't need to be pretty — functional and
readable is enough. Per design-philosophy.md principle 5 (honest copy),
don't dress it up.

---

## Definition of done

- [ ] All files in "Build" list present; none in "Don't touch" modified
- [ ] `npx prisma validate` passes (no schema changes expected)
- [ ] `npm run seed:dev` (or equivalent) creates the 5 users + 2 role
  grants; re-running doesn't duplicate
- [ ] `npm run test` passes (new tests + previous tests)
- [ ] `npm run lint` passes with 0 violations
- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npx prettier --check .` passes (hooks should auto-handle)
- [ ] All 5 seed users can be logged in as; header updates correctly
- [ ] Bette can invoke a future `requireRole('admin')` procedure test;
  Eddie cannot
- [ ] `auditLog` writes correct shape (verify via a test that writes
  an entry and reads it back)
- [ ] `auditLog` doesn't throw when the database is down (mock prisma
  to throw in a test; verify the function completes and logs to
  console instead)
- [ ] Every new file has `@build-unit BU-001-lite` JSDoc header
- [ ] Commit message:
  `feat(auth): BU-001-lite — dev auth stub + requireRole + audit service`
- [ ] Branch pushed; PR opened; CI green; merged

---

## Open questions to surface

Pre-identified. Do not assume silently.

1. **Server action vs tRPC for dev-login.** Setting the cookie
   from a button: server action is idiomatic in Next 15; tRPC
   mutation is valid but more machinery. Recommend server action.
   Confirm.

2. **Cookie httpOnly handling.** `httpOnly: true` means client JS
   can't read it — the `<LoggedInAs />` component would need to be
   a server component or the user info passed from a server-rendered
   parent. Fine, but means `<LoggedInAs />` is a server component,
   not client. Confirm.

3. **Middleware or per-route guards?** For production-gating the
   `/dev/*` routes, `app/dev/middleware.ts` is cleaner. Confirm that
   pattern vs per-page `NODE_ENV` check in each page.

4. **Audit service in `/server/services/`.** The project's boundary
   rules (see `eslint.config.js`) limit where services can be called
   from. Verify `services` is allowed from `routers`. If not, note
   the boundary concern.

5. **Where `<LoggedInAs />` lives.** `/components/LoggedInAs.tsx` or
   `/components/auth/LoggedInAs.tsx` or somewhere else? The latter
   allows for future auth-related components. Recommend
   `/components/auth/LoggedInAs.tsx`. Confirm.

6. **Empty-state for `/dev/login` when no users exist.** Edge case
   — if seed hasn't run, the page shows no buttons. Show a message
   ("No seed data. Run `npm run seed:dev`.") or assume seed ran?
   Recommend: show the message; it's 3 lines of JSX.

7. **Does `authedProcedure` belong in this session?** Strictly it's
   not needed until BU-feed's read procedures or BU-composer's
   create. Adding it now prevents refactor later. Recommend: add it
   now. Confirm.

8. **`scripts/seed-dev.ts` structure.** If this file doesn't exist
   yet, create it minimally (users + role grants only). If it exists
   from earlier work, extend it. Check which case applies and surface.

(Claude Code: add any further judgement calls.)

---

## Context

**Specs:**
- `/docs/architecture/admin-surface.md` — role model
- `/docs/architecture/decision-log.md` — D042 (role grants), B07 (audit)
- `/docs/architecture/environments.md` — NODE_ENV discipline
- `/docs/process/api-contract-discipline.md` — tRPC rules
- `/docs/product/design-philosophy.md` — honest copy
- `/docs/build/bu-sequence.md` — where BU-001-lite fits

**Existing code to read first:**
- `/server/lib/trpc.ts` — where `requireRole` gets added
- `/server/routers/_app.ts` — where dev router gets conditionally registered
- `/prisma/schema.prisma` — User, RoleGrant, AuditLog
- `/app/layout.tsx` — where `<LoggedInAs />` goes
- `/styles/tokens.css` — design tokens to reuse

**Process:**
- `/docs/process/session-brief-template.md`
- `/docs/process/session-hygiene.md`
- `/CLAUDE.md`

---

## What this brief does NOT cover

1. **Real auth** — BU-002
2. **Full admin surface** — BU-020
3. **Signup/register UI** — separate Build Unit post-demo
4. **Role grant management UI** — BU-020
5. **Audit log display UI** — BU-020
6. **Coordinator profile admin** — BU-020
7. **Password hashing** — not part of dev stub
8. **Session refresh / expiry** — dev stub has none
9. **Multiple simultaneous sessions** — single cookie per browser
10. **Feature flag enforcement** — separate later session

---

## Slice convention

BU-001-lite is the first **Phase 1 (demo path)** feature-building
session. Convention established here:

- Dev-only code lives under `/app/dev/*`, `/server/routers/dev.ts`,
  etc. — clearly namespaced
- Auth checks use middleware only (F06 rule 4 enforces)
- Every mutation calls `auditLog()` (pattern established here,
  inherited by BU-composer)
- `@build-unit` headers on every new file

Future Build Units follow. BU-feed reads the cookie via the same
`getCurrentUser()`. BU-composer uses `authedProcedure` for
`post.create` and calls `auditLog` on success.

---

## What lands after this session

- Eddie can log in
- Bette has admin, Cary has queue_manager, others are members
- The header shows who's logged in
- Any mutation in future sessions can audit cleanly
- BU-feed can start with confidence that "current user" is solved

Next session: **BU-feed** — the feed page itself + post router +
realistic seed data.
