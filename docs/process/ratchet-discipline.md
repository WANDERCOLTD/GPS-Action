# GPS Action — Ratchet Discipline

*The process rules that keep the build moving forward instead of looping backward. Ensures work accumulates, doesn't dissolve.*

*Version: 0.1 · April 2026*

---

## Why a ratchet

Software projects drift. Without deliberate forward-motion, every week produces:
- Revisited decisions that were settled
- Work that needs rebuilding because it was never quite finished
- Features that nobody uses because the user changed their mind
- Refactors that never end
- "We need to redo X before we can ship Y"

The ratchet prevents this. Like a physical ratchet, it allows forward motion and resists backward slippage. Applied to software:

- Decisions, once made, stick unless explicitly revisited
- Work, once merged, is complete unless explicitly revised
- Scope, once set, holds unless explicitly expanded through the proper channel
- Quality gates, once defined, are non-negotiable

None of this is bureaucracy. All of it is explicitness about what's changing and why. Without the ratchet, every conversation reopens every prior decision. With the ratchet, conversations focus forward.

---

## The three ratchets

Three mechanisms at three scales.

### Ratchet 1 · The contract lock

**Scope:** architectural artefacts (ERD, API contract, permission matrix, state machines, security baseline).

**Rule:** once signed off, these are read-only for the duration of the phase. Changes require an Architecture Decision Record (ADR) that documents:

- What's changing
- Why
- What's affected
- What sessions need to be re-briefed
- What migrations are needed

ADRs are lightweight (half a page usually). But they force the change to be *proposed* and *reviewed* before landing, not sneaked in by a session.

**Why:** parallel sessions depend on stable contracts. A contract change mid-phase breaks sessions in flight. Forcing an ADR makes the break visible and approved.

**How to enforce:**
- Git-protect the contract files. Changes require PR with ADR reference.
- Reviewer checklist includes "Did this change any contract file? If yes, where's the ADR?"
- Versioned — every contract carries a version, every consumer references a specific version.

### Ratchet 2 · Definition-of-done

**Scope:** every session, every feature.

**Rule:** a session isn't done until its checklist passes. No "I'll finish tomorrow" merges. Work is binary: complete or not.

**Why:** half-finished work is a slower poison than no work at all. It looks like progress while actually blocking progress — the next session builds against incomplete contracts and breaks.

**How to enforce:**
- Session Brief Template includes Definition-of-done as a section
- Reviewer Checklist is the final gate
- CI enforces the automatable parts (tests pass, types compile, lint clean)
- Manual checks (scenarios click-through, README updated) visible in PR description

**What counts as "done":**
- All files in brief's "Build" list created or modified
- All "Do NOT touch" files unchanged
- Zero TypeScript errors, zero ESLint errors
- All tests pass
- All acceptance criteria from brief verified
- Scenarios click-through completed
- READMEs updated
- PR description summarises changes

**What doesn't:**
- "It basically works"
- "The happy path is done, edge cases later"
- "Tests are coming in a follow-up"
- "I'll fix the TypeScript errors when I get back"

### Ratchet 3 · Weekly consolidation

**Scope:** the whole project, weekly.

**Rule:** once a week, a status document updates. What moved. What's blocked. What shipped. What's not yet started.

This produces the forward-only view. Stalled work is named. Completed work is acknowledged. Nothing lingers.

**Format (weekly):**

```markdown
## Week of [date]

### Shipped
- [Feature] — merged [date]. Session brief #N.
- [Feature] — merged [date]. Session brief #N.

### In progress
- [Feature] — session started [date]. ETA [date]. Blocked on [what].

### Blocked
- [Feature] — blocked on [what]. Owner [who]. Target unblock [when].

### Not yet started
- [Feature] — scheduled for [week].

### ADRs this week
- ADR-0001: [decision]
- ADR-0002: [decision]

### Parking lot review
- 3 items moved from PARKED to ABSORBING for next phase
- 2 items moved from PARKED to DECLINED

### Lessons
- [what we learned; what changes in the process]
```

**Why:** makes blockers visible immediately. Prevents the "I thought someone else was doing that" failure mode. Gives the team a rhythm.

**How to enforce:**
- Every Friday (or consistent day), status document updates
- 15-minute review of the doc
- Anything stalled for 2 weeks = explicit decision: continue, de-scope, or abandon
- No "it's been stuck for a month" discoveries

---

## Scope change management

Scope changes are the most common source of drift. Handle them explicitly.

### Types of scope change

**Mid-session discovery** (session in progress, realises it needs something not in the brief):
- Session surfaces the question in "Open questions" section of its output
- Human decides: absorb into session (new brief), defer to next session (parking lot), or decline
- Session doesn't just build it — never

**Mid-phase request** (something arose, want it in this version):
- Document the request, evaluate against phase goals
- If critical: new session brief, plan when it slots in
- If non-critical: park for next phase
- Never accept "just this one thing, in addition" — it cascades

**End-of-phase request** (add X before shipping):
- Default: no. Phase closes, ship what's done, next phase considers
- Exception: critical security or legal issue

**Your pattern from earlier in the conversation** — mid-stream ideas while thinking about roles — is a specific case of this. The scenarios library + parking lot + ADR discipline handle it:

- Ideas land in parking lot (not ignored, captured)
- Significant architectural ideas get an ADR proposed (debated, decided)
- Minor ideas absorbed in next version
- Nothing disrupts work in flight

---

## Decision finality

### Rules

- **A decision, once made, stands until explicitly revisited.**
- **Revisiting requires reason:** new information, new constraint, demonstrated problem. Not "I'm not sure anymore."
- **Decisions logged** in the decision log (separate document).
- **Major decisions have ADRs** — the reasoning preserved for future-selves.

**Why:** re-litigating decisions is the biggest time sink in software projects. Whether we use Postgres or MongoDB. Whether comments are nested or flat. Whether the accent colour is blue. Each revisit costs energy.

**Counter-indication:** don't confuse "sticking to decisions" with stubbornness. If a decision is genuinely wrong, revisit — with evidence, proposing an alternative, understanding the cost of change.

### Decision hierarchy

Not all decisions are equal. Three tiers:

**Tier A: Foundation**
Examples: stack choice, database, auth model, hosting region.

- Can only be changed via formal ADR
- Requires director sign-off
- Changes are expensive; avoid

**Tier B: Architecture**
Examples: permission model, audit structure, routing engine design.

- ADR recommended but not required
- Changes cascade; cost is real
- Revisit at phase boundaries

**Tier C: Feature-level**
Examples: specific feature behaviour, UI copy, card design.

- Casual decisions
- Can change without ceremony
- Version bump if externally visible

---

## The "no half-merged work" rule

Main branch is always in a working state.

- Feature work happens on branches
- Branches merge only when complete
- Incomplete work stays on branch indefinitely or is abandoned explicitly

**What this prevents:**
- "Oh, that's WIP, don't test that path yet"
- "The main branch is broken because we haven't finished X"
- Legacy half-features that nobody wants to finish or remove

**How to enforce:**
- CI runs on main and blocks merge if broken
- PR reviews reject incomplete work
- Weekly status review identifies stuck branches
- 30-day-old unmerged branches get a decision: merge, finish, or close

---

## The "kill criteria" rule

For every major feature, define up-front: when do we cut this rather than fix it?

**Example for Dispatch Queue:**
- If pilot users don't dispatch at least 20 posts total in the first 2 weeks, reconsider the feature
- If the self-dispatch success rate is <50% (users bail before WhatsApp round-trip), redesign
- If dispatchers spend more than 30 min/day dealing with queue backlog, something's broken

**Why this matters:**
- Features that don't work often live forever because "we spent time on them"
- Sunk-cost fallacy. Having kill criteria makes "cut it" intellectually easier
- Protects you from accumulating features that exist but don't serve users

**The rule:**
- Every feature's brief includes "kill criteria — what would make us remove this?"
- Measured against in pilot
- If criteria hit, explicit decision: remove, redesign, or accept the failure mode

---

## The "nothing new" week

Halfway through the build, schedule one week where:
- No new features land
- Only: bug fixes, polish, documentation, tests, accessibility improvements
- Explicit in the build plan, not optional

**Why:** tech debt accumulates silently. A dedicated cleanup week prevents compounding. Teams that skip this always regret it.

**What to do with the week:**
- Review Parking Lot — park more items decisively, clear stale entries
- Walk the Reviewer Checklist across recent features — find drift
- Update documentation that fell behind
- Add missing tests for critical paths
- Fix "small" bugs that have been ignored
- Refactor one small thing that's been annoying

---

## Anti-patterns to watch for

Things that break the ratchet:

### "Quick fix" that touches five files

"I'll just tweak this here and here and here..." — that's a scope creep, not a quick fix. If five files need changing, brief a proper session.

### "While I'm in there..."

A session in one file notices improvements in an adjacent file. Tempting. Don't. File that under parking lot, keep this session scoped.

### "We can fix it later"

"Later" is a lie. Fix it now or decide explicitly you won't. Don't leave weak commitments floating.

### "Let me rebuild this"

Rebuilds are own sessions. Schedule them. Don't smuggle them into feature work.

### "Good enough for pilot"

Useful sometimes. Dangerous if it becomes habit. Every "good enough" should be logged as tech debt with a when-to-revisit.

### "The team knows what I mean"

Often they don't. Write it down. Verbal decisions dissolve.

### "Let's just try it"

Experiments are fine. But an experiment that lands in main branch as a feature is not an experiment — it's a decision. Decide explicitly.

---

## Rituals that reinforce the ratchet

Small practices that keep discipline visible:

### Session close ceremony

At end of each session:
- Update the session's README with final state
- Log any judgement calls made
- Flag any follow-ups needed
- Mark the brief as closed

### Phase close ceremony

At end of each phase:
- Merge all complete work
- Abandon incomplete work (with decisions logged)
- Update parking lot — absorb, defer, decline
- Update architectural docs (ERD, API contracts) if any changes landed
- Snapshot: version bump, decision log updated, lessons documented

### Review cadence

- Daily: check CI, address failures immediately
- Weekly: status consolidation, blocker review
- Fortnightly: parking lot review
- Monthly: retrospective, process improvements, kill-criteria checks

---

## When to break the ratchet

Rules exist to be broken intelligently. Situations where ratchet discipline bends:

- **Genuine emergency** (security issue, data loss risk, catastrophic bug): skip ADRs, fix now, document after
- **Pre-pilot iteration** (first pilot user hits a critical bug): prioritise learning, document the shortcut
- **Clear evidence of wrong decision** (a design is actively harming pilot users): revisit with evidence, not anxiety

But:

- The break is acknowledged
- The reason is documented
- Normal process resumes afterward
- Lessons learned inform future decisions

Don't let exceptions become the rule. Emergency mode is exhausting; avoid needing it by doing ordinary work well.

---

## Closing note

The ratchet is not about moving faster. It's about moving *reliably*. A project that ships every 2 weeks predictably beats one that might ship in 4 weeks but might take 12.

GPS Action has a pilot target. Missing the target has real cost — momentum lost, trust eroded, network engagement fades. The ratchet makes the target real by making commitments real.

It also protects you. Every rule in this document is a rule against "effort that doesn't produce progress." Every hour spent on second-guessing, revisiting, or re-briefing is an hour not building. The ratchet converts that time back into forward motion.

Use it. Update it. It's a tool, not a doctrine.
