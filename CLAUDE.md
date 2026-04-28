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

1. `docs/process/working-rhythm.md` — the north-star summary of
   forward-only progress + session hygiene + what "done" means.
   Subsumes the mandatory bits of ratchet-discipline.md,
   session-hygiene.md, and reviewer-checklist.md.
2. `docs/process/session-brief-template.md` — every change starts with a brief
3. `docs/process/security-baseline.md` — data protection rules

The deep-detail docs (`ratchet-discipline.md`, `session-hygiene.md`,
`reviewer-checklist.md`) sit underneath `working-rhythm.md` and are
consulted on demand, not pre-loaded every session.

## Session hygiene

Long Claude Code sessions hit context limits. Before that happens, the
discipline is:

- **Worktree per session — MANDATORY for any session that will edit
  files.** Parallel CC sessions sharing the root checkout cause branch
  clashes: when one session runs `git checkout`, the other session's
  HEAD silently moves and its next write lands on the wrong branch.
  This rule is non-negotiable — do not edit from
  `/Users/paulwander/projects/gps-action` directly.

  Before the first edit, isolate:
  1. `git fetch origin && git worktree add .claude/worktrees/<slug> -b <branch> origin/main`
     - `<slug>`: short kebab-case name for the worktree dir (e.g. `feed-filter`)
     - `<branch>`: `<type>/<task-slug>-<YYYYMMDD>` (e.g.
       `feat/feed-filter-20260428`). The date suffix prevents two
       parallel sessions colliding on the same branch name.
  2. `cd .claude/worktrees/<slug>` and run **all** subsequent commands
     from there — including `npm install` if needed (each worktree has
     its own `node_modules`).
  3. Verify in one call:
     `git branch --show-current && git rev-parse --show-toplevel`
     — confirm both the branch name and that the path ends in
     `.claude/worktrees/<slug>`.

  Read-only sessions (Q&A, code reading, doc lookup with zero writes)
  skip the worktree. The moment a read-only session needs to edit,
  stop and create the worktree before the first write.

  Cleanup after PR merges: `git worktree remove .claude/worktrees/<slug>`
  then `git branch -d <branch>`. `.claude/worktrees/` is gitignored.

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
- **Verify branch after every git op** — run `git branch --show-current`
  after checkout / switch / stash / stash pop / reset / merge / rebase /
  pull / branch / worktree-create. Combine into the same Bash call where
  possible (`git checkout X && git branch --show-current`).

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
8. **If shipping a named BU:** flip `status: shipped` and add `shipped_in:
"#<PR>"` to its front-matter in `docs/build/session-briefs/<slug>.md`.
   Run `npm run trackers` to refresh the AUTOGEN regions in
   `bu-sequence.md`. CI blocks merge otherwise. (Per D068.)

## What NOT to do

- Don't expand scope beyond the session brief
- Don't refactor outside the brief's "build" list
- Don't add `any` types or `@ts-ignore` (use proper types)
- Don't commit to main directly (always branch + PR)
- Don't change `prisma/schema.prisma` without an ADR (it's contract-locked)
- Don't add new features that aren't in the brief
- Don't open a PR without bumping `package.json` `version` — every PR
  bumps PATCH at minimum (CI blocks merge otherwise). See
  `docs/process/versioning.md` for the scheme.
- Don't add code that depends on a row by static slug/id without
  shipping an idempotent data migration that inserts it. Reference
  data lives in `prisma/migrations/`, not in `scripts/seed.ts`. CI
  fails the merge if any `REQUIRED_POST_KIND_SLUGS` row is missing
  after `prisma migrate deploy`. See D070.

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

## BU naming convention (per D051)

Use **semantic names** for Build Units, not numbers. Format:
`BU-<short-noun>` — lowercase, hyphenated. Examples:
`BU-comments`, `BU-dispatch`, `BU-vetting`, `BU-admin`.

Only `BU-001-lite` keeps a number — it's the historical reference
to the shipped dev-auth stub. Everything else is named.

The full canonical mapping (old number → new name) lives in
`docs/architecture/decision-log.md` (D051). When you see a numbered
BU reference in any doc, consult D051 to translate it.

## Current focus

**Phase 2 underway.** Phase 1 demo path shipped; Phase 2 has shipped
steadily through April 2026 — Reactions, Comments, Reactions-on-
comments, Link share, Requests foundation + Urgent, FAB intent picker,
Admin CRUD + audit + bulk-ops, Vetting Phase 1, AM-link collapse,
Hero images, Versioning, Sticky nav, WhatsApp share. F14 testid rule
is now enforced. See `docs/build/bu-sequence.md` for the canonical
ship list.

**In flight:** BU-feed-filter (`feat/feed-filter-and-search`) — chip
strip replaces the `<h1>Feed</h1>` on `/feed`. URL-driven, single-
active. Five chips: All · ⚡ Urgent · Happening now · Meetings · Events.

**Next BU candidates (unshipped briefs):**

- BU-search-surface — app-wide member search overlay (magnifier in
  `AppNav` → full-screen `/search`). Pre-build decisions still open.
  Research at `docs/product/research/search-surfaces.md`. Brief stub
  at `docs/build/session-briefs/bu-search-surface.md`.

User decision needed before starting any new BU. The wider Phase 2/3
queue lives in `bu-sequence.md`; parking-lot has product candidates
not yet briefed.

## Dev auth (BU-001-lite)

In development, visit `/dev/login` to switch between seeded users.
Cookie-based, no passwords. The cookie `gps_dev_user_id` persists
until cleared. `<LoggedInAs />` in the root layout shows who's
logged in. All dev-only code is gated by `NODE_ENV !== 'production'`.

## Post composer (BU-composer / BU-am-link-collapse)

Visit `/compose` to create a new post. Requires authentication —
unauthenticated users are redirected to `/dev/login`. The form has
3 core fields: title, body, visibility (public / logged-in only),
plus an optional link-share section. Activist-Mailer URLs are no
longer a dedicated field — paste any link, and the preview card
auto-detects AM domains (per `ACTIVIST_MAILER_ALLOWED_DOMAINS`
env list) and renders a "Send email →" call-to-action. On submit,
the post appears at the top of `/feed`.

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

## Random Thought Log (RT)

A lightweight capture-and-investigate stream for product/UX/engineering thoughts as they occur. File: `docs/random-thoughts.md`. Format spec lives in that file.

### Trigger: user message starts with `RT:`

When the user's message begins with `RT:` (case-sensitive, followed by space), do this without further confirmation:

1. **Allocate ID.** Read `docs/random-thoughts.md`, find the highest existing `RT-NNN`, increment by 1. First entry is `RT-001`.
2. **Append entry.** Add a new entry under `## Entries` using the template at the top of `random-thoughts.md`. Strip the `RT: ` prefix from the user's message; the rest is the verbatim thought. Update the `## Index` block.
3. **Commit direct to `main`.** This file is the documented exception to branch-and-PR discipline — it's a personal thought stream, not engineering code. Commit message: `docs(rt): RT-NNN — <first 50 chars of thought>`. Push.
4. **Spawn background investigation agent.** Use the `Agent` tool with `run_in_background: true` and the prompt template below.
5. **Tell the user one line.** "RT-NNN logged. Investigation agent running in the background." Continue with whatever the user was doing before.

### Investigation agent prompt template

```
Investigate Random Thought RT-NNN in the GPS Action codebase. The thought is:

> <verbatim thought>

Read these to ground your investigation:
- docs/product/scenarios.md (existing UX scenarios)
- docs/architecture/decision-log.md (ADRs)
- docs/product/parking-lot.md (parked ideas)
- docs/build/engineering-roadmap.md (engineering candidates)
- The relevant code surface for the thought (use grep/Glob)

Append your findings to the RT-NNN entry in `docs/random-thoughts.md` under the `### Agent investigation` heading, using exactly the format the file's "Entry format" section specifies:

1. Clarifying questions (2–4 sharp questions only — what would change the implementation if answered differently)
2. Overlap with existing work (cite SCN-N, D-NNN, parking-lot section, or roadmap row if relevant; "none" is a valid answer)
3. Implementation sketch (3–6 bullets at the level of "what would change in which file")
4. Promotion suggestion (parking-lot | scenario | brief | reject) + a one-line reason

Then update the entry's **Status** line to `investigated · <today's date YYYY-MM-DD>`.

Commit your changes direct to main: `docs(rt): RT-NNN agent investigation`. Push.

Keep the entire investigation under 60 lines. This is a thought log, not a brief — be terse.
```

### Trigger: user message starts with `RT-promote: RT-NNN`

When the user types `RT-promote: RT-NNN <optional destination hint>`:

1. Read RT-NNN's entry. Look at its `Promotion suggestion`.
2. Execute the promotion:
   - **parking-lot** → append a section to `docs/product/parking-lot.md` (use existing format conventions there)
   - **scenario** → draft a new scenario in `docs/product/scenarios.md` (next SCN-NN), with the `<!-- @no-code-yet -->` marker
   - **brief** → create a session brief stub in `docs/build/session-briefs/`
   - **reject** → just flip the status (no destination)
3. Update RT-NNN's `**Status:**` to `promoted to <destination ID> · YYYY-MM-DD`.
4. Commit direct to main: `docs(rt): promote RT-NNN → <destination>`. Push.

### Trigger: user message starts with `RT-reject: RT-NNN`

Flip RT-NNN's status to `rejected · YYYY-MM-DD — <reason>`. Commit + push direct to main. One-line acknowledgement to user.
