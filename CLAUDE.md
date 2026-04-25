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
5. `docs/process/session-hygiene.md` — context management and handoff discipline for long sessions

## Session hygiene

Long Claude Code sessions hit context limits. Before that happens, the
discipline is:

- **Commit per logical chunk** — never accumulate more than one
  reviewable unit of work uncommitted. After each chunk: commit, push,
  proceed.
- **Watch context usage** — at ~70% full with substantial work
  remaining, stop and hand off rather than push through. The next hour's
  work in a tired session is worse than the first hour in a fresh one.
- **Hand off via written doc** — if a session ends mid-brief, write a
  handoff doc in `docs/build/session-handoffs/` so the next session can
  continue. The next session reads the brief AND the handoff.
- **Surface, don't assume** — when context is unclear, ask. Better one
  surfaced question than ten silent assumptions.

See `docs/process/session-hygiene.md` for the full discipline, the
handoff doc template, and anti-patterns to avoid.

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

Demo path — see `docs/build/bu-sequence.md`. ERD Slices 1, 1.5, 2
(minimal) are merged. BU-001-lite (dev auth stub) is next.

## Dev auth (BU-001-lite)

In development, visit `/dev/login` to switch between seeded users.
Cookie-based, no passwords. The cookie `gps_dev_user_id` persists
until cleared. `<LoggedInAs />` in the root layout shows who's
logged in. All dev-only code is gated by `NODE_ENV !== 'production'`.

## Post composer (BU-composer)

Visit `/compose` to create a new post. Requires authentication —
unauthenticated users are redirected to `/dev/login`. The form has
4 fields: title, body, optional Activist Mailer URL, and visibility
(public / logged-in only). On submit, the post appears at the top
of `/feed`.

---

## CRITICAL: Recent context not yet absorbed into Feature Spec v0.5

Several important decisions were made in conversation but Feature Spec is still v0.5.
The spec will be updated to v0.6 in a future session. Until then, **read these explicitly
before any work touching their areas**:

### Mandatory reading before relevant work

- **Before any Post-related work** → read `docs/product/parking-lot.md` sections:
  - "1-click social sharing — CRITICAL FEATURE" (will be §3.31 in v0.6)
  - "Boost / Remove — clarification" (simplifies §3.22)
  - "Identity & affiliation ideas" → Partner Organisations (will be §3.30)

- **Before any UI work** → read parking-lot section "Naming exploration"
  - Member-facing copy uses specific verbs not generic "Take action"
  - "Steward" is being tested as alternative to "Coordinator"

- **Before any dispatch/routing work** → read parking-lot:
  - Self-dispatch is the default (D013 in decision log)
  - Boost/Remove is just a post + verdict to a WhatsApp channel (D017)

- **Before any sharing/inbound work** → read parking-lot:
  - Inbound sharing endpoint (D018) — `/share?url=...` foundation
  - Bookmarklet for MVP, native share sheet for Phase 2

### What "v0.6 absorbing" means

Items marked **ABSORBING (v0.6)** in the parking lot are agreed-direction features
that will land in the next spec update. Treat them as confirmed for build, not as
"maybe." If a session needs to build something that depends on them, build assuming
they're real.

Items marked **PARKED** are not yet decided. If a session needs one of these to
build the requested work, STOP and surface the question to the user.

### Voice and tone notes (carry through all UI copy)

- **Sharon-warmth:** Community moments use warm, casual register (💕🤗 acceptable here)
- **No anxiety amplification:** Avoid endless-scroll patterns, "always-on urgency" framing.
  Members should feel "permission to close" the app after acting.
- **Cultural moments are quiet:** Shabbat / remembrance posts use bordeaux (#6B3045)
  cultural-marker colour. Quieter, dignified treatment, not urgent-action styling.
- **Honest copy:** Don't say "We've sent your email!" if we just opened the user's
  mail client. Say "Opening your mail client..." Honesty matters.
- **Plain English:** No jargon. "Send" not "Dispatch." "Share" not "Amplify."
  (Internal data terms are fine — `verdict: boost` is data, "Amplify this" is the button.)

## Foundation docs (read before relevant work)

- **Before any UI work** → `docs/product/design-philosophy.md` (the 5 principles, priority order)
- **Before any router/API work** → `docs/process/api-contract-discipline.md` (10 rules + reviewer checklist)
- **Before any feature instrumentation** → `docs/product/analytics-events.md` (16 events, PII policy)
- **Before any feature behind a flag** → D036 in decision log + `docs/product/feature-flag-register.md`
- **Before creating or touching a Build Unit** → D038 + D039 in decision log

## Build discipline

- **Before Build Unit #1 starts** → Phase 0 (`docs/build/phase-0-foundations.md`) must be complete
- **Fortnightly engineering review** → walk `docs/build/engineering-roadmap.md`, update triggers, log adopted items
- **New engineering idea surfaces in chat?** → log to engineering-roadmap.md within 48 hours or it dies
