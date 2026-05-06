# GPS Action

A platform for coordinated community activism. Built as a
coordination layer for a UK network with ~350,000 downstream reach
via member coordinator networks.

**Status:** Early development. Local demo working; staging and pilot
users planned.

## Quick start

See **[`docs/getting-started.md`](docs/getting-started.md)** — from
clone to logged-in Eddie in about 15 minutes.

## Documentation

- **Build plan:** [`docs/build/bu-sequence.md`](docs/build/bu-sequence.md)
- **Architecture:** [`docs/architecture/`](docs/architecture/) — decision log, ERD, environments
- **Product philosophy:** [`docs/product/design-philosophy.md`](docs/product/design-philosophy.md)
- **Process:** [`docs/process/`](docs/process/) — session hygiene, briefs

## Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Backend:** tRPC 11, Prisma 5, PostgreSQL
- **Testing:** Vitest
- **Deployment target:** Vercel + AWS RDS (eu-west-2)

## Development workflow

1. Read the session brief in `docs/build/session-briefs/` for the
   Build Unit you're working on
2. Branch from `main` (e.g., `phase-1/bu-feed`)
3. Implement; run `pnpm test && pnpm lint && pnpm typecheck`
4. Commit — Husky runs pre-commit hooks automatically
5. Push, open PR, wait for CI, merge

## Principles

- Honest, quiet UI — this is not a marketing platform
- Mechanical enforcement where possible (custom ESLint rules, Prisma
  invariants, audit logs)
- Every architectural decision documented in
  `docs/architecture/decision-log.md`
- Every Build Unit has a written brief before execution

## Licence

[To be determined before first public contributor.]

## Contact

[To be added when pilot phase begins.]
