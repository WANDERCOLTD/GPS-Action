# Engineering Roadmap — Tier B, C, D

**Purpose:** A living backlog of engineering infrastructure beyond Phase 0
foundations. Each item has a **trigger** (when to adopt it), an **owner**, and
an **effort estimate**. Reviewed fortnightly so nothing gets forgotten.

**Related:** `docs/build/phase-0-foundations.md` (Tier A, mandatory before
Build Unit #1), `docs/architecture/decision-log.md`, `docs/product/parking-lot.md`.

**How to use this doc:**
- Before each fortnightly review, walk this list
- Move items from **Pending** to **Adopted** when the trigger fires
- Add new items as they surface in build discussions (don't let them live only
  in chat)
- Each item that gets adopted becomes one or more Build Units, plus an ADR
  if the choice is non-trivial

---

## Tier B — Strongly recommended, adopt within first two weeks of build

Each of these has a trigger tied to early build milestones. If the trigger
fires and the item isn't adopted, that's a discussion at the fortnightly review.

### B01 · CODEOWNERS file

**What:** `.github/CODEOWNERS` auto-assigns reviewers by file path.

**Trigger:** Either (a) a second contributor joins, or (b) Build Unit #1 starts
— whichever first. At a team of one, this formalises "security-sensitive files
need a second look" even if the second look is you reading your own code a day
later.

**Effort:** 15 minutes.

**Dependencies:** F01 (branch protection) — CODEOWNERS only matters if PRs
require approval.

**Example:**
```
# Default owner — everything not otherwise specified
*                       @paw2paw

# Security-sensitive paths need extra eyes (when team grows)
/server/auth/           @paw2paw
/server/lib/pii/        @paw2paw
/prisma/                @paw2paw
/.github/               @paw2paw

# Design philosophy enforcement
/app/components/        @paw2paw
/styles/                @paw2paw
```

**Why not do it now in Phase 0:** Single-person team makes it performative.
Adopt when it genuinely routes reviews.

---

### B02 · axe-core accessibility checks on CI

**What:** Automated WCAG 2.2 AA checks on every PR, using axe-core against
Storybook stories and Playwright smoke tests.

**Trigger:** First UI Build Unit merges (likely BU-composer Post publishing or
BU-feed Feed).

**Effort:** Half a day to set up; zero ongoing overhead.

**Setup:**
```bash
pnpm add -D @axe-core/playwright jest-axe @storybook/addon-a11y
```

Integrate:
- Storybook addon shows a11y violations in the storybook UI
- Playwright smoke tests include `axe.run()` after key interactions
- CI step fails on any serious or critical violation

**Why not do it now in Phase 0:** Nothing to test against until UI exists. But
**the day UI exists, this goes in.** D034 committed to WCAG 2.2 AA — that
commitment needs teeth.

---

### B03 · Integration tests on critical paths

**What:** Tests that hit real Postgres (via Testcontainers), real tRPC
procedures, real auth. Not everything — the five critical paths:
1. Signup + vetting happy path
2. Publish a post
3. Take an action
4. Flag a post + moderate it
5. Dispatch to a partner channel

**Trigger:** Each path becomes testable as its Build Unit ships. Integration
test for that path lands in the *same* PR as the feature, not retrofitted.

**Effort:** ~1 hour per test once the harness is set up (first test is 2–3
hours to get Testcontainers wired in).

**Setup:**
```bash
pnpm add -D @testcontainers/postgresql vitest-environment-testcontainers
```

**Pattern:**
```typescript
// tests/integration/publish-post.test.ts
/**
 * @build-unit BU-composer
 * @scenarios SCN-02
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestContext } from './helpers'

describe('SCN-02: Member publishes a post', () => {
  it('publishes, appears in feed, triggers post_published event', async () => {
    const ctx = await createTestContext({ role: 'member' })
    const post = await ctx.trpc.post.publish.mutate({ /* ... */ })
    expect(post.id).toBeDefined()
    const feed = await ctx.trpc.feed.list.query({ /* ... */ })
    expect(feed.items[0].id).toBe(post.id)
    expect(ctx.events.captured()).toContainEqual(
      expect.objectContaining({ event: 'post_published' })
    )
  })
})
```

**Why:** Unit tests verify functions. Integration tests verify the *contract*.
The 5 above are the things that must never break silently.

---

### B04 · Playwright smoke tests on preview deployments

**What:** Three end-to-end tests that run a real browser against each preview
deployment: signup, publish, take action.

**Trigger:** BU-feed (Feed) merges — that's the first point an E2E test is
meaningful.

**Effort:** Half a day setup; ~1 hour per new test.

**Setup:**
```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

**CI integration:** Runs against the Vercel preview URL *after* deployment.
Results posted back to PR as a check.

**Why not Cypress:** Playwright has better DX, better parallelism, better
Vercel integration. Cypress is fine but the trend is Playwright.

---

### B05 · Migration two-phase discipline — documented + enforced

**What:** A specific section of the reviewer checklist catches migrations that
need two-phase rollout.

**Trigger:** First `prisma/schema.prisma` change that would break at deploy
time (rename, NOT NULL add, type change).

**Effort:** 1 hour to write the discipline doc + add to PR template.

**File:** `docs/process/migration-discipline.md`

**Content:** The five classes of risky migration, the four-PR pattern for each,
and a one-page reviewer flowchart. Referenced from the PR template in F02.

**Why not now:** No schema exists yet. The moment schema changes become routine,
this becomes critical. ERD session is the right trigger.

---

### B06 · Tested rollback plan

**What:** Written, *tested* rollback procedure for:
- Bad deploy (app code only) — how to revert in <2 minutes
- Bad migration (DB) — what's reversible, what isn't, manual recovery steps
- Data corruption — backup restore process

**Trigger:** First production deploy.

**Effort:** 2–3 hours including the actual test.

**Discipline:** Rollback is tested *before* it's needed. Quarterly drill: take
a recent deploy, roll it back in staging, document what took more than 30 seconds.

**File:** `docs/runbooks/rollback.md`

**Why:** "We can revert the commit in theory" is not a rollback plan. The
question is: when production is bleeding, can the person on-call do it in under
2 minutes without thinking? If not, the plan isn't a plan.

---

### B07 · Audit log specification

**What:** A separate, immutable, append-only log for sensitive events:
- Auth events (login, MFA, password reset)
- Role changes
- Bans and unbans
- Post deletions (by admin)
- Data exports
- Feature flag flips
- Secrets rotations

**Trigger:** First Build Unit that creates or mutates any of the above.

**Effort:** 1 day spec + implementation.

**File:** `docs/architecture/audit-log-spec.md`

**Key points:**
- Separate table (`audit_log`) with write-only permission for app code
- Monthly partitioning for query performance
- Never mixed with analytics events or app logs
- Retention: 7 years minimum (regulatory) — check Karen's legal advice
- DSAR-exportable: one script returns every event touching a user ID

**Why not now:** Nothing to audit yet. Moment it matters, it really matters.

---

### B08 · Storybook as standard

**What:** Every reusable component has a Storybook story with all meaningful
states (loading, error, empty, full).

**Trigger:** First shared UI component lands (likely during BU-feed Feed).

**Effort:** Ongoing, embedded in every UI PR. 10–20 minutes per component.

**Setup:**
```bash
pnpm dlx storybook@latest init
pnpm add -D @storybook/addon-a11y @storybook/addon-interactions
```

**Discipline:**
- Every component in `components/` has a `.stories.tsx` alongside it
- Each story has states: default, loading, error, empty, disabled (where relevant)
- Stories use the seed fixtures (F10) for consistency
- axe-core runs against every story (B02)

**Why:** Jeremy and Sharon can poke at components before data is real. Reviewers
see all states at once. Regressions become visible. Morale booster — you can
*see* the system being built.

---

### B09 · Contract tests for external integrations

**What:** For each third-party integration (WhatsApp, AI provider, SendGrid,
etc.), a small test that verifies our assumptions about their API are still
true. Runs against their sandbox or a mock of their published schema.

**Trigger:** First external integration Build Unit ships.

**Effort:** 1 hour per integration.

**Why:** APIs change. Sometimes without announcement. A contract test is how
you find out in CI at 9am, not in production at 3am.

**Pattern:**
```typescript
// tests/contracts/sendgrid.contract.test.ts
describe('SendGrid API contract', () => {
  it('accepts our send request shape', async () => {
    const response = await sendgridClient.send(knownValidPayload)
    expect(response.statusCode).toBe(202)
  })
  
  it('returns bounce webhooks in expected shape', async () => {
    // Against a fixture of their current webhook schema
    const webhook = loadFixture('sendgrid-bounce.json')
    const parsed = bounceSchema.parse(webhook)
    expect(parsed).toBeDefined()
  })
})
```

---

### B10 · Commitlint with conventional commits

**What:** Already included in Phase 0 (F03 commit-msg hook). Listed here for
completeness so the concept is catalogued in one place.

**Status:** Adopted in Phase 0.

---

### B11 · Codecov upload (re-enable)

**What:** Re-add the `Upload coverage` step in `.github/workflows/ci.yml` so
the lcov report `npm run test:coverage` emits gets posted to Codecov, which
then computes patch coverage and posts a status check on PRs. The 80% patch
target already lives in `codecov.yml` at repo root, waiting.

**Trigger:** The repo is connected to Codecov in the Codecov GUI AND
`CODECOV_TOKEN` is provisioned as a GitHub Actions secret. Until both are
true, the upload step is a no-op (or worse — it broke CI in #60 because
step-level `if: ${{ secrets.* }}` is invalid GHA syntax, so the gate
attempt itself crashed the workflow).

**Effort:** ~10 minutes once the token exists. Re-add this block under the
`Coverage` step:

```yaml
- name: Upload coverage
  if: env.HAS_CODECOV == 'yes'
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: false
    token: ${{ secrets.CODECOV_TOKEN }}
```

…and add this `env` block at the `check` job level (NOT step level):

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    env:
      HAS_CODECOV: ${{ secrets.CODECOV_TOKEN != '' && 'yes' || '' }}
    steps:
      ...
```

**Why this pattern:** GitHub Actions forbids `secrets.*` in step-level `if:`.
Job-level env-var indirection is the standard workaround.

**Why not do it now:** The Codecov account / repo connection / token
provisioning is a manual GUI task for the repo owner. Until those exist, the
upload step is pure dead weight and risks breaking CI again. F07 (`npm run
test:coverage`) already runs locally and in CI; the only thing missing is
the dashboard / patch-coverage gate.

**Dependencies:** F01 (branch protection) — for the patch-coverage status
check to be a *required* gate, branch protection has to add it.

**Origin:** Dropped from PR #60 to keep that PR landable; recorded here so
it isn't forgotten.

---

### B12 · Outbound scrape proxy + composer disclosure

**What:** A server-side proxy and composer-copy disclosure for the outbound
URL scraper that powers link-preview auto-fill (BU-link-share Phase C).

The MVP scraper hits target URLs directly from our app server. That leaks
our server's IP to the target site every time a member pastes a URL. For
the demo and short-term, this is fine — but pre-launch we should either
(a) route scrapes through a proxy / VPN / serverless function with a
disposable IP, or (b) add a one-line composer disclosure ("We'll fetch
the page to grab a preview") so members understand what happens and can
opt out by leaving the URL field blank.

**Trigger:** Either (a) any time the link-share feature touches a
non-fictional production URL outside dev/staging, or (b) at general
launch — whichever first. Demo / private testing is fine without it.

**Effort:** ~half a day.

- Composer disclosure copy: 30 minutes (one tooltip / inline note next to
  the URL field)
- Scrape proxy: 3–4 hours. Options: Vercel Edge function with rotating
  egress IP; Cloudflare Worker; AWS Lambda in a separate VPC. Cheapest
  is the Vercel Edge fn pattern since we're already on Vercel.

**Files:**

- `server/services/link-scraper.ts` — adds proxy URL config + fallback
- `app/compose/page.tsx` — adds the inline disclosure
- `docs/product/copy-library.md` — new key `composer.scrape.disclosure`

**Why not now:** Pre-launch / pre-public-beta privacy posture isn't
urgent for the demo path. Demo runs against fixture seed data and
pre-known URLs; no privacy lift in scope. The risk surfaces when real
members start pasting arbitrary URLs at scale.

**Origin:** Surfaced during the BU-link-share design Q&A (this session)
when the user asked about the scraper's privacy implications. Recorded
here so it can't fall through the cracks before launch.

**Dependencies:** BU-link-share (Phase C) — the scraper that creates the
need.

---

### B13 · Scope-aware filtering on `/data/[entity]` for queue_manager grants

**What:** Layer D055's per-type role scopes (`queue_manager:vetting`,
`queue_manager:flag`, etc.) into the generic admin CRUD engine
(`server/routers/admin.ts`) so that a scoped queue_manager visiting
`/data/<entity>` sees only the rows their scope unlocks — instead of
every row the role tier would unlock when unscoped.

BU-admin-crud ships **flat** by deliberate choice (Q3 in
`docs/build/session-briefs/bu-admin-crud.md`): `requireRole(role)` only.
The privacy concern (a `queue_manager:vetting` seeing `flag` rows) is
mitigated for MVP by routing `/data/request` → `/requests` (Q4), which
means no scoped entity renders generically today. This entry is the
follow-up that makes the engine itself scope-aware so future scoped
entities don't have to be special-cased.

**Trigger:** Either (a) a second entity gains type-scoped grants in the
metadata, or (b) `/data/request` stops redirecting to `/requests` and
admins want it as a debug surface, or (c) the first non-admin
queue_manager with a non-`*` scope is granted in production —
whichever first.

**Effort:** ~half a day.

- `server/services/admin/crud.ts` — extend `listEntity` with an
  optional `scopeFilter` arg derived from `ctx.activeScopes` and a
  per-entity scope→column mapping
- `server/admin/entity-metadata.ts` — add an optional
  `scopeColumn?: string` field to `EntityMetadataEntry` (e.g. for
  `request`, `'type'`)
- `server/routers/admin.ts` — middleware passes `ctx.activeScopes`
  through to the service; service applies the filter when
  `scopeColumn` is declared
- `tests/integration/admin-auth.test.ts` — add scoped-grant cases

**Why not now:** Only one entity (`Request`) has type scopes today,
and it doesn't render under `/data` (per Q4). Building the scope
plumbing speculatively for one entity that's also redirected away is
the kind of premature abstraction the project's working-rhythm.md
explicitly warns against. The hook lands when a real second entity
needs it.

**Origin:** Surfaced as Open Question 3 during BU-admin-crud brief
review (2026-04-26). Recorded here per CLAUDE.md's "engineering ideas
go to roadmap within 48 hours or they die" rule.

**Dependencies:** BU-admin-crud (the engine this layers onto), D055
(the scope model).

---

### B14 · CI guard — schema models ↔ entity-metadata coverage

**What:** A test (or lint rule) that diffs Prisma model names against
the keys of `entityMetadata` in `server/admin/entity-metadata.ts`.
Fails the build when a model lives in the schema without a metadata
entry, or when a metadata key has no corresponding model.

`server/admin/entity-metadata.README.md` already names this guard
("CI will eventually enforce this") but doesn't ship it. Without it,
schema additions silently miss the admin surface — the entity
becomes invisible to admins until someone notices and edits the
metadata file by hand.

The companion guards inside the CRUD engine — registry coverage and
enum-literal drift — ship with BU-admin-crud as
`tests/unit/admin-registry.test.ts`. B14 is the layer above those:
it polices the metadata file itself against the schema, before any
registry exists.

**Trigger:** Either (a) the next slice of entities lands (any
schema add that introduces ≥1 new model), or (b) the first time a
metadata entry goes stale in code review (a "you forgot to add it
to metadata" comment) — whichever first.

**Effort:** ~1 hour.

- `tests/unit/schema-metadata-coverage.test.ts` (new) — reads the
  Prisma DMMF model list at test time, diffs against
  `Object.keys(entityMetadata)`. Hard-fails on either-direction
  drift. An explicit allow-list at the top of the file lets us opt
  out specific models if a real reason emerges (none expected).
- Optionally, an ESLint rule for the same check (post-test if
  the test feels slow). Test alone is fine for MVP.

**Why not now:** Slice 1, 1.5, and 2 (minimal) all have hand-curated
metadata entries that match the schema today. The guard's value is
preventive — it catches the moment the next slice lands. Adding it
right now is fine but isn't blocking the BU-admin-crud build.

**Origin:** Surfaced during BU-admin-crud build (2026-04-26) when
discussing how the admin surface stays current as schemas evolve.
Logged per CLAUDE.md's roadmap discipline.

**Dependencies:** None (this guard is upstream of the engine —
doesn't require BU-admin-crud to land first, but lands more
naturally after).

---

## Tier C — Nice to have, adopt when value is clear

These aren't wrong — they're just not earning their cost at MVP scale. Each
has a specific trigger tied to scale or complexity reaching a threshold.

### C01 · Visual regression testing (Chromatic or Percy)

**Trigger:** When design system stabilises AND you've shipped >10 UI Build Units.
Before then, false positives from legitimate UI churn drown the signal.

**Cost:** Chromatic $149/month at their Starter tier; Percy is part of BrowserStack.
Or roll your own with Playwright screenshots (free but noisier).

**Why defer:** Early UI changes constantly. Visual diff noise is high. Wait for
stability.

**Alternative for MVP:** Playwright screenshot tests for the 3 most critical
screens (feed, composer, profile). Cheap, catches 60% of the value.

---

### C02 · Bundle size budget

**Trigger:** Client bundle exceeds 300KB gzipped, OR Lighthouse performance
score on the feed drops below 85.

**Cost:** Free. `@next/bundle-analyzer` + `size-limit`.

**Setup when triggered:**
```bash
pnpm add -D size-limit @size-limit/preset-app
```

**File:** `.size-limit.json`
```json
[
  { "name": "Landing page", "path": ".next/static/chunks/pages/index*.js", "limit": "200 KB" },
  { "name": "Feed page", "path": ".next/static/chunks/pages/feed*.js", "limit": "300 KB" }
]
```

CI fails if bundle exceeds limit.

**Why defer:** MVP bundle size isn't a problem until it is. Premature optimisation.

---

### C03 · Synthetic monitoring

**What:** Better Stack or Checkly runs a fake user through signup + publish
every 5 minutes.

**Trigger:** First pilot user onboarded.

**Cost:** Included in Better Stack's Uptime plan.

**Effort:** 1 hour setup.

**Why defer:** Until there are real users, there's nothing to protect. The
moment there are, this catches "technically up but functionally broken"
outages that health checks miss.

---

### C04 · Performance budget per route

**Trigger:** First user complains about slowness, OR P95 latency on any route
exceeds 1s.

**Cost:** Free. Lighthouse CI on preview deploys.

**Setup:** `.github/workflows/lighthouse.yml` runs Lighthouse CI on preview URL,
fails CI if performance score drops below threshold.

**Why defer:** MVP is faster than real-user perception thresholds for a while.
Add when numbers move.

---

### C05 · Property-based testing (fast-check)

**Trigger:** A non-trivial bug in permission logic, feed ranking, or rate limiting.
The pain from that bug is the signal.

**Cost:** Free. `pnpm add -D fast-check`.

**What:** For pure functions where input space is large, generate hundreds of
random inputs and verify properties hold. Finds edge cases humans don't think of.

**Why defer:** Valuable but niche. Wait for a bug that would have been caught.

---

### C06 · On-call runbook

**Trigger:** 1 week before pilot launch.

**Effort:** Half a day.

**Content:** Step-by-step for the 5 most likely incidents:
1. Database unreachable
2. Email deliverability dropped (SPF/DKIM misalignment)
3. AI provider down or rate-limited
4. Signup funnel broken (vetting queue frozen)
5. Sentry error rate spike (any path)

Per incident: symptoms, immediate mitigation, full fix, communication template
for affected users.

**File:** `docs/runbooks/on-call.md`

**Why defer:** Meaningful only when there are users to be affected. But has
a hard deadline — one week before pilot. Calendar entry now.

---

## Tier D — Probably skip until scale

These have real value but come with real costs. Documenting them here so we
don't reinvent the wheel when the day comes.

### D01 · Canary / progressive rollout

**When relevant:** 5,000+ active users, OR shipping changes that affect revenue
or safety.

**Why skip now:** Pilot cohort is small enough that staging + fast rollback
(B06) is sufficient. Feature flags (D036) give you per-user targeting at the
logical level. Infrastructure canary is overkill.

---

### D02 · Mutation testing (Stryker)

**When relevant:** Codebase with >80% coverage AND a recent "passing tests
missed a bug" incident.

**Why skip now:** High cost (slow CI runs, noisy signal). Low marginal value
until tests are already comprehensive.

---

### D03 · Formal error budgets (SLO/SLI)

**When relevant:** Multiple engineers, product/engineering tension on "ship
features vs fix reliability" decisions.

**Why skip now:** Team of one + Claude Code has no political problem to solve.
The budgets formalise a trade-off that doesn't yet need a formal arbiter.

---

### D04 · Service mesh / sidecar proxies

**When relevant:** Never, most likely. Monolith-first architecture (D002) means
services don't cross process boundaries.

**Why skip now:** Would only become relevant if the monolith was broken up into
microservices, which is explicitly rejected for MVP. Re-evaluate if scale forces
a split (unlikely pre-10,000 users).

---

### D05 · Feature experimentation platform (A/B testing infra)

**When relevant:** Specific experimental design in hand. Not "we might want
to A/B test someday."

**Why skip now:** Experimental design is a skill. Without it, A/B tests
mislead. Better to build the product first, then experiment when the question
is sharp.

---

## Review cadence

**Fortnightly engineering review** (Monday or Friday, 30 minutes):

1. Walk Tier B items — has any trigger fired? Move to Adopted if yes.
2. Walk Tier C items — any new signals? Add as Build Units if triggered.
3. Add new items surfacing in recent discussions — don't let them live only in chat.
4. Move items between tiers if circumstances changed.
5. Log the review outcome as a comment on this file (via PR).

**Quarterly** — full re-read of Tier D. Has scale or complexity changed? Does
anything need promoting?

**One rule:** Any engineering idea that surfaces in a chat or meeting and isn't
captured somewhere within 48 hours gets logged here. That's what this doc is
for. Otherwise it vanishes.

---

## Where items live across the project

To make it clear what goes where:

- **This doc:** engineering infrastructure, tooling, process discipline.
- **`docs/architecture/decision-log.md`:** foundational decisions with rationale
  (stack, architecture, naming). Each adopted item from here that requires a
  non-obvious choice gets an ADR.
- **`docs/product/parking-lot.md`:** product features under consideration.
- **`docs/build/plan.md`:** (to be created) phased sequence of Build Units.
- **`docs/build/units/BU-NNN.md`:** (to be created) individual Build Unit specs.

When a Tier B/C/D item is adopted, it typically:
1. Becomes one or more Build Units (if it's build work)
2. Gets an ADR (if the choice was non-trivial)
3. Gets a companion doc (if it's process — runbook, discipline doc, etc.)
4. Gets removed from this file (moved to Adopted section below)

---

## Adopted items (log)

*Once items land, move them here with PR references so the history is visible.*

*No items adopted yet — Phase 0 in progress.*
