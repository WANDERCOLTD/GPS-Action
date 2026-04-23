# Contributing to GPS Action

GPS Action follows a deliberate build discipline to support parallel Claude
Code sessions without the drift that usually accompanies fast parallel work.

## Before you start

Read these, in order:

1. `docs/index.md` — map of documentation
2. `docs/feature-spec/v0.5.md` — what exists and what's planned
3. `docs/process/session-brief-template.md` — how sessions are scoped
4. `docs/process/ratchet-discipline.md` — how the project moves forward
5. `docs/process/security-baseline.md` — non-negotiable rules around data

## Session workflow

Every meaningful change follows this path:

1. **Brief** — fill in the session brief template. Explicit scope, contracts, acceptance criteria, definition-of-done.
2. **Build** — execute the brief in one focused session. Don't expand scope.
3. **Review** — walk the reviewer checklist. Reject if it doesn't pass.
4. **Merge** — clean commit, clean PR, brief linked.

## What NOT to do

- Don't commit to main directly. Branch, PR, review.
- Don't merge incomplete work. Definition-of-done is non-negotiable.
- Don't refactor outside session scope. File ideas in the parking lot.
- Don't change contracts without an ADR. They're load-bearing.
- Don't add TODO comments without a name and a deadline.
- Don't disable ESLint rules. If a rule is wrong, change it globally via PR.

## Branch naming

- `feature/dispatch-modal` for features
- `fix/audit-log-race` for fixes
- `chore/deps-update` for housekeeping
- `adr/permission-refactor` for proposals

## Commit messages

Follow conventional commits:

- `feat: add dispatch modal`
- `fix: handle empty route list in matcher`
- `chore: update prisma to 5.22`
- `docs: add scenario for vetting escalation`
- `refactor: extract audit writer to shared lib`

## Questions

If something isn't covered by the docs, raise it in the parking lot first,
then propose an ADR if it's a decision. Don't make contract-level decisions
in code review — that's too late.
