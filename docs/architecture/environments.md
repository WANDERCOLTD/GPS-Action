# Environment model

**Status:** Architecture doc, April 2026.
**Purpose:** Define how GPS Action deploys and runs across development,
staging, and production, including data, auth, and integration
differences per environment.

Read alongside:

- `docs/build/bu-sequence.md` — which BUs need which environments
- `docs/build/phase-0-foundations.md` — infrastructure sessions
  (especially F09 preview/staging, F10 seed data)
- `docs/process/security-baseline.md` — what data protection looks
  like per environment

---

## Three lanes

GPS Action runs in three distinct environments:

|                     | Dev              | Staging                        | Production                  |
| ------------------- | ---------------- | ------------------------------ | --------------------------- |
| **Host**            | Developer laptop | Vercel + AWS RDS               | Vercel + AWS RDS            |
| **URL**             | `localhost:3001` | `staging.gps-action.org` (TBD) | `gps-action.org` (TBD)      |
| **Database**        | Local Postgres   | Staging RDS instance           | Production RDS instance     |
| **Data**            | Messy synthetic  | Realistic synthetic            | Real users                  |
| **Auth**            | Dev stub         | Real + Mailhog                 | Real + real email           |
| **SMS (for 2FA)**   | Console log      | Twilio test                    | Twilio production           |
| **Activist Mailer** | Any URL          | Sandbox domain allowlist       | Production domain allowlist |
| **Sentry**          | Disabled         | Staging project                | Production project          |
| **Analytics**       | Disabled         | Staging project                | Production project          |
| **Feature flags**   | All enabled      | Flag-configured                | Flag-configured             |
| **AWS region**      | N/A              | eu-west-2                      | eu-west-2                   |

---

## Dev environment

**What it is:** every developer's laptop. Paul's MacBook is the first
and, for now, only one.

### Database

Local Postgres. Options:

- **Postgres.app** (macOS) — easiest
- **Docker Compose** — more reproducible, better for multi-dev teams
- **Homebrew** — works, slightly more config

Connection string in `.env`:

```
DATABASE_URL="postgresql://paulwander@localhost:5432/gps_action_dev"
```

### Data

Seeded from `scripts/seed-dev.ts`. Deliberately rich and messy:

- 4-5 named users with clear "(dev)" suffixes so no confusion with
  real people
- 15-20 posts across all post types, including edge cases (very short,
  very long, with AM URLs, without, different visibilities)
- 3-4 groups with varying membership
- A few work items in various states (unclaimed, claimed, resolved,
  expired)
- A couple of audit log entries so the log isn't empty

The seed script is **idempotent** — uses `upsert` where possible so
re-running adds without duplicating. Safe to run multiple times.

### Auth

**Dev stub.** See BU-001-lite brief. Rejects in production
(`NODE_ENV === 'production'` throws).

Flow:

1. Visit `/dev/login`
2. See a list of seeded users
3. Click "Log in as Eddie" → cookie `gps_dev_user_id` is set
4. Now treated as that user for all requests
5. Change users any time by revisiting `/dev/login`

No passwords, no 2FA, no magic links.

### Integrations

Everything **mocked or disabled** in dev:

- **Email** — `console.log` only. Any code that would send email dumps
  the payload to the server log.
- **SMS** — same. `console.log('SMS to +44...: <code>')`.
- **Activist Mailer** — no API calls. The URL field on Post is a plain
  string; the frontend displays it as a link.
- **Sentry** — `SENTRY_DSN=""` in `.env`, integration disabled.
- **PostHog** — disabled in dev per D037.

---

## Staging environment

**What it is:** a shared deployment for the team (Paul + whoever else)
to test features, demo to stakeholders, and verify before production.

**When it matters:** when you want to share a demo with someone remote
who isn't going to clone the repo. Or when testing production-shaped
flows (real auth, real email capture).

### Database

AWS RDS Postgres, eu-west-2, separate instance from production. Smaller
size — `db.t4g.micro` is fine.

Connection via environment variable set in Vercel:

```
DATABASE_URL="postgresql://gps_staging:PASS@staging-rds-...:5432/gps_action_staging?schema=public"
```

**Never connect to staging from a developer laptop in day-to-day work.**
Staging is for deployed testing.

### Data

Seeded once from `scripts/seed-staging.ts`. This seed script is:

- Similar to dev but with fewer edge cases and cleaner content
- Names are realistic but clearly-labelled as test
  (e.g., "Eddie (test)", "Ruth (test)")
- No real personal data ever

Re-seeding staging is an explicit operation, not automatic. If
schema changes require re-seeding, there's a migration path documented
per-change.

### Auth

**Real auth flow, with captures.**

When BU-002 lands and real auth is in place:

- **Email magic links** via SMTP — captured by Mailhog or Ethereal
  rather than delivered to real inboxes
- Mailhog/Ethereal runs as a service in the staging infrastructure;
  accessible via a protected URL (HTTP basic auth) so the team can
  view captured emails
- **SMS 2FA** — Twilio in **test credentials** mode, which accepts
  specific numbers like `+15005550006` and always returns "delivered"
  without sending real SMS
- **Bypass accounts** — specific test accounts have a pinned code like
  `000000` that always works; environment-gated, audit-logged, and
  heavily restricted

Example config:

```typescript
if (env.ENVIRONMENT === 'staging' && env.TEST_BYPASS_ACCOUNTS.includes(user.email)) {
  // Accept code '000000' without validation
  // Log this use to audit
}
```

This is **carefully isolated** — never runs in production, and the
bypass accounts are specific known addresses, not a pattern match.

### Integrations

- **Email** — SMTP via Mailhog/Ethereal (captured, never delivered)
- **SMS** — Twilio test credentials
- **Activist Mailer** — URL allowlist restricts to `activistmailer.com`
  or staging sandbox domains. No API calls still — just URL display.
- **Sentry** — staging project, enabled, errors visible
- **PostHog** — staging project, separate from production

---

## Production environment

**What it is:** the real thing. Real users, real data, real money
(when fundraising lands), real responsibility.

**When it matters:** once pilot users are onboarding. Not before.

### Database

AWS RDS Postgres, eu-west-2, production instance. Appropriately sized
for load (start `db.t4g.small`, scale up as needed).

Per UK GDPR (see NFR-03 in the feature spec), data must stay in
UK/EEA. `eu-west-2` is London region — compliant.

Automated backups, point-in-time recovery, encryption at rest.

### Data

**No seeding of synthetic data after bootstrap.**

Production seed script runs exactly once during initial setup:

- Starter Regions (the UK hierarchy — nations, regions, counties)
- Starter Groups (Writers, Newsletter Editors, etc. — per groups.md
  §"Migration / bootstrap" when it's written)
- **One** bootstrap admin account (identified by
  `BOOTSTRAP_ADMIN_EMAIL` env var set at deploy time)
- Nothing else

From there, real users create real data.

### Auth

Full production auth — per BU-002 when it lands. No bypass codes, no
test numbers, no capture.

Real email delivery (AWS SES or similar). Real SMS via Twilio
production credentials. Full 2FA. Full session management.

### Integrations

- **Email** — AWS SES via SMTP, eu-west-2
- **SMS** — Twilio production credentials
- **Activist Mailer** — production URL allowlist
- **Sentry** — production project
- **PostHog** — production project
- **AWS KMS** — production key for Tier 1 data encryption

---

## Bootstrap — "how does the first admin exist?"

A surprisingly important question. The system starts empty. There are
no admins. But you need an admin to grant admin to others.

### The bootstrap flow

Each environment has a `scripts/bootstrap-admin.ts` script (exact name
TBD when implemented). It:

1. Reads `BOOTSTRAP_ADMIN_EMAIL` from environment
2. Checks if a user with that email exists
3. If not, creates them
4. Checks if they have an active admin role grant
5. If not, creates one with `grantedReason: "initial bootstrap"`
6. Logs loudly that this was done

### Per environment:

- **Dev:** runs automatically as part of `seed-dev.ts`. The bootstrap
  admin email is `eddie@gps-action.test` or similar.
- **Staging:** runs once on first deploy. Bootstrap email is a team
  account (`paul@…` or a shared admin address).
- **Production:** runs manually during initial deploy, by the infra
  owner (Paul), with their real email. Logged, audited, never re-run.

### Never run in production twice

The production bootstrap script must check "has this already been run?"
and refuse to run a second time. Accidental re-run could create a
second admin unexpectedly — bad operational surprise.

---

## Environment configuration

### .env files

Each environment has its own. Never committed except `.env.example`.

- `.env` (local dev — in gitignore)
- `.env.staging` (never on laptop — lives in Vercel project settings)
- `.env.production` (never on laptop — lives in Vercel project
  settings, or AWS Secrets Manager)

### Environment variable naming

Clear prefix per concern:

```
DATABASE_URL=...
JWT_SECRET=...
SMTP_HOST=...
AWS_REGION=...
KMS_KEY_ID=...
ACTIVIST_MAILER_ALLOWED_DOMAINS=activistmailer.com,am.example
SENTRY_DSN=...
POSTHOG_KEY=...
ENVIRONMENT=development|staging|production
```

Code reads `process.env.ENVIRONMENT` to branch behaviour. Defaults to
`development` if unset.

### Secrets management

**Development:** `.env` file on laptop. Gitignored. If it leaks, rotate
and re-issue.

**Staging and production:** never touch a laptop. Managed in Vercel's
project settings or AWS Secrets Manager. Access limited to deployment
roles. Rotated quarterly (minimum) or on suspected compromise.

### Feature flags

Per D036, feature flags are DB-driven. The same schema (`FeatureFlag`
model) exists in every environment. But flags are configured
independently — an experiment enabled in staging isn't automatically
enabled in production.

Dev defaults: most flags enabled globally for testing. Controlled via
seed script.
Staging: flags configured to match upcoming production rollout.
Production: conservative — opt-in rollouts, kill-switches available.

---

## The deployment pipeline (future)

**Not yet built.** This is the plan for when F09 (preview + staging
deploys) lands:

```
  developer commits
        │
        ▼
   push to branch
        │
        ▼
     ┌──────────┐
     │    CI    │  ── test, lint, typecheck, prettier
     └──────────┘
        │
        ▼
   merge to main
        │
        ▼
   ┌───────────────┐
   │  Vercel auto  │  ── deploys main to staging
   │   deploys     │
   └───────────────┘
        │
        ▼
     [staging]
        │
        ▼  (manual promote)
        │
   ┌───────────────┐
   │   Vercel      │
   │ production    │
   │  deploy       │
   └───────────────┘
        │
        ▼
    [production]
```

**Staging auto-deploys on merge to main.** Production deploys are
manual — Paul (or whoever) clicks "promote to production" in Vercel
after staging has been verified.

Database migrations run as part of the deploy. Prisma Migrate's
`deploy` command — applies pending migrations safely without prompts.

---

## Checklist for "is this environment ready?"

### Dev ready when:

- [ ] Local Postgres running
- [ ] `.env` configured with `DATABASE_URL`
- [ ] `npm install` run, hooks installed
- [ ] `npx prisma migrate dev` has applied migrations
- [ ] `npm run seed:dev` has populated data
- [ ] `npm run dev` starts on port 3001
- [ ] Can open `http://localhost:3001` and see the app

### Staging ready when:

- [ ] AWS RDS staging instance provisioned
- [ ] Vercel project connected to the repo, `main` auto-deploying
- [ ] Environment variables set in Vercel
- [ ] Mailhog/Ethereal running and accessible
- [ ] Twilio test credentials configured
- [ ] Sentry staging project connected
- [ ] Migrations applied, staging seed run
- [ ] Bootstrap admin can log in
- [ ] Real auth flow works end-to-end via captured email

### Production ready when:

- [ ] AWS RDS production instance provisioned (with backups,
      encryption, point-in-time recovery)
- [ ] Vercel production environment configured (manual promotion only)
- [ ] Environment variables set in Vercel with real secrets
- [ ] AWS KMS key provisioned for data encryption
- [ ] Real email provider (SES) configured
- [ ] Real SMS provider (Twilio production) configured
- [ ] Sentry + PostHog production projects connected
- [ ] Migrations applied
- [ ] Bootstrap admin created (documented as a one-time event)
- [ ] DNS configured
- [ ] SSL working
- [ ] First real user can sign up and vet through
- [ ] Audit log is capturing events
- [ ] Feature flags are set for conservative rollout
- [ ] Legal: Privacy Policy and Terms linked in footer
- [ ] GDPR data subject request flow exists (minimum: email address
      that can receive and action requests)

Production readiness is a big checklist because production matters.
Staging readiness is a subset; dev readiness is the smallest.

---

## What this doc does NOT cover

(Naming gaps explicitly.)

1. **Specific infrastructure-as-code.** This doc says "AWS RDS" but
   doesn't provide Terraform/Pulumi configs. Those come as separate
   infrastructure work.
2. **Disaster recovery runbooks.** "What if RDS goes down" — separate
   ops doc, future.
3. **Load testing / capacity planning.** Premature without real
   users.
4. **Multi-region setup.** Single-region (eu-west-2) for MVP.
5. **CDN / asset optimisation.** Vercel handles this for free for the
   static side.
6. **Cost management.** Future concern when scale matters.
7. **Blue/green or canary deploy strategies.** Overkill for MVP;
   standard Vercel deploys are fine.
8. **Developer-specific local variations.** If different devs want
   different seed datasets, that's a per-dev override file pattern to
   design when we have multiple devs.

---

## Near-term practical actions

Based on the BU sequence plan:

**For the demo (Paul's laptop only):** dev environment, no staging needed.

**Before first external pilot:** staging needs to exist (BU-002 + F09).
Probably a 3-5 day build to stand it up: RDS instance, Vercel
configuration, Mailhog setup, real auth integration.

**Before production launch:** production checklist above. Probably
a week of deployment, verification, and pre-launch sanity-checking.

None of these block the demo. The demo is dev-only.
