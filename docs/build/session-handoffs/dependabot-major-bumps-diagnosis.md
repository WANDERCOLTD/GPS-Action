# Dependabot major bumps — diagnosis (2026-04-26)

## TL;DR

Four Dependabot major-version PRs (#34 typescript 6, #36 zod 4, #39 eslint 10,
#40 prisma 7) all fail CI for **independent and unrelated reasons**. Three are
small-to-moderate (TS6, zod 4, eslint 10); one (Prisma 7) is heavy and gated by
the contract-locked schema. They can be combined later, but the right play is
to land them sequentially in this order: **typescript → eslint → zod → prisma**,
with Prisma 7 deferred behind an ADR. None of the three non-Prisma bumps
unblock or block each other technically, so the user can pick them off in any
order — the suggested order just minimises rework.

## Per-PR findings

### #34 typescript 5.9.3 → 6.0.3

**Failure step:** `npm run typecheck` (tsc --noEmit)
**Run:** [24953531691](https://github.com/WANDERCOLTD/GPS-Action/actions/runs/24953531691)

**Exact error (CI log lines 09:40:29):**

```
app/layout.tsx(9,8): error TS2882: Cannot find module or type declarations
  for side-effect import of '@/styles/tokens.css'.
app/layout.tsx(10,8): error TS2882: Cannot find module or type declarations
  for side-effect import of '@/styles/components.css'.
```

**Root cause:** TypeScript 6 introduces error TS2882 for bare side-effect imports
of files with no module declaration. `app/layout.tsx` lines 13-14 import
`@/styles/tokens.css` and `@/styles/components.css` directly — Next.js resolves
these at bundle time but TS6 now requires an ambient module declaration.

The repo has no `*.css` declaration shim. Under TS5 these imports were
silently allowed; TS6 demands a declaration like:

```ts
declare module '*.css';
```

typically placed in a `next-env.d.ts`-adjacent file (e.g. `globals.d.ts`).

**Migration cost: TRIVIAL (≤30 min).** One new file (`globals.d.ts` with one
line, or extend `next-env.d.ts`). No source code changes. tRPC 11 peer requires
TS ≥5.7.2 (compatible with 6.x); Prisma 7 requires TS ≥5.4.0 (compatible).
No other package fights TS6.

**Order constraint:** None. This PR is independent.

**Risk:** Low. Possible secondary errors hidden behind TS2882 (typecheck stops
at first error class). Real cost may be 1–2 hours if other strictness regressions
surface, but the visible failure is mechanical.

---

### #36 zod 3.25.76 → 4.3.6

**Failure step:** `npm test` (vitest run)
**Run:** [24953530464](https://github.com/WANDERCOLTD/GPS-Action/actions/runs/24953530464)

**Exact error (CI log lines 09:40:39 and 09:40:40):** 8 test failures across
`tests/unit/reaction-router.test.ts` (4) and `tests/unit/comment-router.test.ts`
(4). Every failure is the same shape:

```json
{
  "origin": "string",
  "code": "invalid_format",
  "format": "uuid",
  "pattern": "/^([0-9a-fA-F]{8}-...)$/",
  "path": ["postId"],
  "message": "Invalid UUID"
}
```

**Root cause:** Zod 4 changed the error issue shape for string format validators:

| Aspect            | Zod 3                  | Zod 4                                                                 |
| ----------------- | ---------------------- | --------------------------------------------------------------------- |
| Issue `code`      | `invalid_string`       | `invalid_format`                                                      |
| Validator field   | `validation: 'uuid'`   | `format: 'uuid'` + new `pattern` field                                |
| Default message   | `Invalid uuid`         | `Invalid UUID`                                                        |
| `origin`          | (absent)               | `'string'`                                                            |

The codebase uses `z.string().uuid()` in `shared/validation/reaction.ts` (4
sites: lines 32, 37, 42, 52, 57) and `shared/validation/comment.ts`. The
production code still works — it's only the **test assertions** that pin the
old issue format. Specifically the unit tests pass invalid strings and assert
on the resulting `TRPCError.cause` shape.

There's also one collateral failure: `comment.add > rejects when ff_comments
is off (FORBIDDEN)` — the test asserted code `FORBIDDEN` but the new zod
issue surfaces first because validation runs before the feature-flag check, so
the error code returned is now `invalid_format` instead. Order-of-validation
issue, easy fix in the test.

**Migration cost: MODERATE (2–4 hours).** No production-code changes needed
for these specific schemas (`z.string().uuid()` still exists in v4). Work is:

1. Update test fixtures to assert on `invalid_format` / `format: 'uuid'`
   instead of `invalid_string` / `validation: 'uuid'` (≈8 assertion sites).
2. Re-order one comment-router test so feature-flag check is exercised before
   validation tripwires.
3. Audit `server/routers/dev.ts`, `server/routers/post.ts`,
   `shared/validation/post.ts`, `tests/unit/requireRole.test.ts` for any other
   hand-rolled error-shape assertions (grep already confirms only 7 files use
   `z.`).
4. Light scan for deprecated zod 3 idioms (`.deepPartial()`, `.nonstrict()`,
   functional methods that moved or renamed). Codebase usage is conservative
   (`z.object`, `z.string`, `z.array`, `z.number`, `z.uuid`) so most patterns
   carry over unchanged.

**Order constraint:** None hard. Independent of TS6 and ESLint 10. Independent
of Prisma 7.

**Risk:** Low-moderate. tRPC 11 ships its own zod adapter — verify the version
matches zod 4 at install time (recent tRPC 11.x supports zod 4 via separate
import paths). If it doesn't, this becomes heavy (would need tRPC bump too).
Worth a quick `npm view @trpc/server peerDependencies` check before starting.

---

### #39 eslint 9.39.4 → 10.2.1

**Failure step:** `npm ci` (install)
**Run:** [24953546593](https://github.com/WANDERCOLTD/GPS-Action/actions/runs/24953546593)

**Exact error (CI log line 09:40:44):**

```
npm error ERESOLVE could not resolve
npm error While resolving: eslint-config-next@15.5.15
npm error Found: eslint@10.2.1
npm error Conflicting peer dependency: eslint@9.39.4
npm error peer eslint@"^7.23.0 || ^8.0.0 || ^9.0.0" from eslint-config-next@15.5.15
```

**Root cause:** Hard peer-dependency conflict. `eslint-config-next@15.5.15`
declares peer `eslint ^7 || ^8 || ^9` and has not yet shipped a release that
accepts ESLint 10. Verified via `npm view eslint-config-next@15.5.15
peerDependencies` → `{ eslint: '^7.23.0 || ^8.0.0 || ^9.0.0' }`. Install can't
resolve, so nothing else even runs.

There is also a latent warning visible in the eslint 9 baseline run (PR #36 log,
09:40:25): `[boundaries/element-types] Detected legacy selector syntax in 10
rule(s)` — `eslint-plugin-boundaries` v6 deprecated the old config format. So
even after solving the install, `boundaries/element-types` will need a config
rewrite to `boundaries/dependencies` with object-based selectors. This is a
separate, pre-existing tech debt item that bites here.

**Migration cost: HEAVY (4–8 hours), gated externally.**

The blocker is **upstream**: wait for `eslint-config-next` to ship a release
that accepts eslint 10 in peers. The Next.js team typically lags ESLint majors
by a few weeks. Until then this PR is unmergeable without `--legacy-peer-deps`
(which we shouldn't accept — fragile, can break in production CI).

When it unblocks, additional work:

1. Migrate `boundaries/element-types` → `boundaries/dependencies` with
   object-syntax selectors (10 rules in `eslint.config.js` lines 52-72).
2. Re-test all 8 custom rules in `eslint-rules/rules/` against the ESLint 10
   plugin API. ESLint 10 typically tightens rule API contracts (deprecated
   context methods, new `meta` requirements). Rules to verify:
   `require-build-unit-header`, `no-trpc-any`, `no-pii-in-logs`,
   `no-inline-auth-check`, `feature-must-have-flag`, `require-spec-tag`,
   `require-design-tokens`, `require-testid`.
3. Verify `@typescript-eslint/eslint-plugin@8.59.0` works with ESLint 10
   (8.x already compatible with eslint 10 in recent patches per peer deps in
   the log, but the workspace's `^8.15.0` constraint may pull an older
   version).

**Order constraint:** Effectively blocked on `eslint-config-next` shipping
ESLint 10 support. Recommend **defer** until upstream releases. No internal
dependency on the other three bumps.

**Risk:** Moderate. Custom rule plugin API risk is the main unknown.

---

### #40 @prisma/client 5.22.0 → 7.8.0

**Failure step:** `npm run db:generate` (prisma generate)
**Run:** [24953537049](https://github.com/WANDERCOLTD/GPS-Action/actions/runs/24953537049)

**Exact error (CI log line 09:40:39):**

```
Error: Generator "/.../node_modules/@prisma/client/generator-build/index.js" failed:

Error: ENOENT: no such file or directory, open
  '/.../node_modules/@prisma/client/generator-build/prisma_schema_build_bg.wasm'
```

**Root cause:** This is a **packaging mismatch**, not a schema issue. Dependabot
bumped only `@prisma/client` to 7.8.0 but left `prisma` (the CLI/generator) at
`^5.22.0`. The generator binary inside `@prisma/client@7.x` expects a
`prisma-schema-wasm` peer that ships only in matching `prisma@7.x`. With a
mixed install, `npm ci` doesn't pull the wasm file the generator needs and
the ENOENT is hit immediately.

Dependabot will often split client/CLI updates into separate PRs for Prisma —
see [Dependabot prisma bug](https://github.com/dependabot/dependabot-core/issues)
discussions. Combining the bumps fixes the install symptom — but that just
unmasks the real work.

**Migration cost: HEAVY (full day minimum + ADR).**

Even after pairing `prisma` and `@prisma/client` at 7.x:

1. **Schema-level changes required.** Prisma 7 (per official guides):
   - New `previewFeatures` defaults; some moved to stable.
   - `binaryTargets` config may need updating for the new query engine.
   - `prisma migrate` workflow has stricter shadow-database requirements.
   - Some implicit relation behaviors changed (cascading defaults).
2. **CLAUDE.md says `prisma/schema.prisma` is contract-locked: changing it
   requires an ADR.** Prisma 7 generates a different client surface in places
   (return types for `findUnique` / `findFirst`, JSON field handling). Some
   of that bleeds into TypeScript surface area used by `server/services/*.ts`,
   `server/db/client.ts`, and tests.
3. Migration test on a copy of production data before merge — Prisma 7
   client may emit different SQL for edge cases.

**Order constraint:** Requires **an ADR** before any code changes. Should not
be batched with the other three bumps. Worth filing as a separate planned
piece of work, not a "knock it out" Dependabot merge.

**Risk:** High. The schema-lock policy is the reason this exists — touching
Prisma touches data persistence guarantees. Wrong move here causes silent
type drift between `@prisma/client` runtime and the strict-typed services.

---

## Combined PR feasibility

**Verdict: not advisable to squash all four into one PR.** Reasoning:

| Pair                | Entangled?       | Notes                                                                                          |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| TS 6 + zod 4        | No               | Independent failure surfaces (typecheck vs test). Could combine, but small wins, big diff.     |
| TS 6 + eslint 10    | No (technically) | Both touch tooling. `eslint-config-next` blocks eslint 10 regardless of TS version.            |
| TS 6 + prisma 7     | No               | Prisma 7 peer is `typescript >=5.4.0` — TS 5 or 6 both work.                                   |
| zod 4 + eslint 10   | No               | Different failure domains.                                                                     |
| zod 4 + prisma 7    | No               | No shared surface. tRPC routers use both, but independently.                                   |
| eslint 10 + prisma 7| No               | No shared surface.                                                                             |

The non-Prisma three (TS 6, zod 4, eslint 10) **could** legitimately be
combined into one "tooling refresh" PR if you wanted a single review event —
total scope ~5–10 hours of mechanical work. **But** ESLint 10 is upstream-blocked,
which would stall the combined PR indefinitely. Recommendation: keep them
separate.

Prisma 7 must stand alone behind an ADR.

## Recommended sequence

1. **#34 typescript 6** — first. Trivial fix (CSS module shim). Lands
   independently. ~30 min.
2. **#36 zod 4** — second. Test-only diff, low-risk. ~2–4 hours. Verify
   tRPC 11 supports zod 4 before starting.
3. **#39 eslint 10** — defer until `eslint-config-next` releases an
   ESLint-10-compatible peer range. Track upstream. When unblocked, budget
   half a day (custom-rule API + boundaries plugin migration).
4. **#40 prisma 7** — write ADR first (`docs/adrs/00NN-prisma-7-upgrade.md`).
   Decision required from user before any code. Then plan as its own multi-day
   build unit (schema review, codegen diff review, migration test, services
   re-verification).

## ADR / constraint flags

- **#40 (Prisma 7)** — **REQUIRES ADR.** CLAUDE.md: "Don't change
  `prisma/schema.prisma` without an ADR (it's contract-locked)." Prisma 7 will
  almost certainly require schema directive changes (`previewFeatures`,
  `binaryTargets`, possibly relation defaults). Surface this to the user
  before any work starts.
- **#39 (ESLint 10)** — **upstream blocker.** `eslint-config-next@15.5.15`
  peer is `eslint <10`. Cannot proceed without either (a) a Next.js
  `eslint-config-next` release accepting ESLint 10, or (b) replacing
  `eslint-config-next` with a custom flat config — non-trivial, would itself
  warrant an ADR.
- **#36 (zod 4)** — minor flag: confirm tRPC 11 supports zod 4. If not, this
  becomes "zod 4 + tRPC bump" and grows in scope. Quick `npm view
  @trpc/server@latest peerDependencies` check resolves this in 30 seconds
  before starting.
- **F15 / boundaries plugin warning** — pre-existing (visible in current main
  CI logs): `boundaries/element-types` is deprecated, should migrate to
  `boundaries/dependencies`. Not blocking today; will become blocking when
  ESLint 10 / boundaries v7 lands. Worth a small follow-up brief.

## Concrete next steps the user could authorise

1. **Greenlight #34 (TS 6) as a one-shot session** — add `globals.d.ts` with
   `declare module '*.css';`, run typecheck, push. Half-hour brief.
2. **Greenlight #36 (zod 4) as a session** — first audit (30 min) to confirm
   no tRPC peer breaks; then update test fixtures (2–3 hours). Medium brief.
3. **Close #39 with a comment** ("blocked on `eslint-config-next` upstream;
   reopen when peer range widens") — track the upstream issue. No work yet.
4. **Convert #40 into an ADR draft** — write `docs/adrs/00NN-prisma-7-upgrade.md`
   capturing the schema-change surface area; close the auto-PR with a link to
   the ADR; queue real work as a future build unit. Large brief, multi-session.

## Appendix — files relevant to each bump

| Bump      | Files likely to change                                                              |
| --------- | ----------------------------------------------------------------------------------- |
| TS 6      | `globals.d.ts` (new) or `next-env.d.ts`                                             |
| zod 4     | `tests/unit/reaction-router.test.ts`, `tests/unit/comment-router.test.ts`, possibly `tests/unit/post-validation.test.ts` |
| eslint 10 | `package.json` (peer deps), `eslint.config.js` (boundaries config), `eslint-rules/rules/*.js` (rule API) |
| prisma 7  | `prisma/schema.prisma`, `package.json`, every file importing from `@prisma/client` (12+ files), `docs/adrs/00NN-prisma-7-upgrade.md` (new) |
