---
slug: bu-vercel-prep
status: planned
phase: 2
priority: high
note: 'Discussion stub / checklist for the first Vercel deploy. Not a code-build BU — a gating doc that captures what must be true on Vercel before a walkthrough cohort can use the deployed URL. Resolves into smaller BUs as items get worked.'
---

# SESSION BRIEF · bu-vercel-prep — production deploy readiness

_Brief version: 0.1 (discussion / checklist) · Author: Paul (via Claude) · Date: 2026-04-30_

---

## Why this exists / why now

The app runs cleanly on local dev. The first deploy to Vercel is the
next step — but several pieces of dev-environment configuration
won't translate, and a walkthrough cohort hitting the deployed URL
will hit problems we can fix proactively.

This brief is a **checklist**, not a code build. Each row is either
small (config) or unfolds into its own BU (auth, demo data
strategy). The point is to surface every "we noticed this on the
way to Vercel" item in one place so the deploy isn't ambushed by
them in sequence.

---

## Pre-deploy checklist

### 🔴 Blockers — Vercel deploy can't go to a walkthrough audience without these

| # | Item | Status | Owner / BU |
|---|---|---|---|
| B1 | **Production auth path** — dev-auth (`/dev/login`) 404s in prod; no real sign-in flow exists | Not started | `bu-prod-auth` |
| B2 | **`DATABASE_URL` env on Vercel** pointing at a real Postgres (Vercel Postgres / Supabase / Neon / RDS) | Not configured | This BU |
| B3 | **`prisma migrate deploy` runs on first Vercel build** (already in `predeploy` script — verify Vercel build hooks pick it up) | Likely OK, verify | This BU |
| B4 | **Production seed strategy** — currently `db:seed` inserts 24 demo posts. Either gate seed by env, OR have prod start empty, OR carry a curated "intro" post set | Decision needed | This BU |

### 🟠 Should-do — won't block deploy, will bite the walkthrough

| # | Item | Status | Notes |
|---|---|---|---|
| S1 | **`ACTIVIST_MAILER_ALLOWED_DOMAINS` env** — defaults to `activistmailer.com`. If real AM URLs from prod come from a different domain (or multiple), set the comma-separated list explicitly | Configurable | Affects D074 AM-flag detection |
| S2 | **`NEXT_PUBLIC_APP_ENV=production`** — drives the version-badge palette (green → "prod"). Currently set by Vercel automatically via `VERCEL_ENV`, but worth verifying | Likely auto | next.config.mjs falls through to NODE_ENV |
| S3 | **Sentry / error-reporting integration** — the `ErrorBoundary` has a TODO for `D037`. Bare-minimum is a Sentry SDK init; lets you see walkthrough errors instead of relying on user reports | Not integrated | Engineering roadmap candidate |
| S4 | **Smoke-test the prod build locally** with `npm run build && npm run start` before pushing to Vercel. Catches build-only issues (env-time crashes, `'use client'` misuse) | Not done in this branch | One-off pre-merge step |
| S5 | **Verify migrations run idempotently on a fresh DB** — spin up a clean Postgres, run `prisma migrate deploy` end-to-end, confirm. All migrations use `IF NOT EXISTS` / `ON CONFLICT` per D070, but proof matters before prod | Not done | One-off |

### 🟡 Nice-to-have — schedule for after first deploy is stable

| # | Item | Status | Notes |
|---|---|---|---|
| N1 | **N+1 rewrite of `listTopCommentsForPosts`** to a single `DISTINCT ON (postId)` raw query. Fine at testing scale; will scale-bite at first ~50 active members | Logged | Audit punch-list, not urgent |
| N2 | **Image optimisation** — seed SVGs and brand logos served as plain static. Vercel's image optimizer would help but isn't urgent | Static OK | Vercel |
| N3 | **Composite index on `Comment` `(postId, deletedAt, systemKind, createdAt DESC)`** for the comment-peek query | Logged | D073-related |
| N4 | **Replace temporary 401 image** in seed (already done in v0.2.46) — verify no other broken hotlinks remain | Done | Audit follow-up |
| N5 | **Vercel preview environment** for branch PRs — gives you a deploy-per-PR for smoke testing before merge | Not configured | Default Vercel feature; one toggle |

---

## Decision points

### D1. Demo data on prod

Three options:

| Option | UX | Effort |
|---|---|---|
| **Empty prod** — seed runs only outside production | Cohort sees an empty feed on first login; they post the demo content as their first action | Small — gate seed function |
| **Curated intro posts** — a small set of 3-5 honest "welcome to GPS Action" posts authored by an admin user | Cohort sees a feed that demonstrates the format without being misleading | Medium — write the posts, mark them with a special seed key |
| **Full demo seed** — the 24-post demo runs in prod too | Cohort sees a populated feed but the data is fake | Trivial — but feels wrong on a real deploy |

**Recommended**: option 2 (curated intro). The cohort needs context;
fake data on a "real" URL muddies the experience.

### D2. Auth at first deploy

If `bu-prod-auth` isn't done by the time you want to deploy, ship
a "demo mode" bearer (option from `bu-prod-auth` brief) as an
interim:

- A query parameter `?demo=<token>` on first visit sets a session
  cookie for a fixed seeded user
- Walkthrough cohort gets one URL with the token baked in
- 30-day cookie, expires when token expires
- Clearly demo-only, not a long-term auth solution

### D3. Subdomain / vanity URL

`gps-action.vercel.app` is fine for walkthroughs. A custom domain
(`app.gpsaction.uk` or similar) is a Phase 3 polish.

---

## Definition of done (this BU)

- Every blocker (B1–B4) is either resolved or has an explicit owner
  and ETA
- Every should-do (S1–S5) is checked off before the cohort hits the
  deployed URL
- A new ADR (probably `D076` after `D075` for prod-auth) records
  the chosen demo-data strategy and any deploy-time env conventions
  that future BUs need to honour
- The Vercel project is deployed, healthcheck `/api/healthz`
  returns 200, an admin can log in (via prod auth or demo bearer),
  the feed renders

---

## Related

- `bu-prod-auth` — the auth blocker (B1)
- D070 — reference data ships in migrations (the seed strategy
  decision, D1, falls out of this rule's edge)
- D072 — publish router (the Vercel deploy will be the first time
  the modal flow runs against a non-seeded DB)
- D073 — per-kind comment peek (works fine on Vercel; nothing to
  configure)
- D074 — AM flag (S1 is the env-config follow-up)
