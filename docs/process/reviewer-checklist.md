# GPS Action — Reviewer Checklist

_What to verify after a Claude Code session completes, before merging its work. Runs through seven disciplines in concrete terms._

_Version: 0.1 · April 2026_

---

## How to use this checklist

Every session produces work. Before that work merges into the main branch, it goes through this checklist. The person reviewing (you, initially) walks down the list. Anything that fails means the work goes back for revision — not partial merge.

Checklist takes 15-30 minutes for a standard session. Worth it. The alternative is finding problems in Week 4 instead of Week 2.

---

## 1 · Scope compliance

Did the session stay within its brief?

- [ ] **Only the files listed in "Build" were created or modified.** Git diff shows nothing outside scope.
- [ ] **No files in "Do NOT touch" were changed.** Double-check schema files, shared types, config.
- [ ] **No unexpected dependencies added.** `package.json` changes match what the brief justified.
- [ ] **No refactoring of unrelated code.** Session didn't "improve" things outside the brief.
- [ ] **No speculative work.** Session didn't build features not in the brief "because it might be useful."

**If fails:** ask session to revert out-of-scope changes. Don't accept "but it's better this way" — out-of-scope work breaks the parallelism guarantee.

---

## 2 · Type safety

Does TypeScript enforce what we expected?

- [ ] **Zero `any` types in new code.** Search for `: any` and `as any`.
- [ ] **Zero `@ts-ignore` and `@ts-expect-error` without comment justifying.** Every suppression has a reason.
- [ ] **Zero `!` (non-null assertion) without justification.** Prefer explicit null handling.
- [ ] **Discriminated unions used for state where appropriate.** A form with 5 states should be a union type, not optional fields.
- [ ] **Types imported from single source of truth.** Not redefined locally.
- [ ] **`tsc --noEmit` passes with no errors.**

**If fails:** session needs to fix. Types are non-negotiable — they're the first line of regression defence.

---

## 3 · Test coverage

Are the right things tested?

- [ ] **Unit tests for service functions** (the non-UI logic that doesn't need HTTP).
- [ ] **Integration test for the primary happy-path flow.**
- [ ] **Tests for critical edge cases** the brief flagged (e.g. "already dispatched" state, "permission denied" state).
- [ ] **All tests pass.** `npm test` returns green.
- [ ] **No tests commented out or `skip`'d without justification.**
- [ ] **No tests with assertions against hardcoded values that will break with reasonable data changes.** Tests should be resilient.
- [ ] **Accessibility tests present** for new UI components (axe or equivalent).

**Not required** (counter-intuitive but important):

- [ ] 100% coverage — not the goal. Coverage of critical paths is.
- [ ] Tests for trivial functions (getters, simple UI). Skip these; they waste maintenance.

**If fails:** session needs to add missing tests before merge.

---

## 4 · Contract adherence

Does the session honour the contracts it promised?

- [ ] **All output contracts (APIs, exports) match what the brief declared.**
- [ ] **Input contracts consumed correctly.** No ad-hoc reimplementation of already-built services.
- [ ] **Error envelope consistent.** Uses the shared error codes from the error taxonomy, not invented new ones.
- [ ] **Permission checks use shared `checkPermission()`.** No inline role comparisons.
- [ ] **Audit entries written via shared audit service.** No direct DB writes to audit tables.
- [ ] **Notifications sent via notification router.** No direct email/push.

**If fails:** this is structural. Session needs to refactor to use shared services.

---

## 5 · UI state completeness

Does the UI handle all the states the brief enumerated?

- [ ] **Every state in the brief's state table has a render path.**
- [ ] **Loading state implemented** (not just "it'll be fast").
- [ ] **Error state implemented** (specific, not just "something went wrong").
- [ ] **Empty state implemented** (for first-time users or zero-data cases).
- [ ] **Permission-gated state implemented** (if an action is unavailable, user understands why).
- [ ] **Storybook stories exist for each state** of new components.
- [ ] **Keyboard navigation works** — tab order sensible, focus visible.
- [ ] **Screen reader labels present** — test with VoiceOver or NVDA.
- [ ] **Works at 200% zoom** — text doesn't overflow, controls remain usable.
- [ ] **Respects `prefers-reduced-motion`** — animations disable when set.

**If fails:** state is incomplete. Session needs to add missing states.

---

## 6 · Visual consistency

Does the UI look like it belongs in GPS Action?

- [ ] **No hardcoded colours, font sizes, or spacings.** Every value uses a token.
- [ ] **No inline `style={}` attributes except for dynamic values** (like progress bar widths).
- [ ] **Shared components reused** — `<Button>`, `<Card>`, `<Chip>`, `<Avatar>` etc. No parallel implementations.
- [ ] **Typography follows scale** — uses `--text-*` tokens, not arbitrary sizes.
- [ ] **Spacing follows 4pt grid** — uses `--space-*` tokens.
- [ ] **Light and dark mode both render correctly.** Manually toggle and verify.
- [ ] **WCAG 2.2 AA contrast met.** Automated check + spot-check important combinations.
- [ ] **Reaction pills, avatars, badges render consistently** with other features.
- [ ] **No emoji-as-decoration** that breaks theme consistency.

**If fails:** visual drift is cumulative damage. Fix now or fix across the whole app later.

---

## 7 · Documentation & handoff

Can the next person understand this work?

- [ ] **README files updated** in each changed directory. Includes:
  - Purpose of this module
  - Contracts it exposes and consumes
  - Current state (done / in progress / known issues)
  - Dependencies
- [ ] **No TODOs committed** without an explanation and an owner. Preferably none at all.
- [ ] **Commit messages follow convention** (feat:, fix:, chore:, docs: ...).
- [ ] **PR description summarises changes** and links to the brief.
- [ ] **Breaking changes flagged** in PR description prominently.
- [ ] **Open questions documented** — session should have surfaced judgement calls made.

**If fails:** the work becomes legacy code immediately. Documentation is not optional.

---

## 8 · Behavioural validation

Does the feature actually work as intended?

- [ ] **Scenarios from the brief click-through successfully.** Don't skip this. Manually walk each one.
- [ ] **Happy path works.** End-to-end, as a real user would.
- [ ] **Primary edge cases work.** Especially permission-gated actions.
- [ ] **Error recovery works.** Network dies mid-flow; retry sensibly.
- [ ] **Feature flag off-state works.** With the feature disabled, the app doesn't break.
- [ ] **Seed data compatible.** `npm run seed` then use the feature — no fixture violations.
- [ ] **No console errors** in normal use.
- [ ] **No TypeScript warnings** in normal use.

**If fails:** the feature isn't usable yet. Don't merge.

---

## 9 · Security & privacy

Does this work respect the security baseline?

- [ ] **No secrets in code.** API keys, passwords, tokens — all in env or secret management.
- [ ] **Personal data encrypted at rest** where required by the security baseline (see separate doc).
- [ ] **Passwords hashed with Argon2id or bcrypt.** No reversible password storage.
- [ ] **PII not logged.** Audit logs use IDs, not full emails/names.
- [ ] **User input validated.** Every API endpoint validates types and ranges.
- [ ] **Rate limiting applied** where specified (e.g. login, publish, dispatch).
- [ ] **CSRF protection on state-changing operations.**
- [ ] **Authorization checks before every data access.** Not just authentication.

**If fails:** security issues don't wait for "later." Fix now.

---

## 10 · Operability

Can we run and debug this in production?

- [ ] **Structured logging** — service entry/exit/errors logged with trace IDs.
- [ ] **Error codes used** — from the shared error taxonomy. No bare string messages to users.
- [ ] **Feature flag guards new behaviour** — can be toggled off without redeploy.
- [ ] **Metrics emitted** for critical events (dispatch sent, post published, etc.).
- [ ] **Graceful degradation** — if a dependency is down, feature fails gracefully.
- [ ] **Idempotency** where it matters — retrying a "dispatch" doesn't create duplicates.

**If fails:** the feature may work in dev but break in production.

---

## Putting it together — the reviewer's 20-minute walk

For a standard session, here's the order:

**Minute 1-3: Scope check**

- Git diff → check paths match brief
- Spot-check no unexpected changes

**Minute 4-7: Types and tests**

- Run `tsc` and `npm test`
- Scan for `any` / `@ts-ignore` / skipped tests
- Quick check coverage of new code

**Minute 8-14: Manual walk-through**

- `npm run dev`
- Open the feature
- Click through each scenario from the brief
- Toggle light/dark mode; check tab navigation

**Minute 15-18: Code review skim**

- Open each modified file briefly
- Check for shared component usage, token usage
- Read the README updates

**Minute 19-20: Final verdict**

- Either: merge
- Or: list specific blockers, send back for revision

---

## When to reject vs. when to fix forward

**Reject and send back:**

- Scope violations (out-of-scope changes)
- Type safety violations
- Missing acceptance criteria
- Missing tests on critical paths
- Security issues
- Broken scenarios

**Fix forward (merge, create follow-up):**

- Minor documentation gaps
- Cosmetic style drift (small)
- Non-critical test additions
- Performance tuning

The bar for "reject" is: would this cause problems for another session or for pilot users?

---

## Signalling the review outcome

After review, the session gets one of:

- **Approved** — merge, close the brief
- **Approved with follow-up** — merge, create a short brief for the follow-up work
- **Needs revision** — specific list of blockers, back to the session
- **Rejected** — fundamental issues, discard and re-brief

State the outcome clearly, with reasons. Claude Code sessions don't feel hurt; transparency helps the next brief be tighter.

---

## Process evolution

After five or ten sessions, you'll have patterns. Some checks will matter more than others in practice. Some will need adding (e.g. "every new component has a Storybook story" if you find this slipping).

Update this checklist. Treat it as a living document.

The goal isn't perfect rigour — it's to keep parallel work integrable. If the checklist is helping catch integration issues, it's earning its weight. If it's not, it needs updating.
