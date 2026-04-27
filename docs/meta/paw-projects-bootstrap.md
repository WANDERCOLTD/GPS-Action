# PAW-projects bootstrap — starter notes

**Status:** parked (2026-04-27).
**Owner:** paul.
**Origin:** discussion 2026-04-27 about extracting GPS Action's
engineering discipline into a reusable starter framework.

## Goal

Bottle the engineering discipline currently embodied in this repo so
future projects start from it and stay in sync as the discipline
evolves. Working name: **PAW-projects**.

## What we're bottling — four layers

The framework breaks into four layers, each with a different
best-fit packaging mechanism. Trying to ship them all the same way
is what makes most starter templates rot within a year.

| Layer             | Examples in gps-action                                                                                                                | Packaging                      | Update model                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------- |
| Process docs      | `working-rhythm.md`, `session-brief-template.md`, ADR template, `security-baseline.md`, `api-contract-discipline.md`, `versioning.md` | One-shot copy from template    | Manual backport via changelog |
| Live tooling/code | ESLint boundary plugin, version badge + CI bump check, healthz endpoint, admin CRUD scaffold, PostToolUse branch hook                 | npm packages                   | Pin + bump                    |
| CLAUDE.md content | Layer rules, BU naming, "discuss before branching", RT workflow                                                                       | Composable include / generated | Regenerate from source        |
| Stack picks       | Next 15 / Prisma / tRPC / Vitest                                                                                                      | Variants in template           | Pick at scaffold time         |

## Recommended approach: hybrid

Picked over template-only, monorepo, and npm-only after weighing
tradeoffs. Each layer goes to its right home:

1. **`paw-projects` template repo** — docs scaffold, empty decision
   log, empty parking lot, RT log skeleton, CLAUDE.md baseline,
   `.claude/` settings.json with hooks, GitHub Actions workflows.
   Bootstrap with `gh repo create --template`.

2. **Public-quality npm packages** for the live tooling layer.
   Initial set:
   - `@paw/eslint-config-boundaries` — layer-boundary rules
   - `@paw/versioning` — badge + healthz helper + CI bump-check action
   - `@paw/admin-crud` — generator (`npx paw-admin add <Entity>`),
     not a runtime package, since fields differ per entity

3. **PAW changelog** — `UPDATES.md` in the template repo. One-line
   dated entries per discipline change (e.g. "2026-05-12: added
   'verify branch after git op' to session hygiene"). Single source
   of "what's new since you last synced."

4. **`/paw-sync` Claude Code skill** — reads the changelog, compares
   against the current project, proposes a session brief with the
   missing diffs. This solves the layer-1 update problem that kills
   most template repos: discipline backports become a 10-min Claude
   session, not a manual chore.

Update flow is **push-based**: when PAW changes, you visit each
project and apply via `/paw-sync`. Submodules and pull-based
markdown merges were considered and rejected (drift, conflict pain).

## Decisions taken in the discussion

| Question                         | Answer                                                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solo or shared?                  | Public-quality. But existing projects (gps-action) don't need to hook in precisely — new projects start clean from PAW; backports to gps-action are manual/optional.    |
| One stack or many?               | One today (Next/TS/Prisma/tRPC). Many in future — framework will need to split into stack-agnostic discipline + stack-specific scaffolds when the second stack arrives. |
| Private or public GitHub?        | Undecided. Defer until packages are ready to publish.                                                                                                                   |
| Update cadence model             | Push-based, ~fortnightly OK. `/paw-sync` skill is the leverage.                                                                                                         |
| Global vs per-project CLAUDE.md? | Per-project boundaries. `~/.claude/CLAUDE.md` stays for personal preferences; project CLAUDE.md owns project discipline.                                                |

## Open questions / not yet decided

- Concrete inventory of which gps-action docs/configs/hooks ship in
  PAW v0.1 vs stay project-specific. (~30-min audit when un-parked.)
- Where do scenarios fit? They're project-specific content but the
  _discipline_ of having scenarios before code is universal — needs
  at minimum a template `scenarios.md` scaffold + the rule in
  CLAUDE.md baseline.
- How tightly coupled is `@paw/admin-crud` to Next + Prisma + tRPC?
  Probably explicitly stack-locked for v0.1.
- npm namespace `@paw/…` — check availability before committing.
- License (MIT? proprietary?) — depends on private vs public call.
- Does `/paw-sync` live as a skill in the template repo's `.claude/`
  or as a global `~/.claude/skills/` skill? Probably global so it
  works against any PAW-bootstrapped project.

## Standard features the user wants in PAW v0.1

Called out explicitly in the discussion as wanted-by-default:

- Admin data CRUD pattern (per-entity scaffold)
- App versioning (badge + healthz + CI bump-check)
- Scenario docs before code (discipline)
- Sequence of briefs (working-rhythm)
- New branch per session (session hygiene)

## Next steps when un-parked

1. Inventory gps-action — flag each doc/config/hook as "PAW core",
   "PAW stack-Next", or "project-specific only".
2. Decide private vs public GitHub.
3. Draft `paw-projects` repo skeleton.
4. Extract `@paw/eslint-config-boundaries` first — most decoupled,
   easiest to validate end-to-end.
