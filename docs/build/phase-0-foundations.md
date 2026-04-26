# Phase 0 Foundations

**Purpose:** The twelve pieces of engineering infrastructure that must be in place
before Build Unit #1 (the first feature) starts. Skipping any of these risks
regressions compounding invisibly through the build.

**Sequencing principle:** Items are ordered so that each one benefits from the
previous. Do them in this order. Commit each as a separate PR so CI validates
them individually.

**Expected effort:** 2-3 days of focused work for someone who knows the tools;
1 week at a comfortable pace. Largely delegable to Claude Code sessions using
the briefs in each section.

**Owner:** Paul (confirmed before any Build Unit starts).

**Related:** D036 (feature flags), D037 (observability), D038 (traceability),
D039 (Build Units), `docs/build/engineering-roadmap.md` (Tier B/C/D backlog).

---

## Checklist

| # | Item | Status | PR |
|---|---|---|---|
| F01 | Branch protection on `main` | ☐ | — |
| F02 | PR template with inline checklists | ✅ | (this PR) |
| F03 | Pre-commit hooks (Husky + lint-staged) | ☐ | — |
| F04 | Secret scanning (gitleaks + GitHub) | ✅ | (this PR) |
| F05 | Dependabot + `npm audit` on CI | ✅ | (this PR) |
| F06 | Custom ESLint rules (traceability + safety) | ☐ | — |
| F07 | Coverage floor on new code | ☐ | — |
| F08 | Database migration validation on CI | ☐ | — |
| F09 | Preview deploys + staging environment | ☐ | — |
| F10 | Seed data script (realistic fixtures) | ☐ | — |
| F11 | Error boundaries in UI shell | ✅ | phase-0/bu-shell-foundations |
| F12 | Health check endpoints (`/healthz`, `/readyz`) | ✅ | phase-0/bu-shell-foundations |
| F13 | Enforce `@spec` traceability tag (ESLint) | ☐ | — |
| F15 | Enforce design token usage (ESLint) | ☐ | — |

Mark complete in PR descriptions. This checklist lives here forever — future
contributors see what foundation was laid and when.

---

## F01 · Branch protection on `main`

**Why:** Rules, not trust. Once set, behaviour becomes permanent — no accidental
force-pushes, no bypassed reviews when things feel urgent.

**What to configure** (GitHub → Settings → Branches → Add rule for `main`):

- Require a pull request before merging
- Require approvals: **1**
- Dismiss stale approvals when new commits pushed
- Require status checks to pass: `ci/lint`, `ci/typecheck`, `ci/test`, `ci/build`
  *(names will be finalised once CI is built — update after F06 lands)*
- Require branches to be up to date before merging
- Require conversation resolution before merging
- Require linear history *(prevents merge commits; forces rebase)*
- Do not allow bypassing the above settings
- Restrict who can push to matching branches: only admins
- Disallow force pushes
- Disallow deletions

**One-person-team note:** You'll be approving your own PRs via a second account
or via a "self-approval allowed" exception. Better: invite Claude (or a trusted
reviewer) as a collaborator and have *them* approve. For now, a second GitHub
account is acceptable — but the rules still apply.

**Done when:** You cannot push to `main` directly. A test of `git push origin main`
fails from your working branch.

---

## F02 · PR template with inline checklists

**Why:** The reviewer checklists in `api-contract-discipline.md`,
`design-philosophy.md`, and `reviewer-checklist.md` are invisible if they live
in separate docs. Putting them in the PR template makes them visible at the
exact moment they matter.

**File:** `.github/pull_request_template.md`

```markdown
## What this PR does

<!-- One sentence. If it needs more, split the PR. -->

## Build Unit

<!-- BU-NNN, or explain why no Build Unit applies (bugfix, tooling, etc.) -->

Build Unit: BU-___
Scenarios touched: SCN-___
Spec sections: §___

## How this was tested

- [ ] Unit tests added/updated
- [ ] Integration test added (if critical path)
- [ ] Manually verified on preview deploy: <!-- link -->

## Screenshots / demo

<!-- For UI changes. Recording preferred. -->

## Migration & rollback

- [ ] No database migration
- [ ] Migration included; follows two-phase discipline (F08)
- [ ] Rollback plan: <!-- if anything non-trivial -->

## Feature flag state

- [ ] Not behind a flag (explain why)
- [ ] Behind flag: `ff_____` (default OFF)

## Reviewer checklist — universal

- [ ] Build Unit ID present in changed file headers (`@build-unit`)
- [ ] No PII in logs, analytics, or error messages
- [ ] No secrets committed
- [ ] CI green

## Reviewer checklist — if this touches routers (`server/routers/`)

- [ ] Input schema present; not `z.any()`
- [ ] Output schema declared
- [ ] Authorisation via middleware, not inline
- [ ] Errors via `TRPCError` with approved code
- [ ] Pagination on list endpoints (cursor-based, max limit)
- [ ] File header has `@build-unit`, `@scenarios`, `@spec`

## Reviewer checklist — if this touches UI (`app/`, `components/`)

- [ ] Primary actions are single-tap
- [ ] Copy is honest about what will happen
- [ ] No manufactured urgency (see design-philosophy.md)
- [ ] Cultural-marker styling used correctly (if applicable)
- [ ] Storybook story added or updated
- [ ] Error boundary present for feature root
- [ ] Keyboard navigation works
- [ ] axe-core clean on Storybook stories

## Reviewer checklist — if this touches database (`prisma/`)

- [ ] Migration is reversible (or documented why not)
- [ ] Two-phase strategy if changing column semantics
- [ ] Indexes added for new query patterns
- [ ] No PII in new columns without classification comment

## ADR required?

- [ ] No — routine change
- [ ] Yes — ADR number: D___
- [ ] Surprised the reviewer? Open an ADR before merge.
```

**Done when:** Every new PR loads this template automatically.

---

## F03 · Pre-commit hooks (Husky + lint-staged)

**Why:** 80% of "CI is red" frustration comes from errors that could have been
caught at the keyboard. Pre-commit hooks run in ~2 seconds and prevent that.

**Setup:**

```bash
pnpm add -D husky lint-staged
pnpm exec husky init
```

**File:** `.husky/pre-commit`
```
pnpm exec lint-staged
```

**File:** `package.json` (add):
```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --max-warnings=0 --fix",
    "prettier --write"
  ],
  "*.{js,jsx,json,md,css}": [
    "prettier --write"
  ],
  "*.{ts,tsx,js,jsx}": [
    "bash -c 'pnpm exec tsc --noEmit'"
  ]
}
```

**Additionally — a commit-msg hook using commitlint:**

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional
echo "export default { extends: ['@commitlint/config-conventional'] };" > commitlint.config.js
```

**File:** `.husky/commit-msg`
```
pnpm exec --no-install commitlint --edit $1
```

Conventional Commits enforced: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
`chore:`, `perf:`, `ci:`, `build:`. This pays back weekly via auto-generated
changelogs and meaningful git log.

**Done when:** Committing bad code gets stopped at the keyboard with a helpful
error message.

---

## F04 · Secret scanning (gitleaks + GitHub)

**Why:** One leaked API key to GitHub is game over. Defence in depth: pre-commit
+ server-side + post-hoc.

**Pre-commit:**

```bash
pnpm add -D gitleaks
```

Or install the binary — `gitleaks` is written in Go, a binary install is often
cleaner than the npm wrapper.

**File:** `.husky/pre-commit` (append to F03):
```
gitleaks protect --staged --redact --config .gitleaks.toml
```

**File:** `.gitleaks.toml` — start with the default ruleset, add project-specific
patterns if needed:
```toml
title = "GPS Action gitleaks config"
[extend]
useDefault = true
```

**Server-side scanning — deferred**

GitHub gates Code Security (which includes server-side push protection for
partner patterns) behind a paid plan at $30/active-committer/month for
organisation repos. Paul reviewed the cost vs. risk and chose to defer.

**Current defence (sufficient for solo work):**
- gitleaks pre-commit hook — catches at keyboard
- gitleaks in CI — catches at PR time
- Clean history confirmed (post-hoc sweep, 0 findings)

**Revisit trigger:**
- When the team gains additional committers (local hooks become
  individually bypassable)
- When the free tier of partner-pattern scanning becomes clearly
  available for orgs without a paid bundle
- On any near-miss event

**Cost if enabled today:** $30/month per active committer in last 90 days.

**Post-hoc sweep:**

Run once across the full history to catch any leaks already committed:
```bash
gitleaks detect --redact
```

If anything is found: rotate the credential *first*, then rewrite history
(BFG Repo-Cleaner or `git filter-repo`). Rotation before rewrite is critical —
the leaked key is already compromised.

**Done when:** Committing a string that looks like `AKIA...` or `sk-...` gets
blocked before it leaves your laptop.

---

## F05 · Dependabot + `npm audit` on CI

**Why:** Dependencies are the #1 source of CVEs. Automation catches them before
they become incidents.

**File:** `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    commit-message:
      prefix: "chore(deps)"
    groups:
      dev-dependencies:
        dependency-type: "development"
        update-types: ["minor", "patch"]
      prod-dependencies:
        dependency-type: "production"
        update-types: ["patch"]

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

**CI step:** In `.github/workflows/ci.yml`:
```yaml
- name: Audit dependencies
  run: pnpm audit --audit-level=high
```

Fails CI on **high** or **critical** CVEs. Warnings for **moderate**. Review weekly
as part of the "nothing new" cadence.

**Done when:** Dependabot PRs start arriving on Mondays; `pnpm audit` runs in CI.

---

## F06 · Custom ESLint rules (traceability + safety)

**Why:** D038 defined the YAML frontmatter convention but *documents don't enforce
conventions — tooling does*. Five custom ESLint rules turn discipline into
mechanics.

**File:** `eslint-rules/` (a local rules directory)

### Rule 1: `require-build-unit-header`

Flags any file under `app/`, `server/routers/`, `server/services/`, or
`components/` without a `@build-unit` JSDoc tag in the first 10 lines.

**Why:** D038 traceability — no orphan files.

### Rule 2: `no-trpc-any`

Flags `z.any()` usage in any `server/routers/**/*.ts` file.

**Why:** `api-contract-discipline.md` rule 2.

### Rule 3: `no-pii-in-logs`

Flags any `console.log`, `logger.*`, `Sentry.captureMessage` call that includes
an expression matching `.email`, `.phone`, `.postcode`, `.body`, or `.displayName`.

**Why:** PII policy from `analytics-events.md`. Single biggest risk of a breach
is logging something you shouldn't.

### Rule 4: `no-inline-auth-check`

Flags procedures that reference `ctx.user.role`, `ctx.user.permissions`, or
similar in `.mutation(...)` or `.query(...)` bodies without having `.use(requireRole(...))`
in the chain.

**Why:** `api-contract-discipline.md` rule 7.

### Rule 5: `feature-must-have-flag`

Opt-in rule. When a file starts with `// @feature-gated`, requires that the file
imports `isFeatureEnabled` and calls it at least once.

**Why:** D036 feature flag discipline.

**Setup:**

```bash
pnpm add -D eslint-plugin-local-rules
```

Register the local rules directory in `.eslintrc.cjs`:
```javascript
module.exports = {
  plugins: ['local-rules'],
  rules: {
    'local-rules/require-build-unit-header': 'error',
    'local-rules/no-trpc-any': 'error',
    'local-rules/no-pii-in-logs': 'error',
    'local-rules/no-inline-auth-check': 'error',
    'local-rules/feature-must-have-flag': 'error',
  }
}
```

**Effort:** Each rule is 30–80 lines of JavaScript. One Claude Code session
writes all five in a couple of hours with tests. Include the tests — these rules
themselves need to be reliable.

**Done when:** ESLint fails on code that violates any of the five conventions,
and passes when the conventions are followed.

---

## F07 · Coverage floor on new code

**Why:** "I'll add tests later" is the most common lie in software. A coverage
floor on new code (not total coverage) prevents regression without forcing
retrofit of tests on existing code.

**Setup:**

```bash
pnpm add -D @vitest/coverage-v8
```

**File:** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.*',
        'eslint-rules/**',
      ],
    },
  },
})
```

**CI step — using `diff-cover` or codecov's patch coverage:**

```yaml
- name: Run tests with coverage
  run: pnpm test --coverage

- name: Check patch coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    flags: unittests
    fail_ci_if_error: true
```

In Codecov settings, configure:
- Project coverage: informational only (no threshold — yet)
- Patch coverage: **80% required** on changed lines

**Why patch not project:** forcing total coverage up is painful and often leads
to useless tests just to tick a box. Patch coverage ensures *new* code is tested.
Total coverage rises naturally over time as the codebase evolves.

**Done when:** A PR with uncovered new code fails the "patch" check.

---

## F08 · Database migration validation on CI

**Why:** Migrations that work on your laptop can destroy production. CI must
catch this.

**CI step:**

```yaml
- name: Validate Prisma migrations
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - run: pnpm prisma migrate deploy
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/test
    - run: pnpm prisma validate
```

**Additionally — migration two-phase discipline (worth repeating from roadmap):**

Any migration that:
- Renames a column
- Changes a column type
- Adds `NOT NULL` to an existing column
- Removes a column

...must be two-phase:
1. **PR #1:** migration adds new column (if relevant), code writes both, reads old.
2. **PR #2:** backfill script, flip reads to new.
3. **PR #3:** stop writing old.
4. **PR #4:** drop old column.

Not every migration needs this. But the ones that do, need it *before* they
touch production. Add a reviewer check in the PR template (already in F02).

**Done when:** A migration PR runs the migration against a fresh Postgres in CI
and fails if it errors.

---

## F09 · Preview deploys + staging environment

**Why:** You and Jeremy and Sharon need to *see* progress. Vercel gives you
this for Next.js natively.

**Setup:**

1. Connect the repo to Vercel (one-time).
2. Configure project:
   - Production branch: `main`
   - Preview branches: all other branches
   - Environment variables: separate values per environment (dev, preview, prod)

3. Staging: create a branch `staging` that auto-deploys to `staging.gps-action.xyz`.
   Not just another preview — a dedicated environment with:
   - Separate Postgres database (scaled-down copy of prod schema)
   - Separate Redis instance
   - Real SendGrid + DKIM records (sending from `staging@gps-action.xyz`)
   - Seed data (F10) loaded fresh weekly

**Promotion flow:**
```
feature-branch → PR → merged to main → auto-deploy to prod
                ↑
                preview URL always available per PR
```

Staging is a separate manual promotion target for testing risky changes —
migrations, third-party integrations, email deliverability — before production.

**Done when:** Every PR gets a preview URL in a comment; `staging.gps-action.xyz`
is a separate, working, seed-data-populated environment.

---

## F10 · Seed data script (realistic fixtures)

**Why:** Storybook is meaningless without data. Previews are meaningless without
data. Bug reports are hard to reproduce without shared data.

**File:** `prisma/seed.ts`

Produces:
- 50 members across all roles (admin ×2, moderator ×3, steward ×5, member ×40)
- Geographic spread — members in 10 regions
- 200 posts distributed across the 5 post types
- Realistic timestamps spread over the past 90 days
- 30 action-taken events
- 50 comments across various posts
- 100 reactions
- 5 pending vetting cases
- 8 flagged posts in various states
- 3 seeded feature flags (off, on for admin, on for 10% rollout)

**Discipline:**
- No real names — use a name generator with diverse sources
- No real photos — use placeholder avatars
- Realistic text — but clearly synthetic (use a `"Lorem ipsum"`-style generator
  for post bodies, or fixture library). **Never** use real data from WhatsApp
  history, even "anonymised."
- Deterministic — seeded with a fixed random seed so runs are reproducible
- Idempotent — running seed twice doesn't duplicate

**Setup in `package.json`:**
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Run via `pnpm prisma db seed`. Ships in dev, preview, and staging — **not** prod.

**Done when:** Fresh dev database → `pnpm prisma db seed` → clickable, realistic
app with data in every feature.

---

## F11 · Error boundaries in UI shell

**Why:** One component crashing should never crash the whole app. With Sentry
integration, errors become actionable.

**File:** `app/components/ErrorBoundary.tsx`

```typescript
/**
 * @build-unit BU-000 (foundations)
 * @spec §5.10 observability
 */
'use client'

import * as Sentry from '@sentry/nextjs'
import { Component, ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  name: string  // for Sentry tagging
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.withScope((scope) => {
      scope.setTag('boundary', this.props.name)
      scope.setContext('errorInfo', { componentStack: info.componentStack })
      Sentry.captureException(error)
    })
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
```

**Usage pattern — every major feature root:**
```tsx
<ErrorBoundary name="feed" fallback={<FeedErrorState />}>
  <Feed />
</ErrorBoundary>
```

**Rules:**
- Every route file has an error boundary at the top level.
- Every major feature root inside a route has its own boundary.
- Fallbacks follow honest copy — "Something went wrong loading the feed. We've
  been notified. Try again in a moment." Not a generic "Oops!"
- Never swallow errors silently — always report to Sentry.

**Done when:** Triggering an error in one component shows its fallback, leaves
the rest of the app functional, and logs the error to Sentry with context.

---

## F12 · Health check endpoints

**Why:** Uptime monitoring needs something to ping. Sentry tells you what broke;
health checks tell you *whether* things are broken.

**File:** `app/api/healthz/route.ts`

```typescript
/**
 * @build-unit BU-000
 * @spec §5.10
 */
export async function GET() {
  return Response.json({ status: 'ok', uptime: process.uptime() })
}
```

**File:** `app/api/readyz/route.ts`

```typescript
/**
 * @build-unit BU-000
 * @spec §5.10
 */
import { db } from '@/server/db'

export async function GET() {
  const checks: Record<string, 'ok' | 'fail'> = {}

  try {
    await db.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'fail'
  }

  // TODO when Redis lands: ping Redis
  // TODO when AI service lands: ping AI endpoint (with short timeout)

  const allOk = Object.values(checks).every((v) => v === 'ok')
  return Response.json(
    { status: allOk ? 'ready' : 'not_ready', checks },
    { status: allOk ? 200 : 503 }
  )
}
```

**Distinction worth noting:**
- `/healthz` — is the app *alive*? (responds to HTTP) — used for liveness probes
- `/readyz` — can the app *serve traffic*? (DB, Redis, deps reachable) — used for
  readiness probes and external monitoring

Better Stack (D037) monitors both and pages on `/readyz` failures.

**Done when:** Both endpoints return JSON; Better Stack monitors are configured
and pass.

---

## F13 · Enforce `@spec` traceability tag

**Why:** D038 requires every code file with `@build-unit` to also carry a `@spec`
tag pointing at the relevant spec or decision document. F06 rule 1 enforces
`@build-unit` but `@spec` was convention-only — 3 files drifted during BU-feed,
proving the convention is not self-enforcing.

**File:** `eslint-rules/rules/require-spec-tag.js`

**Behaviour:** Scans the first 10 non-blank lines (same window as rule 1). If
`@build-unit` is present but no `@spec <value>` tag, the rule fires. Files
without `@build-unit` pass — utility files are unaffected.

**Scope:** Same file globs as rule 1 (`app/`, `server/routers/`, `server/services/`,
`server/admin/`, `components/`).

**Done when:** `npm run lint` fails on any file with `@build-unit` but no `@spec`,
and passes when both tags are present.

---

## Sequencing & PR order

The twelve items are roughly independent but some build on each other. Suggested
commit order:

1. F01 (branch protection) — do this first, even before code. Changes all later
   behaviour.
2. F02 (PR template) — next, so every subsequent PR uses it.
3. F03 (pre-commit + commitlint) — so every commit after this is conventional.
4. F04 (secret scanning) — belt and braces before any real code.
5. F05 (Dependabot) — fire and forget; starts paying dividends immediately.
6. F06 (custom ESLint rules) — one PR per rule, five PRs total. Low risk each.
7. F07 (coverage floor) — after F06 so ESLint is stable first.
8. F08 (migration validation) — before any `prisma/schema.prisma` change.
9. F10 (seed data) — before F09 so previews have data from day one.
10. F09 (preview + staging) — Vercel setup is GUI work, not PR work.
11. F11 (error boundaries) — one PR with the boundary component + usage in
    root layout.
12. F12 (health checks) — two small routes, one PR.

**Total:** roughly 12–15 PRs. Pace: 2–3 per day, or spread across a week.

---

## Definition of done for Phase 0

**All twelve items complete when:**

- Checklist at top of this doc all ticked
- CI runs all five ESLint rules and fails PRs that violate them
- Committing a secret gets blocked at the keyboard
- `/healthz` and `/readyz` return 200 from production, staging, and dev
- Seed data produces a realistic, clickable app
- The PR template renders on every new PR
- Branch protection stops direct pushes to `main`
- At least one Dependabot PR has been opened and reviewed

**After Phase 0:** Build Unit catalogue session, then first feature Build Unit
starts.

Without Phase 0, regressions compound invisibly. With Phase 0, the foundations
catch them at the keyboard, at CI, at review, at deploy — before they reach
production.
