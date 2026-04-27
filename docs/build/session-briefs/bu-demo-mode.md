---
slug: bu-demo-mode
status: shipped
shipped_in: "#124"
phase: 0
---
# Brief: BU-demo-mode — dev-auth surfaces on a Vercel preview

**Status:** shipping (this session)
**Build Unit:** BU-demo-mode
**Pairs with:** BU-001-lite (dev-auth stub), `docs/architecture/environments.md`

## Why this brief exists

Real auth (BU-auth) hasn't shipped. We need a Vercel + Neon deploy
**now** so non-developer stakeholders can poke the app from a URL
without a laptop. The blocker: every dev-auth surface (`/dev/login`,
`<LoggedInAs />`, the `dev` tRPC sub-router, `server/lib/auth.ts`,
the tRPC context) is gated by `NODE_ENV === 'production'` and goes
dark on a real Vercel build.

This brief unlocks those surfaces on a *demo* deploy only. Real
production stays locked.

## Approach

Introduce a single env-var gate `DEMO_MODE=1`. Every existing
production gate becomes:

```ts
if (process.env.NODE_ENV === 'production' && !isDemoMode()) { … }
```

That keeps real-prod behaviour unchanged when `DEMO_MODE` is unset
(default), and re-enables dev-auth surfaces only when explicitly
opted in.

The flag is **server-only** (no `NEXT_PUBLIC_` prefix). All gate
consumers run in server-rendered code, so client bundles cannot
read it.

## Safety rail

Demo deployments must run as a **Vercel Preview** (`VERCEL_ENV !==
'production'`). `shared/demo-mode.ts` throws at module load if
`DEMO_MODE=1` is observed alongside `VERCEL_ENV=production`, so a
misconfigured "real prod" project cannot accidentally expose dev-auth.

This means: deploy from a long-lived branch (e.g. `demo`) on a
Vercel project distinct from any future real-prod project. The
auto-generated preview URL (`<project>-git-demo-<team>.vercel.app`)
is stable as long as the branch lives.

## Scope (build)

1. `shared/demo-mode.ts` — `isDemoMode()` + safety rail
2. `components/DemoBanner.tsx` — non-sticky info banner ("You're
   viewing a demo of GPS Action. Data is fake.") rendered above the
   sticky header. Self-gates via `isDemoMode()`; null in real prod
   and local dev
3. Mount `<DemoBanner />` in `app/layout.tsx`
4. Loosen production gates with `&& !isDemoMode()` in:
   - `app/dev/layout.tsx`
   - `app/layout.tsx` (the `showHeader` predicate)
   - `components/auth/LoggedInAs.tsx`
   - `server/lib/auth.ts` (`assertNotProduction`)
   - `server/routers/_app.ts` (mounting of the `dev` sub-router)
   - `server/routers/context.ts` (cookie resolution path)

## Out of scope

- Real auth (BU-auth) — separate, future BU
- Custom domain / DNS for the demo URL — preview URL is fine
- Production Vercel project setup — demo project only
- Seed-data refresh strategy on Neon — manual one-off
  (`DATABASE_URL=<Neon> npx tsx scripts/seed-dev.ts`) for now
- Hardening the safety rail beyond `VERCEL_ENV` (hostname
  allowlist etc.) — revisit when a "real" prod project exists

## Operational notes (deploy)

1. Two Vercel projects: `gps-action-demo` (this), future
   `gps-action` (real prod, distinct)
2. Connect demo project to repo, deploy from branch `demo`
3. Project env vars (Preview scope):
   - `DATABASE_URL=<Neon connection string>`
   - `DEMO_MODE=1`
   - `ACTIVIST_MAILER_ALLOWED_DOMAINS=activistmailer.com`
4. Build command: `prisma migrate deploy && next build`
5. One-off seed of Neon from laptop:
   `DATABASE_URL=<Neon> npx tsx scripts/seed-dev.ts`
6. Open preview URL → `/dev/login` → pick a seeded user

## Tests

- `npm run typecheck && npm run lint && npm test` green
- Local smoke: `DEMO_MODE=1 npm run build && npm start` — banner
  shows, `/dev/login` reachable, can switch users
- Negative: unset `DEMO_MODE`, `npm run build && npm start` —
  banner hidden, `/dev/login` returns 404, `dev.*` tRPC calls fail
- Negative: `DEMO_MODE=1 VERCEL_ENV=production npm start` — process
  refuses to start

## Definition of done

- All gates honour `isDemoMode()`
- Banner renders only on demo deploys
- Safety rail proven by negative test
- Brief flipped to `status: shipped`, `shipped_in` filled
- PR merged; demo URL live on Vercel + Neon
