# SESSION BRIEF · BU-brief-status-mechanism — Front-matter status + auto-generated trackers + CI ship-flip gate

_Brief version: 0.1 DRAFT · Author: Paul + Claude · Date: 2026-04-27_
_Status: draft for review — not yet a committed brief._

---

## Why this exists

On 2026-04-27 we discovered that `CLAUDE.md` "Current focus" and
`docs/build/bu-sequence.md` "Next BU undecided" sections had drifted
weeks behind reality. Reactions, Comments, FAB intent picker,
Requests/Urgent, Vetting, Admin CRUD + audit + bulk-ops, Link share,
AM-link collapse, Hero images, Versioning, F14 testid enforcement —
all shipped, none reflected in the canonical trackers.

PR #108 (this session) reset the prose. This brief ships the mechanism
that prevents the drift recurring: turn brief lifecycle status from
hand-edited prose into a typed, machine-checked, single-source-of-
truth field.

## Objective

Move "what's planned / in-flight / shipped" from prose narrative in
two markdown files into typed front-matter on each brief, with a
generator that emits the prose sections and a CI gate that blocks
merge of a `BU-*` PR if the corresponding brief's status wasn't
flipped to `shipped` in the same PR.

After this BU lands: a brief's status cannot lie because the same PR
that ships the BU must flip the field, and the trackers that aggregate
those fields are regenerated from the source of truth on every push.

## Scope

### 1. Front-matter schema (every brief)

Every file under `docs/build/session-briefs/` gets YAML front-matter:

```yaml
---
slug: bu-fab-intent-picker
status: shipped       # planned | in-flight | shipped | abandoned
shipped_in: 78        # PR number, omitted unless status=shipped
shipped_on: 2026-04-26 # ISO date, omitted unless status=shipped
priority: high        # high | medium | low (only meaningful when status=planned)
phase: 2              # 1 | 2 | 3 | 4 — matches bu-sequence.md phases
---
```

The `slug` matches the brief filename (without `.md`). It's the join
key into the generated trackers and the CI ship-flip check.

### 2. Backfill (one-time)

Audit every existing brief and apply correct front-matter based on
`git log` history. The audit method: grep commits for `BU-<slug>` or
`feat(<area>)` patterns, match to PR numbers via the merge-commit
message. Approximately 30 briefs to backfill — plan ~30 minutes
mechanical work in this session.

The backfill commit is separate from the schema-introduction commit
so the diff stays reviewable.

### 3. Generator script (`scripts/generate-trackers.ts`)

A new script that:

- Reads every `docs/build/session-briefs/*.md`
- Parses front-matter via `gray-matter` (already a transitive dep of
  Next.js MDX pipeline; if not, add it explicitly)
- Emits two managed regions:
  - **`docs/build/bu-sequence.md`** "Phase N shipped" tables — sorted
    by `shipped_in` (PR number) ascending
  - **`docs/build/bu-sequence.md`** "Next BU — undecided" — `status:
    planned` briefs grouped by `priority` desc, then alphabetical
- Writes between marker comments so hand-edited prose around the
  managed regions survives:

```markdown
<!-- AUTOGEN:phase-2-shipped:start -->
| Item | Status | PR |
|---|---|---|
| BU-reactions | ✅ Merged | #46 |
...
<!-- AUTOGEN:phase-2-shipped:end -->
```

- Idempotent: running twice produces no diff if no briefs changed
- `--check` mode: exits non-zero if regenerating would change the
  file (used by CI)

CLAUDE.md is **not** auto-managed — its "Current focus" section is
narrative-shaped and needs human curation. The generator can emit a
helper file `docs/build/_status-summary.md` that CLAUDE.md references
("the summary" lives there), but CLAUDE.md prose stays human-written.

Decision: `_status-summary.md` adds an indirection. Open question 1
below.

### 4. CI ship-flip gate (`.github/workflows/brief-status-check.yml`)

A new workflow that runs on `pull_request`:

1. Detect if the PR is a "BU PR": title or commit messages contain
   `BU-<slug>` matching an existing brief. If not, skip.
2. For each matched brief, check that the PR diff includes flipping
   `status:` to `shipped` AND adding `shipped_in: <this-pr-number>`.
3. Also run the generator in `--check` mode against the PR head — if
   the trackers are out of date, fail with "run `npm run trackers`."

This mirrors the existing `version-bump` CI gate's enforcement model.

### 5. Update reviewer checklist + CLAUDE.md mandatory ritual

`docs/process/reviewer-checklist.md` gains a row: "If this PR ships a
BU, is the brief's `status` flipped to `shipped` and `shipped_in`
populated?" — backstop for the CI gate.

`CLAUDE.md` "What to do per session" gets a step: "If you ship a BU,
flip its brief's front-matter to `shipped` in the same commit."

### 6. ADR

A new decision record:

- `docs/architecture/decision-log.md` — append `D068 · Brief status as
  typed front-matter; generator + CI gate as enforcement` (MODIFY,
  append-only). Captures: why front-matter not separate file, why no
  managed-table-in-DB approach, the CLAUDE.md indirection question.

## Files to create / modify

**New:**
- `scripts/generate-trackers.ts`
- `.github/workflows/brief-status-check.yml`
- `tests/unit/generate-trackers.test.ts` — covers idempotence,
  ordering, marker-region preservation, `--check` mode
- `tests/unit/brief-status-check.test.ts` — covers the BU-detection
  regex, the ship-flip-detection logic against a sample diff

**Modified:**
- Every file in `docs/build/session-briefs/*.md` — add front-matter
  (~30 files; mechanical)
- `docs/build/bu-sequence.md` — wrap the "Phase 2 shipped" table and
  "Next BU — undecided" section in `<!-- AUTOGEN:... -->` markers; let
  the generator manage the table contents
- `docs/process/reviewer-checklist.md` — new row
- `docs/process/session-brief-template.md` — front-matter starter
  block at the top of the template
- `CLAUDE.md` — add the "flip status when shipping a BU" step
- `package.json` — `"trackers": "tsx scripts/generate-trackers.ts"`
  + `"trackers:check": "tsx scripts/generate-trackers.ts --check"`
- `docs/architecture/decision-log.md` — D068 entry

## Out of scope

- **Cross-project (PAW) generalisation.** This BU ships the mechanism
  for gps-action; bottling it for PAW v0.1 is parked separately on
  `docs/meta/paw-projects-bootstrap.md` open-questions list.
- **Status changes via GitHub API** (e.g. auto-flip to `in-flight`
  when a branch named after the slug is opened). Manual flip in the
  same PR is sufficient and avoids API-token plumbing.
- **Linking briefs to scenarios or ADRs.** A separate field could carry
  these but adds schema scope; defer until a real query needs it.
- **Phase tracking via field.** The `phase: N` field is informational
  for the generator's grouping; we don't enforce phase ordering or
  gates on it.
- **Migrating old `BU-001-lite` to the semantic name.** Per D051 it
  keeps the number; front-matter slug is `bu-001-lite`.

## Acceptance criteria

### Functional

- [ ] Every existing brief carries valid front-matter
- [ ] `npm run trackers` regenerates the AUTOGEN regions in
      `bu-sequence.md`
- [ ] `npm run trackers:check` exits non-zero when out of date
- [ ] CI workflow runs on every PR; fails when a BU PR doesn't flip
      its brief; fails when trackers are stale
- [ ] D068 ADR appended

### Non-functional

- [ ] TypeScript strict, zero `any`, zero `@ts-ignore`
- [ ] `npm run typecheck && npm run lint && npm test` green
- [ ] Generator + CI workflow have unit tests as listed
- [ ] Manual test: drop status to `planned` on one shipped brief, run
      `trackers --check`, see it fail; flip back, see it pass
- [ ] Manual test: open a fresh BU branch + PR with no front-matter
      flip, see CI block; flip and amend, see CI pass

## Decisions confirmed before build (Paul, 2026-04-27)

1. **CLAUDE.md stays human-written.** Its "Current focus" section is
   not auto-generated. It references `bu-sequence.md` as the canonical
   ship list. Reason: CLAUDE.md is loaded into every session's
   context; stability beats auto-currency, and a generator over
   CLAUDE.md adds an indirection (`_status-summary.md`) that costs
   more than it's worth.

2. **Pre-commit hook runs `trackers --check`.** In addition to the CI
   gate, husky runs the check on commit so staleness is caught before
   push. Cheap, fast, avoids round-trip.

## Open questions (surface; do not assume)

1. **Slug ↔ commit-message regex.** BU PR titles vary:
   `feat(intent-picker): single FAB ... (BU-fab-intent-picker / D062
   revised, D063)` vs `feat(reactions): BU-reactions — quiet
   multi-select reactions on posts`. The CI detector must match both.
   Recommend regex on the body text scanning for `BU-[a-z0-9-]+` and
   intersecting with brief slugs. Confirm.

2. **Multiple BUs per PR.** Some PRs ship adjacent BUs together
   (e.g. F11+F12 in one). Front-matter is one-per-brief, so each
   brief gets `shipped_in: <same-pr>`. CI must accept multiple flips
   in one PR. Confirm.

3. **Abandoned briefs.** Some briefs may never ship (e.g. the
   composer-bespoke-per-intent direction was superseded). Status
   `abandoned` covers it; do we also need a `superseded_by:` field?
   Recommend yes — small cost, clear intent. Confirm.

4. **In-flight detection.** Front-matter has `status: in-flight` but
   nothing automatically flips it. Either (a) leave manual, (b)
   pre-commit hook flips when a feature branch matching the slug is
   created. Recommend (a) for v1; (b) is parked.

## Definition of done

- [ ] Front-matter on every brief, backfilled correctly
- [ ] Generator script + tests
- [ ] CI workflow + tests
- [ ] AUTOGEN markers in `bu-sequence.md`; generated content matches
      hand-curated state of PR #108
- [ ] D068 ADR
- [ ] reviewer-checklist + CLAUDE.md updated
- [ ] All gates green; manual scenario tests above pass
- [ ] Branch: `feat/bu-brief-status-mechanism`
- [ ] Commit-series: (1) schema + tooling + tests; (2) backfill on all
      existing briefs; (3) wire CI; (4) flip this brief's own status
      to shipped at merge time

## What this brief does NOT cover

1. PAW-projects export — separate, parked on the PAW bootstrap doc
2. Auto-derivation of `phase` from BU dependency graph — manual field
3. Web UI for brief lifecycle — none
4. Notion / external system sync — none
5. Replacing `bu-sequence.md` with a generated database view —
   markdown stays the canonical artefact

---

## Slice convention

Commit type `feat(brief-status)`. Single PR. Establishes:
- Front-matter convention as a project pattern
- AUTOGEN-region pattern (potentially reusable for other generated
  prose in docs)
- CI gate pattern for "if PR title/body matches X, file Y must change"
- The first BU whose own brief flips to `shipped` via the new mechanism
  it introduces (a small but pleasing recursion)
