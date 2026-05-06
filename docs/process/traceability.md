# Traceability

_Companion to D038 (the discipline) and D053 (the script's
output / threshold decisions). The mechanical embodiment of
"every scenario, every spec, every Build Unit, every code file
linked in both directions"._

---

## What this is

Traceability links five artefact types so any change is
analysable in both directions:

```
Scenarios  ←→  Build Units  ←→  Code files  ←→  ADRs  ←→  Tests
```

Forward: "I'm changing this scenario — which code does it
affect?"
Reverse: "I'm reviewing this PR — which scenarios does it
back?"

The discipline is mechanical: tags in code, headings in docs, a
script that joins them. No manual matrix maintenance.

---

## The tags

### `@build-unit BU-<name>` (F06 rule 1)

Every code file in the application's source tree declares which
Build Unit it belongs to. Enforced by the
`require-build-unit-header` ESLint rule.

```typescript
/**
 * @build-unit BU-comments
 * ...
 */
```

A file can carry multiple BUs (space-separated) when it spans
two — e.g. PostCard touches both BU-feed and BU-comments:

```typescript
/**
 * @build-unit BU-feed BU-comments
 */
```

### `@spec <path> (<ref>)` (F13)

Every code file with `@build-unit` carries at least one `@spec`
tag pointing at the spec or decision the file implements.
Enforced by the `require-spec-tag` ESLint rule.

Format: `@spec <relative-path-under-docs>` with an optional
parenthesised reference inside. Multiple `@spec` tags allowed —
typical for files that span concerns:

```typescript
/**
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052, D045)
 * @spec product/scenarios.md (SCN-20)
 * @spec product/design-philosophy.md
 */
```

The script extracts each `(<ref>)` and indexes it. References
can be:

- Scenario IDs: `SCN-N` (or `SCN-0N` — leading zeros normalised
  during parsing)
- ADR IDs: `D0NN`
- Multiple comma-separated: `(D045, D048, D052)`
- None at all (just a path) — the spec is consulted but no
  specific section pinned

### `@depends-on BU-foo` (optional, no enforcement)

Files (or briefs) can declare explicit BU-level dependencies:

```typescript
/**
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052)
 * @depends-on BU-reactions, BU-auth
 */
```

The tag has no lint rule — it's a developer-authored signal, not an
F-rule. The trace tool aggregates declarations into a per-BU
dependency graph and surfaces them via `pnpm impact`. Use when
the dependency is non-obvious (e.g. a service relies on a contract
shape another BU establishes); skip when it's already implicit via
imports.

### `@no-code-yet` marker (D053)

Scenarios with no backing code yet carry a marker on the line
immediately after the heading:

```markdown
### Scenario 5 — Michael loses his phone

<!-- @no-code-yet -->

_Michael, member..._
```

The marker is invisible in rendered markdown (HTML comment) and
exempts the scenario from the `trace:check` zero-refs failure
mode. Removed when the scenario gains backing code.

---

## The script

`scripts/trace.ts` walks the codebase + scenarios + decision-log
and answers any traceability question.

### Lookup mode

```bash
pnpm trace SCN-20
pnpm trace BU-comments
pnpm trace D052
pnpm trace components/CommentList.tsx
```

Resolves any of: scenario ID, BU name, ADR ID, file path. Prints
the forward + reverse dependency tree.

### Impact mode

```bash
pnpm impact server/services/comment.ts
```

Given a file path, prints:

- BU(s) the file belongs to
- Scenarios it backs (via `@spec`)
- ADRs it implements
- **Files that import it** (1-hop reverse import map; resolves
  `@/` alias and relative imports)
- Forward BU dependencies (via `@depends-on` on the file or its
  BU)
- Reverse — BUs that declare this file's BU as a dependency

The single-command answer to "what does changing this file
affect?" Use before any non-trivial edit to surface blast radius.

### Check mode (CI)

```bash
pnpm trace:check
```

Exits non-zero on any of:

- A scenario has zero backing code AND no `@no-code-yet` marker
- A code file's `@spec` references an unknown SCN-N or D-NNN
- The committed `traceability-matrix.md` is drifted

Wired into CI between lint and tests.

### Matrix mode

```bash
pnpm trace:matrix
```

Regenerates `docs/architecture/traceability-matrix.md` — the
one-glance health snapshot. Committed to git; the drift check
above prevents staleness.

---

## What the matrix shows

### Per scenario

- Title
- Backing-code file count
- Build Units serving it
- ADRs constraining it
- Status: ✓ shipped (≥1 file) | parked (0 files + marker) | ⚠ gap (0 files, no marker)

### Per Build Unit

- File count
- Scenarios served
- ADRs cited

### Per ADR

- Title
- Number of code files referencing it

### Coverage gaps

A dedicated section listing scenarios with `⚠ gap` status. The
brief author of any future BU should consult this — if your BU
covers a gap scenario, remove the marker (the scenario gets
files) and the gap closes.

---

## Adoption discipline

### When you write code

Carry the headers. Always. F-rules block the commit otherwise.

### When you write a scenario

If it's aspirational (no code yet), add the
`<!-- @no-code-yet -->` marker. When the BU that backs it ships,
remove the marker.

### When you write a BU brief

Reference the scenarios it serves. The build session adds
`@spec product/scenarios.md (SCN-N)` to every relevant code file
header — that's how the matrix populates.

### When you write an ADR

Reference the BU that consumes it (`**Build Unit:** BU-<name>`).
Code files implementing the ADR carry `@spec
architecture/decision-log.md (D0NN)`.

### When you review a PR

Look at the matrix. New `⚠ gap` rows surface unintended drift.
New `✓ shipped` rows surface scenario coverage. Run
`pnpm trace <ID>` if you want to see the full tree.

---

## What this discipline is NOT

- **Not auto-tagging.** The script reports gaps; it doesn't insert
  tags. A human chooses the right SCN / D-N / BU per file.
- **Not transitive.** The matrix maps direct edges only. "BU-comments
  depends on BU-reactions which depends on …" is not expanded.
- **Not a substitute for tests.** It checks references exist and
  resolve; it doesn't run them.
- **Not a planning tool.** It records what is, not what will be.
  Plan in briefs and bu-sequence.md; record reality in matrix
  artefact.
- **Not enforced on the docs themselves.** Scenarios.md, decision-
  log.md, briefs aren't required to cite each other rigorously.
  Code is the load-bearing surface.

---

## Reading the output

A typical lookup:

```
$ pnpm trace SCN-20
SCN-20 — Eddie reads the Sky News post and writes his first comment

  Build Units (1):
    BU-comments

  ADRs (2):
    D045
    D052

  Code files (7):
    app/post/[id]/actions.ts
    app/post/[id]/page.tsx
    components/CommentComposer.tsx
    components/CommentItem.tsx
    components/CommentList.tsx
    server/routers/comment.ts
    server/services/comment.ts

  Coverage: ✓ 7 backing code file(s).
```

Any of those file paths can themselves be traced:

```
$ pnpm trace components/CommentList.tsx
components/CommentList.tsx

  Build Units (1):
    BU-comments

  Scenarios (1):
    SCN-20

  ADRs (1):
    D052
```

---

## Related

- D038 — parent ADR (the discipline)
- D053 — script's output format + thresholds
- F06 rule 1 (`require-build-unit-header`)
- F13 (`require-spec-tag`)
- F14 (`require-testid` — separate but adjacent stability surface)
- `scripts/trace.ts` — the implementation
- `docs/architecture/traceability-matrix.md` — the live artefact
