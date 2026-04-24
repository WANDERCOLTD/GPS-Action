# Session hygiene

**Purpose:** Tell Claude Code (and future humans running sessions) how to
manage context, checkpoint progress, hand off between sessions, and
recognise when a session is getting too big.

**Status:** Process discipline. Referenced from `CLAUDE.md` and the
`session-brief-template.md`.
**Related:** `docs/process/session-brief-template.md` (brief sizing),
`docs/process/reviewer-checklist.md` (reviewing output),
`docs/process/change-absorption-guide.md` (how feedback lands).

---

## Why this exists

Claude Code sessions have a context window. As a session grows — more
files read, more code generated, more back-and-forth — the window fills.
Three failure modes appear:

1. **Forgetting the brief.** The brief's constraints get "aged out" of
   active attention when the window fills with generated code.
2. **Forgetting earlier decisions in the session.** Open questions you
   answered at hour 1 get de-prioritised when Claude Code is making a
   late decision at hour 3.
3. **Quality degradation.** Long sessions get "foggy" — details slip,
   edge cases get missed, conventions drift.

This document describes the discipline that prevents these failure modes
from harming the codebase.

---

## Four principles

### 1. Commit as you go

**Never accumulate more than one logical chunk of uncommitted work.**

In a typical session, the right chunks are:

- Schema model + its tests + its metadata (one commit)
- A router + its procedures + its tests (one commit)
- A rule + its test file (one commit, per rule, for something like F06)
- A UI component + its Storybook story (one commit)

Commit after each chunk completes and passes local validation. This gives:

- A natural undo point if the next chunk goes wrong
- A clean history to review after the session
- A safety net if context runs out mid-session

What **not** to do: "work for 3 hours, commit everything at the end in
one giant commit." If the session fails partway, you lose everything and
can't cleanly continue in a new session.

### 2. Watch the context window

**Claude Code should proactively monitor its own context usage.**

Signs the window is getting tight:

- Responses start getting shorter for the same kind of task
- Earlier decisions are re-asked or contradicted
- Claude Code starts re-reading files it already read
- The internal "todo list" starts feeling stale

At **approximately 70% context usage AND substantial work remaining**,
the right action is: **stop, checkpoint, and hand off**. Don't push
through — the quality of the next hour's work will be worse than a fresh
session's first hour.

### 3. Produce a handoff doc when stopping mid-brief

If a session ends before the brief's Definition of Done is complete,
produce a handoff doc. The next session reads it and picks up.

The handoff doc goes in `docs/build/session-handoffs/` with a filename
like `YYYY-MM-DD-brief-name-handoff.md`. It answers four questions:

1. **What was done?** Specific — "rules 1, 2, 3 complete; rule 4
   partial; rules 5 not started."
2. **What remains?** From the brief's scope, what's unfinished.
3. **What decisions were made?** Open questions answered + any
   judgement calls.
4. **What files changed / were added?** List them so the next session
   knows the state.

Template below.

### 4. Fresh session = new context, old brief

When continuing from a handoff:

```
Read docs/build/session-briefs/<brief>.md and
docs/build/session-handoffs/<handoff>.md.
Continue from where the handoff ends.
```

The new session reads the brief fresh, reads the handoff, and continues.
**Do not try to remember** context from a previous session — rely on what's
written in the handoff.

---

## The handoff doc template

```markdown
# HANDOFF · [Brief name]

**Session:** YYYY-MM-DD
**Previous session:** [link to the previous handoff if chain continues]
**Next session:** [to be filled in when next session runs]
**Status:** in_progress | blocked | waiting_for_user

## What was done

Specific. Per brief acceptance criterion if possible.

- [x] Rule 1: require-build-unit-header — complete, tests passing
- [x] Rule 2: no-trpc-any — complete, tests passing
- [x] Rule 3: no-pii-in-logs — complete, tests passing
- [ ] Rule 4: no-inline-auth-check — implementation done, 2 tests
      failing, see "Known issues" below
- [ ] Rule 5: feature-must-have-flag — not started

## What remains

From the brief's scope:

- Fix 2 failing tests in rule 4
- Implement rule 5 + tests
- Write eslint-rules/README.md
- Final validation pipeline

## Decisions made

- **Q1 (plugin name):** Confirmed `eslint-plugin-local-rules`
- **Q2 (severity):** All rules at `error`
- **Q3 (auto-fix):** None, per brief
- **Q4 (PII extensibility):** Hardcoded sets for now

## Files changed / added

- `eslint-rules/` (new directory)
- `eslint-rules/package.json` (new)
- `eslint-rules/index.js` (new — will need updating when rules 4, 5 land)
- `eslint-rules/rules/require-build-unit-header.js` (new)
- `eslint-rules/rules/no-trpc-any.js` (new)
- `eslint-rules/rules/no-pii-in-logs.js` (new)
- `eslint-rules/rules/no-inline-auth-check.js` (new, incomplete)
- `eslint-rules/tests/require-build-unit-header.test.js` (new)
- `eslint-rules/tests/no-trpc-any.test.js` (new)
- `eslint-rules/tests/no-pii-in-logs.test.js` (new)
- `eslint-rules/tests/no-inline-auth-check.test.js` (new, 2 failing)

Git status: committed through rule 3; working tree has rule 4
work-in-progress.

Branch: phase-0/f06-eslint-rules (not yet pushed)

## Known issues

Rule 4's "chain has use" detection fails on two edge cases:

1. `.use(authMiddleware).use(requireRole(...))` — double-middleware chain
2. `.input(schema).use(...).mutation(...)` — middleware between input
   and mutation

The AST traversal in `chainHasUse()` needs to walk past `input` and
handle stacked `use` calls. See TODO in
`eslint-rules/rules/no-inline-auth-check.js` line 42.

## Next session prompt

Start with:
```

Read docs/build/session-briefs/f06-eslint-rules.md and
docs/build/session-handoffs/2026-04-24-f06-eslint-rules-handoff.md.
Continue from where the handoff ends — fix the failing tests in rule 4,
then implement rule 5, then write the README and do final validation.

```

```

---

## When to checkpoint and when to push through

**Checkpoint (stop + handoff) when:**

- Context is ≥70% full AND substantial work remains
- A natural "chunk boundary" has been reached (entity + tests + metadata
  all complete)
- Claude Code is about to do a risky or irreversible operation (major
  refactor, schema migration)
- It's been more than 2 hours of continuous work
- The human user signals fatigue or confusion

**Push through when:**

- <50% of context used, clear path to done
- A single tightly-coupled chunk isn't cleanly splittable (e.g., "add
  entity + its migration + its seed + its test in one go")
- The brief explicitly says "complete in one session"
- Quality is still clearly high

**Explicit override:** If the human says "keep going, I have capacity,"
Claude Code proceeds but surfaces context usage every hour.

---

## Brief-ahead cadence — keep the buffer full

**The pattern:** the brief-writer (assistant, operating in chat) stays
1-2 briefs ahead of what Claude Code is executing. Never zero; never
more than 2-3.

### Why 1-2 ahead

- **The assistant is the slower producer**, not Claude Code. Writing
  a good brief takes longer than executing one. If Claude Code ever
  sits idle waiting for the next brief, that's wasted capacity.
- **Adjacent briefs inform each other.** Writing BU-001-lite and
  BU-feed in the same thinking session catches consistency issues
  (shared auth context, audit service contract, naming conventions)
  that would be harder to catch later.
- **Each execution teaches the next.** Writing too far ahead means
  later briefs can't benefit from lessons in earlier executions.
- **It creates a clear signal.** When the buffer is empty, the brief-
  writer is behind. When it's 3+ deep, time is being wasted on
  speculation.

### The operational rhythm

1. **Paul runs Claude Code on brief N.**
2. **In parallel, assistant writes brief N+1 (to v1.0) and brief N+2
   (to v0.9 draft).** N+2 draft captures scope and gotchas without
   nailing every detail — that's deferred until after N executes.
3. **Brief N completes and merges.**
4. **Paul pastes execution results to assistant.**
5. **Assistant refines N+2 to v1.0** based on learnings, and starts
   v0.9 draft of N+3.
6. **Paul runs brief N+1 in Claude Code.**
7. **Cycle continues.**

### What makes a good v0.9 draft

A v0.9 draft of a brief has:

- **Objective, Scope, Out-of-scope** — fully written; these rarely
  change
- **Contracts (inputs / outputs)** — clear enough to understand what
  the session produces
- **Acceptance criteria** — the "will tighten" ones; major ones in,
  edge cases may be added
- **Known gotchas** — as many as can be anticipated
- **Open questions** — pre-identified; more likely to be added during
  refinement
- **Context** — listed
- **An explicit v0.9 marker** at the top, noting what will be
  refined at v1.0 and when

### What "refinement to v1.0" means

When the previous brief executes, assistant:

1. Reads Claude Code's final summary carefully
2. Identifies anything that surprised: new open questions surfaced,
   patterns that worked well, conventions established
3. Updates the v0.9 draft with those learnings — not rewriting,
   tightening
4. Marks as v1.0
5. Ships to Paul for placement + commit

Refinement is usually small — often 30-40% changes to an existing
v0.9. It's faster than writing from scratch but slower than just
using the v0.9 as-is.

### When NOT to maintain a v0.9 buffer

- **When the next brief is trivial.** A 100-line brief may not benefit
  from 2-stage drafting. Just write it.
- **When pivots are likely.** If Paul indicates that priorities may
  change soon, don't write 3 briefs ahead that might be thrown away.
- **When Paul is at a natural stopping point.** Writing brief N+2 when
  Paul is about to sleep for the night is fine to defer — morning
  clarity may change the brief's shape.

### The anti-pattern: writing all briefs upfront

Sometimes it's tempting to just write all 5 remaining briefs in one
go. Don't. Each execution teaches something that improves the next
brief. Writing all 5 upfront loses that compounding value and
produces worse briefs 3-5.

### Visible-state tracking

The buffer state should be visible. At any point, Paul or assistant
can ask:

- **"What's the buffer state?"** — how many briefs ahead is the
  assistant? v1.0 or v0.9? What's next in queue?

An honest answer keeps the rhythm stable. If assistant has only v0.9
ahead, that's a signal to prioritise refinement. If assistant has v1.0

- v1.0 + v0.9, that's a healthy buffer.

---

## Session size anti-patterns

From accumulated experience. Flag these when spotted:

### The sprawling session

**Symptom:** "Build the admin surface" — scope undefined, could be 3
days of work. **Fix:** Split into specific Build Units (BU-001a = generic
entity list page; BU-001b = queue UI; etc.).

### The chained dependency session

**Symptom:** "Add Posts, and while you're there, add Comments,
Reactions, and fix the dispatch flow." **Fix:** Posts is one slice.
Comments/Reactions is another. Don't chain.

### The "while you're in there" addition

**Symptom:** Mid-session, the user or Claude Code says "oh, and also can
we fix X?" **Fix:** Capture X as a follow-up in the handoff or a
separate issue. Do not expand scope mid-session.

### The partial refactor

**Symptom:** Session starts refactoring something that the brief didn't
sanction, because "it's cleaner." **Fix:** Refactors are their own
brief. They need explicit scope, review, and rollback plan.

### The unbounded "investigation"

**Symptom:** "Look into why the tests are slow" — could be 10 min or 3
days. **Fix:** Time-box investigations. 30-min spike → write up findings
→ decide if a real session is needed.

---

## What this means for brief authors

When writing a session brief (per `session-brief-template.md`), ask:

1. **Can this be done in under 2 hours of Claude Code time?** If yes,
   one brief. If no, split.
2. **Are the "Build" files listed explicitly?** If Claude Code can't
   enumerate them, the scope is too vague.
3. **Is there a natural checkpoint partway through?** If yes, the brief
   can note "after X is complete, commit; continue with Y."
4. **What's the minimum viable completion?** If context runs out, what
   subset still ships?

These questions prevent the sprawling-session anti-pattern at the brief
stage.

---

## What this means for reviewers

When reviewing Claude Code output (per `reviewer-checklist.md`):

1. **Check the handoff doc (if one exists).** Understand what the
   session knows vs doesn't know.
2. **Verify commits are at natural chunk boundaries.** One giant commit
   at the end is a smell.
3. **Watch for context-degradation signs:** later code of lower quality
   than earlier code; forgotten conventions; repeated decisions.
4. **Don't accept "I'll clean that up later" as an output.** Either
   it's clean in this session or it's a follow-up brief.

---

## What this doc does NOT cover

(Naming gaps explicitly.)

1. **Specific context-usage monitoring commands** — Claude Code's
   actual context tracking is internal; this doc gives heuristics for
   recognising the signs.
2. **Multi-agent coordination** — if multiple Claude Code instances
   work in parallel, coordination is a separate problem. Out of scope.
3. **Error-recovery protocols** — what to do when a session crashes
   mid-task. Usually: restart with handoff discipline.
4. **Token-budget enforcement** — no hard caps; the discipline is
   principle-based.
5. **Credit/cost management** — how much a session "costs" in API
   terms. Out of scope here; operational concern.

---

## What lands in practice

**MVP day 1:**

- This document exists
- CLAUDE.md references it
- `session-brief-template.md` references it
- `reviewer-checklist.md` references it
- `docs/build/session-handoffs/` directory exists (may be empty until
  first mid-session checkpoint)

**Over time (no explicit action needed):**

- Handoff docs accumulate in `docs/build/session-handoffs/` as long
  sessions span multiple runs
- The template evolves based on what handoff patterns actually emerge

**Never:**

- Enforce via tooling (this is process, not code)
- Punish human-directed "push through" decisions
- Treat as a ceiling; it's a floor of good practice
