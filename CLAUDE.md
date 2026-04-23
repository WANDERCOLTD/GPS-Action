# GPS Action — Claude Code Working Notes

## What this project is

GPS Action is a purpose-built platform for coordinated activism — replacing
the network's WhatsApp-based coordination with structured posts, regional
routing, vetting, and integrated WhatsApp dispatch.

For the full picture, read `docs/index.md`.

## Status

Pre-build. Skeleton in place. Next: ERD, then features.

## Stack

- TypeScript (strict mode, no `any`)
- Next.js 15 (App Router)
- Prisma 5 (Postgres, AWS RDS eu-west-2)
- tRPC 11 (typed APIs)
- Vitest (tests)
- ESLint with boundary plugin (enforces MVC layer separation)

## Engineering discipline (NON-NEGOTIABLE)

Before doing ANY work, read these:

1. `docs/process/session-brief-template.md` — every change starts with a brief
2. `docs/process/security-baseline.md` — data protection rules
3. `docs/process/ratchet-discipline.md` — forward-only progress
4. `docs/process/reviewer-checklist.md` — what "done" means

## Layer boundaries (enforced by ESLint)

- `/app` (View) → may import from `/components`, `/shared`, `/server/routers` (types only), `/styles`
- `/components` → may import from `/components`, `/shared`, `/styles`
- `/server/routers` (Controller) → from `/server/services`, `/shared`, `/server/lib`
- `/server/services` (Model) → from `/server/db`, `/server/lib`, `/shared`
- `/server/db` → from `/shared` only

Violations are errors, not warnings. Don't bypass.

## What to do per session

1. Read this file (CLAUDE.md)
2. Read the relevant section of `docs/feature-spec/v0.5.docx`
3. Read relevant scenarios in `docs/product/scenarios.md`
4. Read the session brief (provided by user)
5. Build only what the brief specifies
6. Update README.md in directories you touch
7. Run `npm run typecheck && npm run lint && npm test` before declaring done

## What NOT to do

- Don't expand scope beyond the session brief
- Don't refactor outside the brief's "build" list
- Don't add `any` types or `@ts-ignore` (use proper types)
- Don't commit to main directly (always branch + PR)
- Don't change `prisma/schema.prisma` without an ADR (it's contract-locked)
- Don't add new features that aren't in the brief

## Open questions to surface

When a session reaches a decision that should belong to the user (naming,
business logic, design tradeoff), STOP and ask. Don't guess.

## Where to find things

- Feature spec: `docs/feature-spec/v0.5.docx` (canonical truth)
- All decisions made: `docs/architecture/decision-log.md`
- Ideas not yet built: `docs/product/parking-lot.md`
- User flow walkthroughs: `docs/product/scenarios.md`
- Design tokens: `styles/tokens.css`
- Design components: `styles/components.css`
- Working notes index: `docs/index.md`
- ADR template: `docs/adrs/0000-template.md`

## Current focus

Building the ERD. See `docs/architecture/erd.md` for placeholder context.
After ERD lands, the Ping placeholder entity in `prisma/schema.prisma`
will be removed and real entities defined.
