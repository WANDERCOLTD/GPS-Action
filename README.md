# GPS Action

Purpose-built platform for coordinated activism. Replaces WhatsApp-based
coordination with a system that preserves speed and warmth while giving
the network structure, memory, and reach.

## Status

Pre-build skeleton. ERD and first features incoming.

## Quick start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with real values for your environment
# (both .env and .env.local are gitignored; .env is the project default)

# Generate Prisma client
npm run db:generate

# Run dev server
npm run dev
# App runs on http://localhost:3001 by default (set PORT in .env to change)
```

## Project structure

See `docs/index.md` for the authoritative map of every document.

```
/app              Next.js pages and routing (View)
/components       Reusable React components (design system)
/server
  /db             Prisma client, schema
  /routers        tRPC procedures (Controller)
  /services       Business logic (Model)
  /lib            Cross-cutting (auth, audit, notifications)
/shared           Types, contracts, errors, permissions
/prisma           Database schema and migrations
/styles           CSS tokens and components
/tests            Unit, integration, fixtures
/scripts          Utilities (seed, migrations)
/docs             All project documentation
```

## Engineering discipline

GPS Action uses a specific approach:

- **Types over tests** — TypeScript strict, no `any`, Prisma schema as truth
- **Contracts over conventions** — shared types flow from DB to UI
- **Layer boundaries** — enforced by ESLint, not goodwill
- **Session briefs** — every feature built from a written brief
- **Reviewer checklist** — every session reviewed against the same standard

See `docs/process/` for the full discipline documents.

## Documentation

Start with `docs/index.md`. It maps every document by purpose.

Key documents for building:

- `docs/feature-spec/v0.5.md` — what to build
- `docs/process/security-baseline.md` — data protection rules
- `docs/process/session-brief-template.md` — how to scope a session
- `docs/process/reviewer-checklist.md` — how to review a session's output
- `docs/product/scenarios.md` — lived-in role walkthroughs

## Scripts

- `npm run dev` — local dev server
- `npm run typecheck` — TypeScript strict check
- `npm run lint` — ESLint including boundary rules
- `npm run test` — Vitest suite
- `npm run db:migrate` — Prisma migrations
- `npm run db:seed` — populate demo data

## License

[To be determined — private for now.]
