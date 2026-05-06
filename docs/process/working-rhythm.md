# Working rhythm

_The north-star summary of GPS Action's engineering discipline.
Read this once per session. Three full-detail docs sit underneath
for when you need depth: `ratchet-discipline.md`,
`session-hygiene.md`, `reviewer-checklist.md`._

_Version: 1.0 · 2026-04-26_

---

## TL;DR — three rules

1. **Forward-only.** Decisions, once made, stick. Code, once
   merged, doesn't get re-litigated. Scope, once set, holds.
2. **Session-bounded.** Every change starts with a brief. Every
   session ends in a known state. Hand off when context is full,
   don't push through.
3. **Done means done.** Tests, lint, types, manual flow, docs.
   Not "I'll finish tomorrow."

Everything below is detail on those three.

---

## 1 · Forward-only progress (the ratchet)

### Three ratchets, three scales

| Ratchet                | Scope                                                                   | Rule                                                                            |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Contract lock**      | ERD, API contract, permission matrix, state machines, security baseline | Read-only this phase. Changes require an ADR (D-NNN in `decision-log.md`).      |
| **Definition-of-done** | Every session, every feature                                            | Binary — checklist passes or it's not merged. No "almost done."                 |
| **Decision lock**      | Every product / engineering choice                                      | Once captured (ADR, parking-lot, brief), it sticks unless explicitly revisited. |

### What this looks like in practice

- **Schema change?** Append a new ADR. Don't quietly edit
  `prisma/schema.prisma`.
- **Contract change in `shared/validation/*`?** Same.
- **Need to revisit a settled decision?** Open it explicitly.
  Reference the prior ADR. Don't drift.
- **Tempted to refactor outside your brief?** Don't. Open a
  follow-up. Today's brief is today's brief.

### F-rules — the mechanical ratchet

The ESLint rules in `eslint-rules/` enforce the ratchet at write-
time. Eight rules:

- F06 rule 1: `require-build-unit-header` — every code file
  declares its BU
- F13: `require-spec-tag` — every BU file references a spec / ADR
- F14: `require-testid` — every interactive UI element is
  test-addressable
- F15: `require-design-tokens` — no hardcoded colours
- F06 rules 2–5: contract / PII / auth / flag discipline (see
  `eslint-rules/README.md`)

Plus the boundaries plugin (layer enforcement) and the trace
script (`pnpm trace:check` — D038 §6).

The rules are not suggestions. CI fails on violation. If a rule
is firing on legitimate code, the rule is wrong — open an ADR,
fix the rule. Don't disable.

For the full ratchet philosophy and the parking-lot / ADR
mechanics, see `ratchet-discipline.md`.

---

## 2 · Session hygiene

### Every change starts with a brief

The session brief template is `session-brief-template.md`. Fill
it in. Pin scope. Surface open questions. Then build.

**No brief, no build.** Exception: trivial changes — see "trivial
lane" below.

### Context budget

Long sessions degrade. Watch your context budget; at ~70% with
substantial work remaining, **stop and hand off** rather than
push through. The next hour's work in a tired session is worse
than the first hour in a fresh one.

### Commit per logical chunk

Never accumulate more than one reviewable unit of work
uncommitted. After each chunk: commit, push, proceed. This makes
abandonment cheap and recovery free.

### Hand off when needed

If a session ends mid-brief, write a handoff doc in
`docs/build/session-handoffs/` (template at the top of
`session-hygiene.md`). The next session reads the brief AND the
handoff.

### Surface, don't assume

When context is unclear, ask. Better one surfaced question than
ten silent assumptions. The sessions that go badly are the ones
where the agent guessed.

### The trivial lane

For genuinely tiny changes, skip the brief. Eligible if **all** of:

- Single file, ≤10 lines changed
- Bug fix, copy tweak, doc-only edit, or dependency bump
- No schema / API contract / breaking change
- No new feature; restoring or correcting existing behaviour
- Reviewer can verify the change in <2 minutes

For everything bigger — even ~30-line additions — write a brief.
Three minutes of brief saves an hour of mid-build confusion.

For the full session discipline (handoff template, anti-patterns,
context-budget warning signs), see `session-hygiene.md`.

---

## 3 · What "done" means (reviewer's perspective)

Before a session calls itself complete, **all** of the following
must be true:

### Functional

- [ ] Acceptance criteria from the brief: every box ticks
- [ ] Manual click-through of named scenarios completed in dev
- [ ] No half-implementations, no TODOs in committed code
- [ ] Open questions either resolved or surfaced explicitly in
      the PR

### Mechanical

- [ ] `pnpm typecheck` clean — zero errors, zero `any`, zero
      `@ts-ignore`
- [ ] `pnpm lint` clean — zero errors (warnings are OK if
      pre-existing)
- [ ] `pnpm test` all passing
- [ ] `pnpm exec prettier --check .` clean
- [ ] `pnpm trace:check` clean (D038 §6)

### Discipline

- [ ] Every new file carries `@build-unit` AND `@spec` headers
- [ ] Every new interactive UI element has a `data-testid`
- [ ] Schema change → ADR appended in same PR
- [ ] Behind a feature flag if D036 applies
- [ ] No PII in logs (per F06 rule 3)
- [ ] Layer boundaries respected (services don't import from
      app, etc.)

### Communication

- [ ] PR description summarises changes, links the brief, lists
      open questions surfaced
- [ ] Commit message follows convention (`feat:` / `fix:` /
      `chore:` / `docs:` / `chore(lint):` / etc.)
- [ ] Branch name follows convention (`phase-N/bu-name`,
      `chore/...`, `fix/...`, `docs/...`)
- [ ] READMEs in directories you touched are updated where the
      change affects what the directory does

For the full reviewer checklist with examples and the seven
disciplines in concrete detail, see `reviewer-checklist.md`.

---

## What is NOT in scope here

This north-star covers **engineering process**. Other disciplines
sit alongside it:

- **`design-philosophy.md`** — UI/UX feel (Sharon-warmth, no
  anxiety amplification, one-click is king). Read before any UI
  work.
- **`api-contract-discipline.md`** — the 10 tRPC + Zod rules.
  Read before touching `server/routers/`.
- **`security-baseline.md`** — data-protection rules. Read before
  features that touch sensitive data.
- **`testid-convention.md`** — F14's standard.
- **`design-tokens-convention.md`** — F15's standard.
- **`traceability.md`** — D038/D053's standard.

Each has a specific scope and lives in `docs/process/` or
`docs/product/`. Read the relevant one when you touch its area.
This north-star is for the cross-cutting "how to work" rules.

---

## When to update this doc

When the discipline genuinely shifts — new ratchet, retired
rule, changed default behaviour. Routine updates to the deep
docs (`ratchet-discipline.md`, etc.) don't require this summary
to change unless the headline changes too.

Keep it short. If this doc grows past ~250 lines, something has
shifted from summary to deep — move that section to its own
doc.

---

## Related

- `ratchet-discipline.md` — the full ratchet philosophy
- `session-hygiene.md` — the full session-management discipline
- `reviewer-checklist.md` — the full "what done means"
- `session-brief-template.md` — the brief template
- `CLAUDE.md` — points here as mandatory pre-reading
