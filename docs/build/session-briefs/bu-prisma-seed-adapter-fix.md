---
slug: bu-prisma-seed-adapter-fix
status: ready
phase: 2
priority: low
---

# SESSION BRIEF · bu-prisma-seed-adapter-fix — Make `prisma/seed.ts` work on Prisma 7

_Author: Paul + Claude · Created: 2026-05-08 · Type: small fix-up — `prisma/seed.ts` instantiates `PrismaClient` without an adapter and crashes on Prisma 7._

---

## Why

Running the project's documented prod-seed command on Prisma 7 fails:

```sh
$ DIRECT_URL='...' pnpm seed:demo
$ tsx prisma/seed.ts && tsx scripts/seed.ts
F10 fixture seed failed: PrismaClientConstructorValidationError:
  Using engine type "client" requires either "adapter" or "accelerateUrl"
  to be provided to PrismaClient constructor.
```

`prisma/seed.ts` line 348:

```ts
const prisma = new PrismaClient({ log: ['error', 'warn'] });
```

That constructor signature was valid on Prisma 5; under Prisma 7 (D071), the runtime adapter (`@prisma/adapter-pg`) is required and must be passed in. The other seed script — `scripts/seed.ts` — sidesteps the issue by importing `prisma` from `@/server/db/client`, which is the project's adapter-equipped singleton. `prisma/seed.ts` predates that pattern.

Today this surfaced when refreshing prod's demo data. `pnpm seed:demo` is documented in `docs/process/vercel-deploy.md` as the canonical refresh command. Working around (running only `tsx scripts/seed.ts`) is fine for the demo workflow, but the broken script is a footgun for the next person who runs `pnpm seed:demo` blind.

---

## Build in this session

**Fix the seed (`prisma/seed.ts`)**

- Replace the bare `new PrismaClient(...)` with the adapter-equipped pattern. Two reasonable shapes:
  - **Shape A (preferred):** import `prisma` from `@/server/db/client` (matches `scripts/seed.ts`). Removes the duplicate Prisma instantiation entirely; the singleton uses the same adapter the app uses at runtime.
  - **Shape B (alternative):** keep a local instantiation but construct it with the same adapter pattern as `server/db/client.ts` — `new PrismaPg({ connectionString: ... })`, `new PrismaClient({ adapter, log: ... })`. Slightly more code but keeps the seed self-contained.
- Pick **Shape A** unless the implementer finds a reason the seed needs an isolated client (e.g. different log levels for the F10 batch).

**Smoke**

- `DIRECT_URL='...' pnpm seed:demo` against a scratch Neon branch (or local dev DB) → both scripts run end-to-end, no crashes. Verify F10 fixture rows + scripts/seed.ts curated rows are both present.

**Tests**

- This is a fix to a one-shot script that runs against a database; unit tests aren't the right tool. The smoke run above is the verification.

**Docs**

- If the README in `prisma/` mentions the seed flow, update it.
- No changes to `docs/process/vercel-deploy.md` — its documented `pnpm seed:demo` command still works after the fix; it just stops crashing.

## Out of scope (park)

- Refactoring `prisma/seed.ts` itself beyond the adapter wiring (the F10 fixture logic stays).
- Auditing every `new PrismaClient` call across the codebase. (`scripts/seed.ts` already imports the singleton; only `prisma/seed.ts` is broken.)

---

## Acceptance

- [ ] `DIRECT_URL='...' pnpm seed:demo` runs to completion without throwing.
- [ ] F10 fixture rows are present in the target DB after seed (groups, requests, comments, reactions, audit logs per the script's contract).
- [ ] `scripts/seed.ts` continues to run after `prisma/seed.ts` (the `&&` chain).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] `package.json` PATCH bumped.

## Status

Ready.
