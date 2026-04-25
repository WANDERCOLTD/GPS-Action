## What this PR does

<!-- One sentence. If it needs more, split the PR. -->

## Build Unit

<!-- BU-NNN, or explain why no Build Unit applies (bugfix, tooling, etc.) -->

Build Unit: BU-**_
Scenarios touched: SCN-_**
Spec sections: §\_\_\_

## How this was tested

- [ ] Unit tests added/updated
- [ ] Integration test added (if critical path)
- [ ] Manually verified on preview deploy: <!-- link -->

## Screenshots / demo

<!-- For UI changes. Recording preferred. -->

## Migration & rollback

- [ ] No database migration
- [ ] Migration included; follows two-phase discipline (F08)
- [ ] Rollback plan: <!-- if anything non-trivial -->

## Feature flag state

- [ ] Not behind a flag (explain why)
- [ ] Behind flag: `ff_____` (default OFF)

## Reviewer checklist — universal

- [ ] Build Unit ID present in changed file headers (`@build-unit`)
- [ ] No PII in logs, analytics, or error messages
- [ ] No secrets committed
- [ ] CI green

## Reviewer checklist — if this touches routers (`server/routers/`)

- [ ] Input schema present; not `z.any()`
- [ ] Output schema declared
- [ ] Authorisation via middleware, not inline
- [ ] Errors via `TRPCError` with approved code
- [ ] Pagination on list endpoints (cursor-based, max limit)
- [ ] File header has `@build-unit`, `@scenarios`, `@spec`

## Reviewer checklist — if this touches UI (`app/`, `components/`)

- [ ] Primary actions are single-tap
- [ ] Copy is honest about what will happen
- [ ] No manufactured urgency (see design-philosophy.md)
- [ ] Cultural-marker styling used correctly (if applicable)
- [ ] Storybook story added or updated
- [ ] Error boundary present for feature root
- [ ] Keyboard navigation works
- [ ] axe-core clean on Storybook stories

## Reviewer checklist — if this touches database (`prisma/`)

- [ ] Migration is reversible (or documented why not)
- [ ] Two-phase strategy if changing column semantics
- [ ] Indexes added for new query patterns
- [ ] No PII in new columns without classification comment

## ADR required?

- [ ] No — routine change
- [ ] Yes — ADR number: D\_\_\_
- [ ] Surprised the reviewer? Open an ADR before merge.
