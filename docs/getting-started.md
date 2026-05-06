# Getting started

From "just cloned" to "Eddie logged in on localhost" in about 15 minutes.

This doc is mechanical — what to install, what to run, what to expect.
For project context (what GPS Action is, architecture, build plan),
see `docs/build/bu-sequence.md` and the product docs in
`docs/product/`.

---

## Prerequisites

Before you start, you need:

- **Node.js 20 or later** — check with `node --version`
  - Install from https://nodejs.org or via nvm/asdf/volta
- **npm 10 or later** — ships with Node 20
- **Git** — presumed installed
- **A PostgreSQL 15+ server running locally** — see Step 1 below
- **macOS, Linux, or Windows with WSL** — the project is developed on
  macOS; other platforms work but setup commands may differ slightly

If any of these are missing, install them first.

---

## Step 1 — Install and start PostgreSQL

### macOS — Postgres.app (recommended)

The simplest option.

1. Download from https://postgresapp.com
2. Drag `Postgres.app` to `/Applications`
3. Open it; click **Initialize** (creates default databases)
4. You'll see an elephant icon in your menu bar confirming it's running

Add the CLI tools to your PATH (one-time):

```bash
sudo mkdir -p /etc/paths.d && \
  echo /Applications/Postgres.app/Contents/Versions/latest/bin | \
  sudo tee /etc/paths.d/postgresapp
```

Close and reopen your terminal. Verify:

```bash
psql --version
```

Should print the installed version.

### Linux / other — Docker

If you prefer Docker (Mac or Linux):

```bash
docker run --name gps-postgres \
  -e POSTGRES_USER=gps \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=gps_action_dev \
  -p 5432:5432 \
  -d postgres:16
```

Then skip to Step 3 — the database already exists.

### Linux — apt / yum

```bash
sudo apt install postgresql-16  # or equivalent
sudo systemctl start postgresql
sudo -u postgres createuser --superuser $USER
```

---

## Step 2 — Create the project database

_(Skip this if you used the Docker option — the container created it for you.)_

```bash
createdb gps_action_dev
```

Verify:

```bash
psql -l | grep gps_action_dev
```

Should show it listed.

---

## Step 3 — Clone and install

```bash
git clone https://github.com/paw2paw/GPS-Action.git
cd GPS-Action
pnpm install
```

This also installs pre-commit hooks (Husky) automatically via the
`prepare` script.

If the install has vulnerabilities reported, you can ignore them for
now — they're mostly transitive and do not affect local dev. Don't
blanket-upgrade the affected packages without checking the call-sites
(use `pnpm update <package>` per-package, not a sweeping `pnpm update`).

---

## Step 4 — Configure environment

Copy the example:

```bash
cp .env.example .env
```

(If `.env.example` doesn't exist, create `.env` directly.)

Edit `.env` and set `DATABASE_URL` to point at your local Postgres:

### If using Postgres.app or local apt install

```
DATABASE_URL="postgresql://YOUR_MAC_USERNAME@localhost:5432/gps_action_dev?schema=public"
```

Replace `YOUR_MAC_USERNAME` with your actual macOS username (run
`whoami` in terminal to see it). No password — local Postgres uses
trust auth by default.

### If using Docker

```
DATABASE_URL="postgresql://gps:dev@localhost:5432/gps_action_dev?schema=public"
```

### Verify the .env

```bash
grep DATABASE_URL .env
```

Should echo back the value you just set.

---

## Step 5 — Generate Prisma client + run migrations

```bash
pnpm db:generate
```

Generates the TypeScript client from the schema.

```bash
pnpm exec prisma migrate deploy
```

Applies all committed migrations to your database. Should print
"No pending migrations" or apply them sequentially.

**If you get errors here:**

- "Can't reach database server" — Postgres isn't running. Check
  that Postgres.app shows the elephant, or `docker ps` shows the
  container, or the systemd service is started.
- "Database does not exist" — go back to Step 2.
- "Auth failed" — check your `DATABASE_URL` username/password.

---

## Step 6 — Seed the database

```bash
pnpm exec tsx scripts/seed.ts
```

Creates 5 demo users with appropriate roles. Expected output:

```
Seeded 5 users and 2 role grants.
```

**Who's seeded:**

| Name            | Role          | Purpose                        |
| --------------- | ------------- | ------------------------------ |
| Eddie Morales   | member        | Primary demo user              |
| Cary Whitfield  | queue_manager | Demoing queue-related features |
| Bette Rosenthal | admin         | Demoing admin features         |
| Humphrey Kline  | member        | Feed variety                   |
| Ingrid Blum     | member        | Feed variety                   |

Re-running is safe — the script uses `upsert`, won't duplicate.

---

## Step 7 — Start the dev server

```bash
pnpm dev
```

You should see:

```
▲ Next.js 15.x
- Local:        http://localhost:3001
```

Open http://localhost:3001 in your browser.

---

## Step 8 — Log in

1. Navigate to http://localhost:3001/dev/login
   (Or click "pick a user" in the top-right header.)
2. You should see 5 user cards.
3. Click **"Log in as Eddie Morales"** to log in.
4. The header now shows "Logged in as Eddie Morales" with a "Switch
   user" link.

**You're in.** Explore the app.

---

## Running the validation pipeline

Before committing anything, the standard checks:

```bash
pnpm typecheck   # TypeScript
pnpm lint        # ESLint (including F06 custom rules)
pnpm format:check  # Prettier
pnpm test            # Vitest
```

All four should pass. If any fail, fix before committing — the
pre-commit hooks (Husky + lint-staged) will auto-format on commit,
but a typecheck failure will still break the commit.

---

## Working with migrations

### Creating a new migration

After editing `prisma/schema.prisma`:

```bash
pnpm exec prisma migrate dev --name descriptive_name
```

This creates a new migration folder under `prisma/migrations/` with
the SQL diff, and applies it to your database. Commit the migration
files along with the schema change.

### Resetting the database

Useful when migrations get tangled during development:

```bash
pnpm exec prisma migrate reset
```

Deletes all data, re-applies all migrations, and re-seeds. Don't do
this in staging/production.

---

## Troubleshooting

### "Can't reach database server at placeholder:5432"

Your `.env` has placeholder values. Go back to Step 4.

### "Cannot find module '@tailwindcss/postcss'"

If you hit this after cloning fresh, the project expects
`@tailwindcss/postcss` which should be in `package.json` and
installed by `pnpm install`. If it's missing:

```bash
pnpm install -D @tailwindcss/postcss
```

Check that `postcss.config.mjs` exists at the repo root with
appropriate content:

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

### "No migrations found" after fresh clone

The `prisma/migrations/` folder is committed to git. If it's missing,
something is wrong with the clone. Re-clone or check you're on the
right branch.

### Dev server port already in use

If 3001 is taken, override:

```bash
PORT=3002 pnpm dev
```

### Husky hooks not running on commit

If pre-commit hooks skip (shouldn't happen after fresh clone but can):

```bash
pnpm prepare
```

Re-installs the hooks.

### Fresh clone skips database entirely

You could run tests without a database — they're unit-level mostly:

```bash
pnpm test
```

But the dev server (step 7) and anything touching `/dev/login` needs
Postgres.

---

## Where to go next

Once you're running, these docs orient you:

- **`docs/build/bu-sequence.md`** — What Build Units exist, in what
  order they ship
- **`docs/build/session-briefs/`** — Individual session briefs, one
  per Build Unit
- **`docs/architecture/decision-log.md`** — Design decisions and
  rationale (ADRs)
- **`docs/architecture/erd.md`** — Entity relationships
- **`docs/product/design-philosophy.md`** — How the product should
  feel
- **`docs/process/session-hygiene.md`** — How sessions are run
- **`CLAUDE.md`** — Operating context for AI-assisted development

The **shortest path to understanding the codebase** is probably:

1. `docs/product/design-philosophy.md` — the vibe
2. `docs/build/bu-sequence.md` — the plan
3. `prisma/schema.prisma` — the data model
4. `app/feed/page.tsx` — a concrete feature entry point
5. `server/routers/post.ts` — how tRPC procedures are structured

---

## Common commands reference

```bash
# Dev server
pnpm dev

# Validation (all must pass)
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test

# Database
pnpm exec prisma migrate dev --name NAME    # new migration
pnpm exec prisma migrate deploy             # apply pending
pnpm exec prisma migrate reset              # nuke + re-seed
pnpm exec prisma studio                     # DB GUI in browser
pnpm exec tsx scripts/seed.ts               # re-run seed

# Prisma client
pnpm db:generate                   # after schema changes

# Format
pnpm format                        # write
pnpm format:check                  # check only
```

---

## What this doc does NOT cover

1. **Deploying to staging or production** — see
   `docs/architecture/environments.md`
2. **CI configuration** — see `.github/workflows/ci.yml` and
   `docs/process/ci-runbook.md` (if present)
3. **Writing your first feature** — session briefs cover this flow
4. **Contributing guidelines** — not yet written
5. **Code review expectations** — not yet formalised
6. **Windows-native setup** — use WSL; native Windows isn't tested

---

_Last updated April 2026. If something in this doc is wrong or
out-of-date, update it. Getting-started guides rot fast; keep it
honest._
