# GPS Action — Session Brief Template

_The reusable prompt structure for every Claude Code session. Copy this template, fill it in, paste it to Claude Code. Session is a one-shot build against the brief._

_Version: 0.2 · April 2026_

---

## Front-matter (required, per D067)

Every brief file in `docs/build/session-briefs/` opens with YAML
front-matter. The generator (`npm run trackers`) reads this to emit
the lifecycle tables in `bu-sequence.md`. CI blocks merge if a BU PR
ships without flipping status to `shipped`.

```yaml
---
slug: bu-<short-noun> # filename without .md
status: planned # planned | in_progress | shipped | abandoned
phase: 2 # 0 | 1 | 2 | 3 | 4 — matches bu-sequence.md
priority: high # high | medium | low (only meaningful if planned)
# shipped_in: "#NNN"            # add when flipping to shipped, in the same PR
# superseded_by: <slug>         # add when flipping to abandoned, if relevant
# note: "<free text>"           # anything that doesn't fit the schema
---
```

---

## Why this template exists

One-shot parallel builds only work if each session has a tight, unambiguous brief. A session given "build the dispatch feature" will interpret freely and produce work that doesn't integrate. A session given this template — with files to create, files not to touch, contracts to honour, and a definition of done — produces work that assembles with everything else.

Use this for every non-trivial session. For tiny changes (a copy tweak, a bug fix), a shorter brief is fine. For anything that touches multiple files, multiple layers, or shared contracts — use this template in full.

---

## Trivial-lane exemption

Skip the brief entirely if **all** of the following apply:

- Single file, ≤10 lines changed
- Bug fix, copy tweak, doc-only edit, or dependency bump
- No schema, API contract, or breaking change
- No new feature; restoring or correcting existing behaviour
- Reviewer can verify the change in <2 minutes

The PR description still names the change and links any relevant
ADR, but no brief is needed. PR template carries a "trivial-lane"
checkbox the author ticks (and the reviewer verifies) for these.

For everything bigger — even ~30-line additions — write a brief.
Three minutes of brief saves an hour of mid-build confusion.

---

## The template

```markdown
# SESSION BRIEF · [Feature or Task name]

## Objective

One or two sentences. What are we building in this session? What does success
look like?

Example: "Build the dispatch modal and dispatch page UI components. Members
publishing a post should be able to choose which WhatsApp routes to dispatch
to and complete the dispatch flow per route."

## Scope

### Build in this session

Explicit list of files to create or modify. Use actual paths.

- /server/services/dispatch.ts (new)
- /server/routers/dispatch.ts (new)
- /app/(member)/post/[id]/DispatchModal.tsx (new)
- /app/(member)/post/[id]/DispatchPage.tsx (new)
- /tests/integration/dispatch.test.ts (new)
- /server/services/dispatch.README.md (new)
- /app/(member)/post/[id]/README.md (new)

### Do NOT touch

Explicit list of boundaries. If a session needs to change something here,
it's a scope change that needs a new brief.

- /server/db/schema.prisma (locked this phase — schema changes via ADR)
- /server/routers/post.ts (owned by different session)
- /components/design-system/\* (locked — use existing components)
- Any file not listed in "Build in this session"

### Out of scope for this session

Things the feature needs but another session will provide. List them so this
session knows to stub/mock them.

- Route matching logic (already built, import from /server/services/routes.ts)
- Notification sending (already built, import from /server/lib/notify.ts)
- User auth (assume req.user is populated by middleware)

## Contracts

### Inputs consumed

Contracts this session reads from. Do not change these shapes; they belong to
other sessions.

- Post type from /shared/types/post.ts
- User type from /shared/types/user.ts
- Route type from /shared/types/route.ts
- matchRoutesForPost(post) from /server/services/routes.ts
- dispatch config from /server/config/dispatch.config.ts

### Outputs produced

Contracts this session exposes. Other sessions will consume these; their shape
is a commitment.

- POST /api/dispatch/start (starts a dispatch flow for a post)
- POST /api/dispatch/confirm (records that a dispatch was sent)
- GET /api/dispatch/status/:postId (returns dispatch state)
- DispatchModal component (accepts post prop, closes on completion)
- Types exported from /server/routers/dispatch.ts

## Acceptance criteria

Measurable, testable outcomes. Not "works well" — concrete observable behaviours.

- [ ] On Publish of a post, dispatch modal shows matched routes
- [ ] Ticking/unticking routes updates the list in real-time
- [ ] Tapping Send for a route copies message to clipboard, opens WhatsApp
- [ ] After WhatsApp returns, confirmation prompt appears
- [ ] Dispatch records are created on send-button taps (before return)
- [ ] Already-dispatched routes show "✓ Already sent by X" state
- [ ] Skip button returns to post view, post flagged "dispatch pending"
- [ ] All flows work on mobile (iOS and Android tested) and desktop
- [ ] Accessibility: keyboard-operable, screen-reader-labelled, focus management

## Permission matrix

Who can do what in this feature. Shared function: checkPermission(user, action).

| Action                 | Member        | Writer  | Coordinator | Director |
| ---------------------- | ------------- | ------- | ----------- | -------- |
| Dispatch own post      | ✓             | ✓       | ✓           | ✓        |
| Dispatch others' posts | —             | —       | ✓ (region)  | ✓        |
| Skip dispatch          | ✓             | ✓       | ✓           | ✓        |
| View dispatch status   | ✓ (own posts) | ✓ (own) | ✓ (region)  | ✓ (all)  |

Use <PermissionGate> wrapper; never inline permission checks.

## UI states

Enumerate every state the UI must handle.

| State            | Trigger                 | What user sees                        | What user can do                 |
| ---------------- | ----------------------- | ------------------------------------- | -------------------------------- |
| Initial          | Post just published     | Modal with route checklist            | Tick/untick routes; Send or Skip |
| Loading matches  | First render            | Skeleton route list                   | Wait                             |
| Zero matches     | No routes match post    | "No dispatch routes" message          | Skip only                        |
| Multi-route      | Multiple matched routes | Checklist with per-route Send buttons | Tick, untick, send per route     |
| Dispatching      | Send tapped             | Button shows "Opening WhatsApp..."    | Wait briefly                     |
| Returned from WA | After WA backgrounded   | "Did you send?" prompt                | Yes / Not yet / Skip             |
| All sent         | Last route confirmed    | Success state, modal closes           | Close; return to post            |
| Route blocked    | Permission denied       | Muted row with explanation            | Understand; move on              |
| Network error    | API call failed         | Error banner, retry button            | Retry                            |

## Tests required

- Unit tests for service functions (matchRoutesForPost mocked; test dispatch logic)
- Integration test for the complete flow (post published → modal → confirmed)
- Component test for DispatchModal (each state renders correctly)
- Accessibility test (keyboard navigation, screen reader labels)

Not required:

- Performance benchmarks
- End-to-end with real WhatsApp (manual)

## Scenarios to verify against

See `GPS_Action_Scenarios.md` sections:

- Scenario 1 (Sharon sees a Sky News bias post and boosts it)
- Scenario 6 (Claire publishes an outcome post)
- Scenario 16 (Coordinator dispatches a Boost/Remove post to WhatsApp)

Session should click-through each scenario manually in dev before claiming done.

## Known gotchas

- Clipboard API fails silently on some browsers — show inline message as fallback
- WhatsApp deep-link scheme differs iOS vs Android — test both
- User might navigate away during multi-route dispatch — state must persist
- "Did you send?" is self-report; don't build server-side verification

## Definition of done

All these must pass before calling the session complete.

- [ ] All files in "Build" list created; all files in "Don't touch" list untouched
- [ ] TypeScript compiles with zero errors, zero `any`, zero `@ts-ignore`
- [ ] All acceptance criteria verified with test or manual click-through
- [ ] Tests pass: npm run test
- [ ] Lint passes: npm run lint
- [ ] Manual click-through of each scenario completed
- [ ] README files updated with: purpose, contracts, state, known issues
- [ ] No TODOs left in committed code
- [ ] Commit messages follow convention (feat: / fix: / etc.)
- [ ] PR description summarises changes, links this brief

## Open questions to surface

Things this session cannot decide autonomously. Claude Code should surface these
back, not make assumptions.

- What should the "confirmation ping" timing be? (30s default suggested, but verify)
- Should dispatches to the same route by different users be coalesced or separate?
- What does "Route blocked" actually look like visually?

(Claude Code, at session end, list what you encountered that needed a judgement call.)

## Context

Supporting information. Read these before starting.

- Feature spec: GPS_Action_Feature_Spec_v0.5.docx §3.13, §3.22
- Design system: gps-tokens.css, gps-components.css
- Mood board: GPS_Action_Mood_Board.html (section 5 — Share to WhatsApp)
- Parking lot: GPS_Action_Parking_Lot.md (relevant DEFERRED items)
- Architecture decisions: /docs/ADRs/ (check any relevant)
```

---

## How to fill this in

**Objective** — one paragraph. If it's more than a paragraph, the session is too big. Split.

**Scope (Build)** — actual file paths. If you can't list them, the session is not well-defined. Go back and plan.

**Scope (Don't touch)** — err on the side of more. Sessions "helpfully" expand scope otherwise.

**Contracts (Inputs/Outputs)** — these should already exist in the API contract document. This section cross-references them.

**Acceptance criteria** — no "works well." Every criterion must be testable, either by code or by clicking through.

**Permission matrix** — fill out the table even if only one role uses the feature. Explicit is safer than assumed.

**UI states** — enumerate before building. If the session finds a state you didn't list, ask before building.

**Scenarios to verify** — cross-reference the scenarios library. Session should verify each.

**Definition of done** — the checklist is non-negotiable. A session isn't "done" until every box ticks.

**Open questions** — a placeholder for judgement calls. Session surfaces these at end; human decides.

---

## Session sizing guidance

How big should a session be?

**Right-sized (one brief):**

- Build a single feature end-to-end (service + router + UI + tests)
- Implement a cross-cutting concern (audit service, notification router)
- Add a well-bounded primitive (Route entity, its CRUD)

**Too big (split):**

- "Build the admin surface" — too many screens, split per surface
- "Build all scenarios for Feature X" — if Feature X has many scenarios, each scenario might need its own session
- "Refactor the post model" — refactors are their own thing; split into schema change, migration, code updates

**Too small (batch):**

- "Change a button colour" — a PR, not a session
- "Fix a typo" — a PR, not a session

When in doubt, err on the side of smaller. Two focused sessions beat one sprawling one.

---

## Anti-patterns to avoid

**Vague briefs** — "Build the dispatch system thoughtfully." This produces vague work.

**Open-ended scope** — "Build whatever the dispatch feature needs." Scope must be explicit.

**Assumed context** — "Claude Code already knows what the dispatch system is." It doesn't remember between sessions. Always include the links.

**Hidden requirements** — if a criterion matters, put it in acceptance criteria. Don't leave it as a verbal instruction.

**Unchecked assumptions** — "Claude Code will know what to mock." Make it explicit. List what's already built and what's stub-only.

**Skipped definition-of-done** — "It's fine, just get it working." Then the session stops at 80% and leaves rough edges.

---

## Evolution

This template will improve. When a session fails in some way, the lesson should update this template. Examples of lessons-learned amendments:

- "Always specify whether tests are unit, integration, or E2E" (learned after ambiguous test scope)
- "Always list what to import from existing modules, not just 'reuse existing code'" (learned after duplicate implementations)
- "Always flag whether the session can make its own design decisions" (learned after over-designed solutions)

Keep this template in version control. Each major change logged.
