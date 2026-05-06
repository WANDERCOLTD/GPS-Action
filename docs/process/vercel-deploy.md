# Vercel deploy + demo data — manual flows

GPS Action's Vercel deployment is a **demo environment**, not real
production. This doc captures the manual flows for: (1) pushing a
deploy when the auto-deploy is rate-limited or skipped, and (2)
loading the demo data (users, groups, posts, kanban tickets) into the
demo DB.

---

## What runs automatically vs. manually

| Layer                                                                      | Runs on Vercel          | Trigger                                                                                                   |
| -------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `next build`                                                               | ❌ **Manual**           | Run on demand via `vercel deploy --prebuilt --prod` (Option 2 below). Auto-deploy on `main` is OFF.       |
| Schema migrations (`prisma migrate deploy`)                                | ❌ **Manual**           | Run by hand against the demo DB after schema PRs                                                          |
| Required reference data (FF rows, PostKind slugs, BoardColumn defaults, …) | ✅ Auto with migrations | Lives in `prisma/migrations/` per [D070](../architecture/decision-log.md#d070); ships when migrations run |
| Demo data (Eddie / Bette / etc, demo posts, kanban tickets)                | ❌ **Manual**           | Run by hand via `pnpm seed:demo` against the demo DB                                                      |

The **required vs. optional** split is deliberate: required reference
data ships with the schema migration that needs it (D070); demo data
is a separate, opt-in step. Don't merge them.

---

## Git-triggered deploys are OFF

`vercel.json` at the repo root sets `git.deploymentEnabled: false`.
Vercel **does not create a deploy record** on any git push (preview
or main). No PR check is reported. This is the durable evolution of
the earlier `scripts/vercel-ignore-build.sh` approach.

Why the change: the Ignored Build Step skipped the _build_ but
Vercel still created a deployment record per push, counting against
the Hobby tier's `api-deployments-free-per-day` (100/day) hard
quota. With our stacked-atom workflow that capped out by mid-
afternoon. Disabling git deployments at the project level avoids
the quota entirely.

Manual deploys still work — the Vercel CLI's `deploy` command goes
through a different code path that respects this flag's
"manual-only" intent. See Option 2 below for the canonical refresh
flow.

---

## Daily build rate-limit hit

Vercel's free tier caps daily preview deploys. With many PRs in a
day (typical for this project's stacked-atom style), the limit
trips and the auto-deploy is blocked. Three options when this
happens:

### Option 1 — Redeploy a previous build (cheapest)

For docs / readme / no-code-change PRs, or when you just need the
latest merged code redeployed without a new build minute:

1. Vercel dashboard → Deployments tab.
2. Find a recent successful build with the desired code.
3. Click the `…` menu → **Redeploy**.

This reuses the existing build artefact — no new build minute
consumed. Useful for "promote to prod" gestures or for
re-running a deploy after fixing a runtime config.

### Option 2 — Local prebuilt deploy (recommended for code changes)

Build locally, push only the artefact:

```sh
# One-time setup:
pnpm install -g vercel
cd /Users/paulwander/projects/gps-action
vercel link            # follow prompts to attach to the right project

# Each deploy:
git checkout main && git pull --ff-only
pnpm install
next build             # produces .next/ locally
vercel deploy --prebuilt --prod
```

Vercel runs no remote build — it just hosts the artefact. Much
faster, much lighter on the build-minute quota. Counts as a
deployment but not as a build.

### Option 3 — Standard CLI deploy

```sh
vercel deploy --prod
```

Vercel does the build remotely. Same quota cost as a Git-pushed
deploy. Use only if you can't build locally.

---

## Loading demo data into the Vercel DB

After a schema change lands or after the demo data drifts, refresh
the demo data on the Vercel DB:

```sh
# Get DIRECT_URL from Vercel project settings → Environment
# Variables. Use DIRECT_URL (not DATABASE_URL) — pooled endpoints
# can't hold the session-level locks Prisma migrate needs, and
# the seed scripts run several create() statements in a single
# transaction.
export DIRECT_URL="postgresql://...neon.tech/.../prod"

# Apply pending schema migrations (idempotent — Prisma tracks
# which have run via _prisma_migrations table).
pnpm exec prisma migrate deploy

# Load demo data (idempotent — both seed scripts use deterministic
# IDs and skip existing rows).
pnpm seed:demo
```

`pnpm seed:demo` is the convenience wrapper:
`tsx prisma/seed.ts && tsx scripts/seed.ts`. The two scripts cover
different data:

| Script            | What it creates                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/seed.ts`  | F10 fixture seed — 5 groups (Letter Writers, Media Response, Leeds Activists, Students Network, Wellbeing Circle), Requests, Comments, Reactions, AuditLog rows |
| `scripts/seed.ts` | Curated demo seed — 6 demo users, 3 working-groups (Writers, Manchester, Rapid Response) with default BoardColumns + 9 kanban tickets, 18 demo posts            |

Both are **idempotent**. Re-running is safe; existing rows are
skipped, not duplicated. Neither is destructive — they don't
truncate or reset.

### To wipe + reseed (DESTRUCTIVE)

Don't do this on the demo DB unless you're fine losing any
manually-created rows from member testing:

```sh
DIRECT_URL=... pnpm exec prisma migrate reset    # drops all data, reapplies migrations, runs prisma/seed.ts
DIRECT_URL=... pnpm db:seed             # adds the curated demo overlay
```

---

## After-deploy smoke check

After a manual deploy or seed:

1. Visit the demo URL → version badge in footer should match the
   `package.json` `version` field that was deployed.
2. Visit `/board` (with `coord_board_v1` ON in the FeatureFlag
   table) → Coordination boards picker shows seeded groups.
3. Click any of **Writers** / **Manchester** / **Rapid Response**
   → populated kanban with the 9 demo tickets (urgent dot on
   one card, mix of assigned + unclaimed).
4. Click any card → ticket-detail page (Surface 2) loads with
   typed title + body + assignees. Assign me / Follow / Edit
   affordances all functional.

---

## Related

- `vercel.json` — `git.deploymentEnabled: false` disables all
  git-triggered deploys at the project level.
- `prisma.config.ts` — `DIRECT_URL` vs `DATABASE_URL` rationale
  (PgBouncer can't hold the locks `prisma migrate` needs).
- D070 (decision log) — required reference data ships in
  migrations, not seeds. Demo data is the explicit non-required
  counterpart.
- `package.json` `seed:demo` — combined demo-seed wrapper.
