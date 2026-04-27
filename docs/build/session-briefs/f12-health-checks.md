---
slug: f12-health-checks
status: shipped
shipped_in: "#63"
phase: 0
---
# SESSION BRIEF · F12 — Health-check endpoints (`/healthz`, `/readyz`)

_Brief version: 1.0 · Author: Paul · Date: April 2026_
_Priority: Phase 0 chore. Ships in the same PR as F11
(`BU-error-boundary`) under the umbrella "shell safety foundations" —
both are tiny and conceptually adjacent (one component crash should
not take the whole app down; the runtime should be observable from
outside)._

---

## Objective

Ship the two HTTP endpoints external uptime monitoring needs: a
liveness probe (`/healthz`) and a readiness probe (`/readyz`).
`/healthz` is a thin alive-check — if the Next.js process is up
enough to handle a request, it returns 200 with `uptime`. `/readyz`
goes one level deeper — it verifies the runtime can actually serve
traffic by pinging the database via Prisma `$queryRaw \`SELECT 1\``,
returning 503 with a structured failure payload when the dependency
is unreachable. Better Stack (D037) will eventually monitor `/readyz`
and page on failures.

This brief is one half of the **shell foundations** PR. The other
half is F11 (`BU-error-boundary`). They are bundled because each is
tiny on its own and they share the "the runtime shell is observable
and resilient" theme.

---

## Liveness vs readiness — the distinction

Per `docs/build/phase-0-foundations.md` §F12:

| Endpoint    | Question it answers              | Used for               |
| ----------- | -------------------------------- | ---------------------- |
| `/healthz`  | Is the app **alive**?            | Liveness probe         |
| `/readyz`   | Can the app **serve traffic**?   | Readiness probe        |

Liveness only verifies the process can answer HTTP. If `/healthz`
fails the orchestrator restarts the container. Readiness verifies
all upstream dependencies (today: the database; later: Redis, the AI
endpoint, etc.) are reachable; if `/readyz` fails the orchestrator
takes the instance out of the load-balancer pool but does **not**
restart it. The two probes have different remediation paths —
muddling them creates restart loops.

---

## Scope

### Build in this session

- `server/services/health.ts` (new — `pingDatabase()` service)
- `app/api/healthz/route.ts` (new — liveness endpoint)
- `app/api/readyz/route.ts` (new — readiness endpoint)
- `tests/unit/health-service.test.ts` (new — `pingDatabase` Vitest)
- `tests/unit/healthz.test.ts` (new — route handler test)
- `tests/unit/readyz.test.ts` (new — route handler test, ok + fail)
- `docs/build/phase-0-foundations.md` (modify — flip F12 row to ✅)
- `docs/architecture/traceability-matrix.md` (modify — add
  `BU-healthcheck` entry, parallel to F11's `BU-error-boundary`
  entry)

### Do NOT touch

- `prisma/schema.prisma` — no schema work
- `eslint.config.js` — no rule changes; the new files comply with
  existing rules
- `package.json` — no new dependencies
- `components/ErrorBoundary.tsx` and `app/layout.tsx` — F11's work,
  already on this branch
- Any `server/routers/**` file — health endpoints don't go through
  tRPC (they need to be GET-only, public, and dependency-free of the
  tRPC stack)
- The Prisma client singleton (`server/db/client.ts`) — used as-is

### Out of scope for this session

- **Better Stack (or any external monitor) configuration.** D037
  observability stack is not yet wired up. The endpoints exist; the
  monitor that pings them is a separate operations task.
- **Redis / AI endpoint readiness checks.** Neither dependency
  exists yet. The `checks` object in `/readyz` is shaped to grow —
  add new keys as new dependencies land. F12 ships only the
  database check.
- **Custom HTTP status codes beyond 200 / 503.** Two states are
  enough. `/readyz` returning 503 carries the payload that names
  which check failed; that's all an orchestrator needs.
- **Auth / rate limiting on the endpoints.** Health probes are
  unauthenticated by convention — they're called by infrastructure,
  not users. If abuse becomes a concern, add a bearer token check
  later.
- **Caching headers / CDN behaviour.** The endpoints are dynamic
  per-request by design.
- **Sentry integration on `pingDatabase` failures.** D037 lands
  later; for now the failure is silent in the response payload.
  Adding Sentry here would diverge from F11's pattern (which also
  defers Sentry).
- **A `/livez` alias.** `/healthz` is the conventional name. Don't
  ship duplicates.

---

## Contracts

### Inputs consumed

- Prisma client singleton at `server/db/client.ts` (`prisma` named
  export)
- Next.js 15 App Router file-based route convention
  (`app/api/<name>/route.ts` with a `GET` export)
- `process.uptime()` — Node built-in, no dependency

### Outputs produced

These become commitments external monitors and orchestrators can
rely on:

- **`GET /healthz`** → `200 { status: 'ok', uptime: <seconds> }`.
  The endpoint never returns non-200 — if the process can answer
  the request at all, the answer is "alive". `uptime` is the Node
  process uptime in seconds (numeric).
- **`GET /readyz`** → either:
  - `200 { status: 'ready', checks: { database: 'ok' } }` when all
    upstream dependencies pass, OR
  - `503 { status: 'not_ready', checks: { database: 'fail' } }`
    when any check fails.
  The shape of `checks` is `Record<string, 'ok' | 'fail'>` so
  future dependencies (Redis, AI service) can extend it without
  breaking consumers.
- **`pingDatabase(): Promise<boolean>`** in
  `server/services/health.ts` — runs `prisma.$queryRaw\`SELECT 1\``,
  resolves `true` on success, `false` on any thrown error. The
  service swallows the error rather than rethrowing because the
  caller (the route handler) needs a boolean to assemble the
  `checks` object.

---

## Acceptance criteria

### Functional

- [ ] `app/api/healthz/route.ts` exists and exports a `GET` function
- [ ] `GET /healthz` returns 200 with `{ status: 'ok', uptime: <number> }`
- [ ] `app/api/readyz/route.ts` exists and exports a `GET` function
- [ ] `GET /readyz` returns 200 + `{ status: 'ready', checks: { database: 'ok' } }`
      when the database is reachable
- [ ] `GET /readyz` returns 503 + `{ status: 'not_ready', checks: { database: 'fail' } }`
      when the database ping rejects
- [ ] `pingDatabase()` in `server/services/health.ts` runs
      `prisma.$queryRaw\`SELECT 1\`` and resolves a boolean
- [ ] All three new code files carry `@build-unit BU-healthcheck`
      and at least one `@spec` JSDoc tag

### Mechanical

- [ ] `npm run typecheck` clean — no `any`, no `@ts-ignore`
- [ ] `npm run lint` clean (warnings pre-existing OK)
- [ ] `npx prettier --check .` clean
- [ ] `npm test` — all passing including the three new test files
- [ ] `npm run trace:check` — see "Known gotchas" (pre-existing
      breakage on `main` per the F07+F08 sibling agent; capture
      output, do not attempt to fix)

### Tests

`tests/unit/health-service.test.ts` covers `pingDatabase()`:

- Resolves `true` when the underlying `$queryRaw` resolves
- Resolves `false` when the underlying `$queryRaw` rejects

`tests/unit/healthz.test.ts` covers the liveness route:

- Returns 200
- Body has `status: 'ok'`
- Body has a numeric `uptime`

`tests/unit/readyz.test.ts` covers the readiness route:

- Database OK path: 200 + `{ status: 'ready', checks: { database: 'ok' } }`
- Database fail path: 503 + `{ status: 'not_ready', checks: { database: 'fail' } }`

The Prisma client is mocked via Vitest's `vi.mock` to avoid hitting
a real database from the test suite. The mock pattern matches the
project's existing service-test conventions
(`tests/integration/post-create.test.ts` uses real Prisma against a
test database; the health-check tests use a mocked client because
the assertion is on the boolean wiring, not on Prisma's behaviour).

### Manual / smoke

- [ ] If `npm run dev` runs in this session, curl `/healthz` and
      `/readyz` and confirm shapes. Otherwise, document in the PR
      body that smoke was not performed — the unit tests cover the
      contract.

---

## Permission matrix

N/A — health endpoints are intentionally unauthenticated. They're
called by infrastructure (load balancers, uptime monitors), not by
users.

---

## Layer boundaries

`app/api/**/route.ts` lives under the `app` element-type per
`eslint.config.js` boundaries. The route handlers therefore call
the database via `server/services/health.ts` rather than importing
the Prisma client directly — this matches how `app/feed/page.tsx`
and `app/post/[id]/page.tsx` already call `isFeatureEnabled` from
`server/services/flags.ts`. The service is the only thing that
imports the Prisma client; the route handler is a thin wrapper.

---

## UI states

N/A — JSON-only API endpoints. No UI surface.

---

## Tests required

See "Tests" under Acceptance criteria. Three test files, all under
`tests/unit/`:

- `tests/unit/health-service.test.ts`
- `tests/unit/healthz.test.ts`
- `tests/unit/readyz.test.ts`

Not required:

- An integration test that hits a real database. The
  `/readyz` contract is a thin pass-through; the boolean wiring is
  what we care about. `tests/integration/` already uses Prisma
  against the test database for real-DB coverage on services with
  meaningful queries.
- E2E click-through. Not user-facing.

---

## Scenarios to verify against

F12 doesn't map to a product scenario directly — it's shell
infrastructure. Verification is the unit test suite + the optional
manual smoke described above.

---

## Known gotchas

- **Boundaries plugin.** Route handlers in `app/api/` cannot import
  Prisma directly — `app → db` is disallowed. They call through
  `server/services/health.ts`, matching the precedent
  `app/feed/page.tsx → server/services/flags.ts`.
- **`Response.json` ESLint friction.** `Response.json` is a Web
  Fetch API method (Next 15 + Node 20 support it natively). No
  imports required.
- **`process.uptime()` on the Edge runtime.** Route handlers
  default to the Node runtime in App Router; `process.uptime()`
  works there. If a future migration moves these to Edge, swap to
  `Date.now() - moduleLoadTime` or similar.
- **`pingDatabase` rejection swallowing.** Intentional — the
  route handler needs a boolean to assemble the `checks` object.
  Re-throwing here would force the caller into a `try/catch`
  redundantly. The error is silent for now; D037 will add Sentry
  when the observability stack lands.
- **`$queryRaw` template tag vs string.** Use the tagged-template
  form — `prisma.$queryRaw\`SELECT 1\`` — so Prisma can sanitise
  any future parameter additions. The string-call form
  (`prisma.$queryRawUnsafe`) is for dynamic SQL we don't need.
- **`trace:check` pre-existing breakage on `main`.** Per the
  F07+F08 sibling agent's notes, `npm run trace:check` is
  currently failing on `main` for unrelated SCN-coverage reasons.
  Run it; if the failures match the pre-existing set, capture the
  output and note in the PR body. **Do not attempt to fix
  trace:check in this brief.**
- **F14 (`require-testid`).** Doesn't fire — route handlers
  contain no JSX.
- **F15 (`require-design-tokens`).** Doesn't fire — route
  handlers contain no colour literals.
- **F06 rule 1 / F13 (header rules).** Both fire on
  `app/api/**/*.ts`. The new files include `@build-unit
  BU-healthcheck` and `@spec docs/build/phase-0-foundations.md` so
  both rules pass.
- **No-PII-in-logs.** The endpoints don't log; the service
  doesn't log. Rule does not fire.

---

## Definition of done

- [ ] All files in "Build in this session" created or updated
- [ ] No file in "Do NOT touch" modified
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` passes (including new tests)
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` — output captured; pre-existing
      breakage noted in PR body if observed
- [ ] F12 row in `docs/build/phase-0-foundations.md` flipped to ✅
      with this PR linked
- [ ] `BU-healthcheck` entry added to
      `docs/architecture/traceability-matrix.md`
- [ ] Commit message: `feat(shell): BU-healthcheck — /healthz +
      /readyz endpoints (F12)`
- [ ] Branch pushed; PR opened against `main` (joint with F11)

---

## Open questions to surface

1. **Sentry hook for `pingDatabase` failures.** Currently silent.
   When D037 lands, swap the swallowed error for
   `Sentry.captureException`. Same seam pattern as F11's
   `reportError`. Confirm direction.
2. **Future readiness checks.** Redis, AI endpoint, SendGrid. Each
   added as a new key in the `checks` object. Confirm the shape
   is stable for forward extension.
3. **Bearer-token guard on `/readyz`.** The endpoint exposes
   "database is or isn't reachable" — a tiny piece of operational
   intelligence. If we ever go fully public, consider gating
   `/readyz` behind a shared monitoring secret. Not needed today.

(Claude Code: surface any further judgement calls during
implementation.)

---

## Context

**Specs:**

- `docs/build/phase-0-foundations.md` §F12 — the canonical brief
- `docs/architecture/decision-log.md` D037 (observability stack)
- `docs/build/session-briefs/f11-error-boundaries.md` — sibling
  brief, same PR

**Existing code to read first:**

- `server/db/client.ts` — Prisma singleton (`prisma` named export)
- `server/services/flags.ts` — service convention; precedent for
  `app → service → db`
- `app/feed/page.tsx` — example of `app` calling `services`
- `eslint.config.js` — boundaries rules
- `eslint-rules/rules/require-build-unit-header.js` — header rule
- `eslint-rules/rules/require-spec-tag.js` — spec-tag rule

**Process:**

- `docs/process/session-brief-template.md`
- `CLAUDE.md`

---

## What this brief does NOT cover

1. **External monitor configuration** — Better Stack lands later
2. **Sentry integration on health-check failures** — D037 lands
   later; structured silence today
3. **Edge-runtime support** — Node runtime only
4. **Authentication on the endpoints** — public by convention
5. **Additional dependency checks** — Redis, AI, etc. land with
   those features

---

## Slice convention

F12 is a Phase 0 chore. Pairs with F11 in a single PR titled
"shell foundations". Each file carries its own `@build-unit`
(F11 files → `BU-error-boundary`; F12 files → `BU-healthcheck`).
The PR description names both.
