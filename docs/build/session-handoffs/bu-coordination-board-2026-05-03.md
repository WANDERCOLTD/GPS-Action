# Session handoff — bu-coordination-board (Phase 3 design)

**Date:** 2026-05-03 (afternoon-evening session)
**Branch:** `docs/coord-board-html-sketches-20260503` (worktree at `.claude/worktrees/coord-board-html/`)
**Last commit:** `5c09173` — docs(coord-board): Surface 3 notifications-pane feedback iteration
**Pushed to origin:** ✅ yes

The next session reads this handoff **and** the brief at
`docs/build/session-briefs/bu-coordination-board.md` (currently v0.3
on main; v0.4 rewrite pending — see "Path B" below). Both are needed
for context. Companion doc: `docs/product/coordination-board-overview.md`.

---

## Current state

### What shipped to main during this session

- **PR #185** (MERGED at v0.2.66) — brief expansion: Direction B (shared-inbox alternative) + Broadcast companion folded into `bu-coordination-board.md`. **Now stale** in light of the redirects below; v0.4 rewrite will demote both.
- **PR #187** (OPEN at v0.2.67, behind main) — UI surface sketches PR. This is the branch the next session is on.
- **PR #191** (OPEN, auto-merge queued at v0.2.69) — Broadcast split into its own `bu-broadcast.md`. CI green; should have landed by the time the next session starts. Verify with `gh pr view 191`.

### Major decisions made this session

1. **Direction B (Inbox shape) rejected** — confirmed by both Paul (inline answers) AND Leonid ("we communicate inside each ticket"). Direction A (kanban) wins.
2. **Broadcast split into its own BU** (`bu-broadcast.md`) per Q5. Different review audience; schema seam clean enough.
3. **Description-edit RBAC** = any group member, audit-logged.
4. **`RequestType` collapsed** — every ticket is just a ticket.
5. New primitives introduced:
   - **Share-with-team** (admin-pre-set workflow allow-list per team)
   - **Invite-group-to-ticket** (action on ticket detail)
   - **Notifications inbox** = thin alerts pane, separate from boards
   - **Cross-team flags-in-corner** (small badge in team picker)
6. **Tier-2 defaults applied** in coding plan (awaiting Paul's confirm/override): `RequestStatus = backlog/active/done/abandoned`; columns configurable with system defaults; auto-subscribe = author+assignees+ever-mentioned; per-group notification override allowed; Backlog/Done = list-default; `lead → admin` rename.
7. **Multi-assignee per ticket** (drop "owner" vocabulary, use `Assignment` join).

### Surface state in #187 (sketches bundle)

| Surface | State | Awaits |
|---|---|---|
| **1 · Kanban desktop** | Revised per all 5 of Paul's stakeholder feedback items: group-name title only · Active/Backlog/Done tabs · "+ Propose to backlog" as outline button in header · no chips beyond Urgent · avatar-only with `+N` overflow · warning-subtle yellow bg for unclaimed cards. **POC-accepted by Paul (2026-05-03 PM):** "I think it's good for the POC." | No further changes pre-POC. |
| **2 · Ticket detail** | NEW, built fresh during the pivot commit. Title with edit affordance · multi-assignee row · urgent flag · editable description · interleaved comments + notes + system events · Comment/Note compose tabs · Subscribe + Share-with-team + Invite-group actions · right-side meta sidebar. **First-pass feedback received (2026-05-03 PM); parked pre-POC** — see "POC feedback parked" section below. | POC acceptance; then apply parked feedback + collect "other minor comments" Paul flagged. |
| **3 · Notifications pane** | NEW + iterated this session per Paul's 6 follow-ups: tinted (primary-subtle) row bg replaces dot indicator · acknowledged rows plain white · click → ticket → auto-ack as the only ack path · capacity callout (limited list + auto-scroll + View-all) · trigger rules split into Defaults (subscriber-driven) vs Opt-in (team-wide blasts). | Final read-through. |

### POC feedback parked (2026-05-03 PM, Paul)

Paul's first-pass review of Surfaces 1 + 2 after seeing the sketches.
**Decision: park these and push for POC acceptance first** — don't
re-iterate the sketches or the brief on these specific changes until
the POC is approved by stakeholders. Apply when build starts (or in a
follow-up sketch round if the POC review surfaces them).

**Surface 1 (Kanban desktop) — POC-accepted as drawn.** No changes.

**Surface 2 (Ticket detail) — three parked changes:**

1. **Subscribe ↔ Assign Me are the same function.** Today the sketch
   shows them as two separate buttons. Paul: "Subscribe is the same
   function as Assign Me, so it could benefit from the same language
   and placing one next to another."
   - **Implication:** unify the verb and adjacency. Either collapse
     to one control with two states ("Assign me" → once self-assigned,
     becomes "Unassign / leave"), or keep them adjacent and use shared
     language ("Follow / Unfollow" + "Assign me / Unassign").
   - **Schema impact:** none — `Assignment` (multi-assignee) and
     `RequestSubscription` are still separate entities; this is a UI
     copy + layout change. Auto-rule already says assignees are
     auto-subscribed (Tier-2 default #4), so the two states correlate.
   - **Decision needed at build:** does self-assigning auto-subscribe
     (yes, per default), and does unassigning leave the subscription
     in place? Likely yes — explicit unsubscribe stays a separate
     gesture.

2. **Share-with-team and Invite-group should merge to one "Share with
   team".** Today the sketch shows two distinct buttons. Paul:
   "Share with team and Invite group should be the same thing: Share
   with team."
   - **Implication:** drop the "Invite group" affordance from Surface
     2; keep one control labelled "Share with team."
   - **Schema impact:** the previously separate primitives `RequestGroup`
     (Share-with-team) and `GroupInvite` (Invite-group-to-ticket)
     collapse to a single primitive. Likely just `RequestGroup` with
     enough state to cover both routes (admin-pre-set workflow target
     vs ad-hoc cross-team share). Drop `GroupInvite` from the schema
     sketch in the v0.4 brief rewrite.
   - **ADR impact:** the planned ADR for "Share-with semantics +
     `GroupShareWorkflow` + receiving-team permission envelope" now
     also subsumes Invite. Reduces ADR count from 6 to 5 (or 6 if a
     dedicated "Share targets: workflow vs ad-hoc" ADR is preferred).

3. **"Other minor comments" pending.** Paul flagged more feedback to
   come, parked alongside these two until POC acceptance.

**Why park, not iterate now:** Paul's framing was explicit — "I would
park it here for now to see if we can have it accepted as POC." The
POC review is the gate; refining sketches further before that gate
risks burning iteration on a direction that may pivot.

### What's NOT yet built / done

- ❌ **Brief rewrite to v0.4** — `bu-coordination-board.md` still says "two directions on the table" and includes the Broadcast Companion section. Needs: demote Direction B → "considered, rejected, here's why"; lift the new primitives (Share-with-team, Invite-group, Notifications) into the schema sketch; drop now-stale Q14-Q31; refresh Tier-1 settled answers.
- ❌ **Coding plan as a doc** — produced as in-chat analysis only. Either fold into the brief v0.4 rewrite or save as sibling `docs/build/session-briefs/bu-coordination-board-coding-plan.md`. (See "Coding plan summary" below for what was delivered.)
- ❌ **Surface 1 + 2 next feedback rounds** — Paul flagged "feedback coming on UI surfaces". Surface 2 has had zero feedback yet.
- ❌ **#187 rebase + version bump for merge** — currently behind main and at v0.2.67 (which `< current main`).
- ❌ **Glyph register update** — when the kanban menu icon (probably `KanbanSquare` from lucide-react) lands in code, must update `docs/product/design-philosophy.md` glyph register in the **same commit** (per memory note: binding rule).
- ❌ Application of Tier-2 defaults to the brief — they live in the coding plan only.

---

## CRITICAL: Pre-steps for the next session

### 1. Verify worktree

```bash
git branch --show-current && git rev-parse --show-toplevel
```

Path must end in `.claude/worktrees/coord-board-html/`. If not, stop and create the worktree per CLAUDE.md "Session hygiene".

### 2. Pull main, check #191 state

```bash
git fetch origin
gh pr view 191 --json state,mergeCommit          # likely MERGED by now
git log HEAD..origin/main --oneline              # see what's new
```

If #191 has merged, `bu-broadcast.md` exists on main and `bu-coordination-board.md` already has the Companion-section pointer paragraph. The v0.4 rewrite (Path B below) starts from that state, not the v0.3 state.

### 3. Rebase #187 onto main + bump version

```bash
git rebase origin/main
# Expected conflict: package.json version
```

Resolve by setting version > current main. Likely values:
- If main is at **v0.2.69** (#191 merged): bump #187 to **v0.2.70**.
- If main is at **v0.2.68** (#191 not yet merged): bump to **v0.2.70** anyway, leaving v0.2.69 free for #191.

```bash
git rebase --continue
git push --force-with-lease
gh pr edit 187 --title "docs(coord-board): ... (v0.2.70)"
```

### 4. (Optional) Cleanup

```bash
# After #191 merges, the bu-broadcast-stub worktree can be removed:
git worktree remove .claude/worktrees/bu-broadcast-stub
git branch -d docs/bu-broadcast-stub-20260503
```

---

## Suggested next-session sequence

Ask Paul which path first; he indicated more sketch feedback is coming.

### Path A — more sketch iteration (likely)

1. Paul shares feedback on Surfaces 1 + 2 (and possibly Surface 3 follow-up).
2. For each tweak: edit the SVG, regenerate the JPG, update the HTML callouts.
3. JPG regen recipe (per-surface):
   ```bash
   cd docs/product/coordination-board-sketches
   rsvg-convert -w 3200 -h 1800 -f png surface-N-name.svg -o /tmp/sN.png \
     && sips -s format jpeg -s formatOptions 90 /tmp/sN.png --out surface-N-name.jpg \
     && rm /tmp/sN.png
   ```
4. Commit + push to #187. Use `--force-with-lease` if rebased.
5. When Paul calls it done: rebase + bump version + auto-merge per Path C.

### Path B — brief rewrite to v0.4

1. New worktree off origin/main:
   ```bash
   git worktree add .claude/worktrees/coord-board-v04 -b docs/coord-board-v04-20260504 origin/main
   ```
2. Read current `bu-coordination-board.md` from main (post-#191 likely already has the pointer paragraph).
3. Rewrite scope:
   - Demote Direction B section → "considered, rejected, here's why" (1-2 paragraphs)
   - Drop Direction-B-only Qs (was Q14-Q18 in v0.3)
   - Lift new primitives into the schema sketch:
     - `Group.kind` enum (`workstream | region | network | topic`)
     - `Assignment` join (multi-assignee, replacing `claimedByUserId`)
     - `RequestGroup` join (Share-with-team)
     - `GroupShareWorkflow` (per-team admin allow-list)
     - `GroupInvite` (Invite-group-to-ticket)
     - `Comment.kind` enum (`comment | note`) + `.source` enum (`human | system`)
     - `Notification` lifecycle (`new | acknowledged | dismissed`) + `reasonKind` enum
   - Update Tier-1 settled answers in the open-questions section
   - Apply Tier-2 defaults from the coding plan
4. Optionally fold the coding plan as a "Build sequence" section, or split into sibling `bu-coordination-board-coding-plan.md`.
5. Bump version, commit, push, PR.

### Path C — merge #187 (when sketch iteration is done)

After rebase + version bump (pre-step 3):

```bash
git push --force-with-lease
gh pr merge 187 --squash --delete-branch --auto
```

Then cleanup:

```bash
git worktree remove .claude/worktrees/coord-board-html
git branch -d docs/coord-board-html-sketches-20260503
```

---

## Known gotchas / risks

- **Worktree symlink trap.** Creating `node_modules` as a symlink in a worktree (for `npx prettier`) twice during this session was followed by SVG/index.html files appearing as "deleted" from the working tree (despite still being in HEAD/remote). Recovery: `git checkout HEAD -- <path>`. Cause unclear; suspect filesystem watcher interference with the symlinked node_modules. Avoid the symlink if possible — prettier can be run from a separate worktree that has a real `node_modules`.
- **Version-bump conflicts.** Multiple parallel PRs all bump `package.json`, creating rebase conflicts every time main moves. Stagger version numbers across open PRs so each can merge without further re-bumping. `--force-with-lease` after every rebase.
- **Prettier on SVG.** `prettier --write` doesn't have an SVG parser — the warning "No parser could be inferred" is harmless. Format only `*.html` and `*.md`.
- **Glyph register rule** (memory note + CLAUDE.md): adding new lucide icons in code requires updating `docs/product/design-philosophy.md` register in the same commit. One-concept-one-glyph; binding rule.
- **JPG regen toolchain.** Needs Homebrew `librsvg` (for `rsvg-convert`) plus macOS `sips` (built-in). On other machines, install ImageMagick + librsvg or Inkscape.
- **Direction B is dead.** Don't revive any "shared inbox" thinking. The decision was confirmed by both Paul and Leonid; revisiting would be churn.
- **Surface 2 (Ticket detail) is unreviewed.** Built fresh by me with reasonable defaults; Paul may have substantial feedback when he gets to it.
- **Coord-board is a planned-status BU.** No code is being written. Don't accidentally start implementing the schema until the brief is at v0.4 and the tech-review meeting (Simon, Harry, Grant, Paul, Leonid) has met.

---

## Open PRs at handoff time

| PR | State | Version | Notes |
|---|---|---|---|
| **#187** | OPEN, behind main | v0.2.67 | Sketches bundle (HTML + 3 SVG + 3 JPG). This branch. Needs rebase + bump to ≥v0.2.70 before merge. Held while sketch iteration continues. |
| **#191** | OPEN, auto-merge queued, CI green | v0.2.69 | Broadcast split → `bu-broadcast.md`. Likely MERGED by next session. Verify before referencing. |
| **#185** | MERGED earlier this session | v0.2.66 | Brief v0.3 expansion. Direction B + Broadcast Companion content — to be partly superseded by #191 + the v0.4 rewrite. |

Recently landed on main during this session (NOT this branch's work):

- **#188** v0.2.65 — feat(search): magnifier + /search route shell
- **#189** v0.2.67 — feat(search): typeahead + full-results + recently-viewed
- **#190** v0.2.68 — feat(search): house-style result rows + history-aware back

`BU-search-surface` build is in flight on a different branch (not relevant to coord-board).

---

## Open questions inventory

### Tier 1 — settled this session ✓

- ~~Direction B fate~~ → DEAD (per Paul + Leonid)
- ~~#187 fate~~ → revise + merge (Path C)
- ~~Description-edit RBAC~~ → any group member, audit-logged
- ~~`RequestType`~~ → collapse to "ticket"
- ~~Broadcast split~~ → split into `bu-broadcast` (#191)
- ~~"Brief" naming~~ → keep

### Tier 2 — defaults applied in coding plan, awaiting confirm/override

| # | Question | Default applied |
|---|---|---|
| 1 | `RequestStatus` values | `backlog · active · done · abandoned` |
| 2 | Column configurability | System defaults; per-group override allowed |
| 3 | Recruitment → Preparation transition | Auto on first self-assign |
| 4 | Auto-subscribe rule | Author + all assignees + ever-mentioned |
| 5 | Per-group notification override | Allowed |
| 6 | Network attach authority | Network admin can self-attach |
| 7 | Backlog/Done view defaults | List-by-default for both |
| 8 | `GroupMembership.role` rename | `lead → admin`, yes |
| 9 | Network self-attestation | Per-network setting (admins decide on creation) |
| 10 | Subscriber definition | Author + assignees + manually-subscribed + ever-mentioned |

### Tier 2 — new primitives needing UI shape

- **Share-with-team workflow config UI** — where admins set the allow-list of teams they can share to. Probably a per-team settings page.
- **Invite-group-to-ticket** — UX of the affordance · permission scope · what the recipient sees. Surface-level callout in Surface 2 only; not yet sketched as own surface.
- **Cross-team flags-in-corner** — exact trigger logic + render. Touched in Surface 3 callouts; not yet a dedicated sketch.

### Tier 3 — Broadcast (now in `bu-broadcast.md`)

13 Qs (was Q19-Q31 in coord-board v0.3, renumbered Q1-Q13 in the broadcast stub). All open. Awaits Broadcast's own tech-review.

---

## Coding plan summary (delivered as chat, not yet a doc)

Produced as in-chat analysis at the end of this session. Key items the next session should preserve:

- **Schema additions** (~10 entities/extensions): `Group.kind`, `Assignment`, `RequestGroup`, `GroupShareWorkflow`, `GroupInvite`, `Comment.kind/source`, `Notification` lifecycle + `reasonKind`, `Subscription.source`, `BoardColumn`, `Request.body editable`/`status enum`/`columnId`/`boardPosition`/`isUrgent`. Drop `Request.claimedByUserId` (replaced by Assignment) and any `RequestType` enum.
- **8-PR build sequence**: schema → services → routers → board view (Surface 1) → ticket detail (Surface 2) → notifications (Surface 3) → mobile → flag flip.
- **6 ADRs**: status redesign · column configurability · TTL access policy (now: dropped — no TTL) · Comment shape · Notification lifecycle · Share-with semantics + GroupShareWorkflow + receiving-team permission envelope · `lead → admin` rename.
- **Tests**: unit at services, integration at routers, E2E for cross-team flows + notification lifecycle.
- **Estimate**: ~10-12 days for one engineer, parallelisable to ~7 days with two.
- Behind `coord_board_v1` feature flag (per D036) until trio is end-to-end demoable.

The full chat-form analysis is in the conversation transcript; can be reconstructed from the open Qs + decisions above if the transcript isn't accessible.

---

## What I would have done next if context allowed

Given Paul flagged "feedback coming on UI surfaces", the natural continuation is **Path A (more sketch iteration)** until the surface set settles, then **Path B (brief v0.4 rewrite)**. With ~30-40 minutes of fresh context I'd:

1. Pull main + rebase #187 + bump to ≥v0.2.70.
2. Apply any pending Surface 1 / 2 feedback if Paul has sent it. Keep iterating until Paul calls it done.
3. Then start the v0.4 brief rewrite — that's the bigger value-add. The mockups are mostly settled visually; the brief still says "two directions on the table" which is now obsolete.

Estimate to complete:

- Sketch iteration: depends on feedback volume; 1-2 hours per round, 2-4 rounds likely.
- Brief v0.4 rewrite: ~2-3 hours of careful editing.
- Coding plan as sibling doc: ~1 hour.
- Total to a clean handover-to-tech-review state: ~half a day of focused work.

---

## User notes

(None supplied with this handoff — Paul asked for a clean handoff for a fresh CC session; no specific flags.)

---

# Session 2 — afternoon-evening 2026-05-03 (nav slot + brief v0.4)

**Date:** 2026-05-03 (afternoon-evening, after Session 1)
**Branches in flight:** all merged or in PR — see "Open PRs at handoff time" below.
**Current branch (this handoff lives on):** `docs/coord-brief-v04-20260503` (worktree at `.claude/worktrees/coord-brief-v04/`)
**Last commit:** `ebd227d` — chore(trackers): regen bu-sequence + traceability for brief v0.4
**Pushed to origin:** ✅ yes

The next session reads this Session 2 handoff **plus** the brief at
`docs/build/session-briefs/bu-coordination-board.md` (now **v0.4** on
PR #194; assume merged into main by next-session start). Session 1
handoff above is preserved for archaeology — its Direction-B-and-
Broadcast comparison thinking is no longer load-bearing.

---

## What this session shipped

### Merged to main

- **PR #192 (v0.2.71)** — `feat(coord-board)`: nav slot + `/board` placeholder.
  - First AppNav icon (`KanbanSquare`) before Feed, gated by `coord_board_v1`.
  - `/board` placeholder route — flag-off redirects to `/feed` (mirrors `/calendar`).
  - Glyph register update same-commit (binding rule).
  - Flag registered in `feature-flag-register.md` (TTL 2026-11-03, prod OFF, dev OFF — admin flips via `/data/featureFlag` CRUD).
- **PR #193 (v0.2.72)** — `docs(coord-board)`: parked Surface 2 feedback + Surface 1 POC-accepted.
  - Recorded Paul's Surface 2 feedback in this handoff doc:
    - **Subscribe ↔ Assign Me unify** (same conceptual motion, different commitment levels — adjacent action pair, shared visual language).
    - **Share-with-team + Invite-group merge** to one "Share with team" — drop `GroupInvite`, single `RequestGroup` primitive covers both routes.
  - Surface 1 (kanban desktop): POC-accepted as drawn, no changes.

### Open / awaiting merge

- **PR #194 (v0.2.73)** — `docs(coord-board)`: brief **v0.4** + scenarios SCN-32/33/34.
  - Brief flipped `status: planned` → `status: ready`.
  - Direction B demoted to "considered, rejected" (1-paragraph note).
  - Broadcast Companion content removed (lives in `bu-broadcast.md` / #191).
  - Tier-2 defaults baked in — all 10 of them — confirmed by Paul.
  - Parked feedback applied throughout (Subscribe/Assign-Me unified; single Share-with-team; drop `GroupInvite`).
  - Schema sketch consolidated.
  - 8-PR build sequence + 5 ADRs folded into the brief.
  - **Tech-feasibility review skipped per Paul.** Build is gated only by ADRs landing alongside the schema PR.
  - Companion scenarios:
    - **SCN-32** Leonid claims a writing job from his Writers board (kanban).
    - **SCN-33** Sharon shares a stuck job to IT (ticket detail — exercises unified Assign-me/Follow + single Share with team).
    - **SCN-34** Maya gets a notification about a stuck card (notifications pane).
  - **CI status as of handoff:** initial run failed `trackers:check` + `trace:check` (auto-regen drift from the brief change). Both fixed in commit `ebd227d`. CI re-running.

---

## CRITICAL: Pre-steps for the next session

### 1. Verify worktree

```bash
git branch --show-current && git rev-parse --show-toplevel
```

Path must end in `.claude/worktrees/<slug>/`. Worktree per session is mandatory (CLAUDE.md).

### 2. Confirm PR #194 has merged + pull dev

```bash
gh pr view 194 --json state,mergedAt
git -C /Users/paulwander/projects/gps-action fetch origin && git -C /Users/paulwander/projects/gps-action pull --ff-only
ps aux | grep "next dev" | grep -v grep   # if dev server running, kill + restart per memory note
```

If #194 hasn't merged yet, re-check CI (`gh pr checks 194`). Both prior CI failures (`trackers:check`, `trace:check`) were fixed in `ebd227d`; the rerun should be green. If still red, surface and stop.

### 3. Cleanup this worktree (after #194 merges)

```bash
git worktree remove /Users/paulwander/projects/gps-action/.claude/worktrees/coord-brief-v04
git branch -D docs/coord-brief-v04-20260503  # if not already auto-deleted by squash-merge
```

### 4. Create the schema PR worktree

```bash
git -C /Users/paulwander/projects/gps-action fetch origin
git -C /Users/paulwander/projects/gps-action worktree add .claude/worktrees/coord-board-schema -b feat/coord-board-schema-20260504 origin/main
cd /Users/paulwander/projects/gps-action/.claude/worktrees/coord-board-schema
npm install     # each worktree has its own node_modules
```

**Brief naming:** the next PR ships `BU-coordination-board` work. Use **lowercase** `bu-coordination-board` in commit messages and PR titles to avoid the brief-flip gate (the gate matches `BU-` case-sensitive — uppercase = shipping intent, requires status: shipped flip).

---

## Suggested next-session sequence — Schema PR (build sequence #1 of 8)

This is build sequence step #1 from the brief. ~1.5–2 hrs of careful
work. Single PR bundling 5 ADRs + schema delta + reference-data
migration; no behaviour.

### Step 1 — Write the 5 ADRs (preferred order)

All under `docs/adrs/` using the template at `docs/adrs/0000-template.md`.
Number them sequentially after the current highest ADR.

1. **`RequestStatus` redesign.** Reframe to `backlog | active | done | abandoned`. Supersedes the D054 collapse plan. `BoardColumn` carries the visual workflow within `active`.
2. **`BoardColumn` configurability + ownership.** System defaults seeded per `GroupKind` via reference-data migration (D070); group admins override.
3. **`Comment.kind` + `.source`.** `comment | note` (visibility carve), `human | system` (entry source).
4. **`Notification` lifecycle + `reasonKind`.** Three-state lifecycle (`new | acknowledged | dismissed`), six reason kinds (`assignment | mention | status_change | comment | urgent_flip | team_blast`).
5. **`RequestGroup` + `GroupShareWorkflow`.** Share-with-team semantics, receiving-team permission envelope. Subsumes the originally-planned separate Invite-group ADR (parked-feedback merge).

Commit: `docs(adrs): coord-board schema ADRs — status, board-column, comment-shape, notification, share`

### Step 2 — Schema delta

Edit `prisma/schema.prisma` per the brief's "Schema additions" section (consolidated block). Key changes:

- New enums: `GroupKind`, `CommentKind`, `CommentSource`, `NotificationLifecycle`, `NotificationReasonKind`, `SubscriptionSource`. Reframe `RequestStatus`.
- New entities: `Assignment`, `RequestGroup`, `GroupShareWorkflow`, `BoardColumn`.
- `Group.kind: GroupKind`; `Request.status` re-enumed; `Request.columnId` (FK), `Request.boardPosition: Decimal`, `Request.isUrgent: Boolean`.
- Drop `Request.claimedByUserId` and `Request.requestType`.
- `Comment.kind`, `Comment.source`.
- `Notification.lifecycle`, `Notification.reasonKind`.
- `Subscription.source` (on existing `RequestSubscription`).
- Rename `GroupMembership.role` value `lead` → `admin`.

Generate the migration with `npx prisma migrate dev --name coord_board_schema_v1`. Inspect the SQL — should be additive everywhere except the `claimedByUserId` / `requestType` drops (those need explicit data migration if production has rows; check `Request` count first — should be small / zero pre-flag-flip).

Commit: `feat(coord-board): schema additions for kanban surface (n migrations)`

### Step 3 — Reference-data migration for `BoardColumn` defaults

Per D070, ships in `prisma/migrations/`, not `scripts/seed.ts`. Idempotent (`ON CONFLICT (groupKind, ordinal) DO NOTHING`). System default columns per `GroupKind`:

- `workstream` (Writers, IT, etc.): Recruitment / Preparation / Implementation / Monitoring (4 columns).
- `region`: New / Active / Resolved (3 columns).
- `network`: New / Open / Done (3 columns).
- `team`: same as `workstream` for now.
- `topic`: New / Active / Resolved (3 columns) — same as `region`.

(Confirm column names with Paul if seeking exactness; the meeting only fully specified the workstream defaults.)

Commit: `feat(coord-board): reference-data migration — system BoardColumn defaults per GroupKind`

### Step 4 — `lead → admin` rename inline migration

Hand-written SQL in a separate migration file (Prisma can't safely generate enum value renames). `UPDATE "GroupMembership" SET role = 'admin' WHERE role = 'lead'` followed by enum constraint update.

Commit (or fold into Step 2 if cleaner): `refactor(group): rename GroupMembership.role lead → admin`

### Step 5 — Sanity tests

- Unit: `Assignment` insert → `Subscription` exists for the same user (auto-rule).
- Unit: dropping `claimedByUserId` doesn't break `Request` create (single-assignee callsites need migration to multi-assignee).
- Integration: `RequestGroup` per-link state allows the same Request in two groups with different statuses (Writers Done + IT Active).

These are sketches; full service / router tests come in PR #2.

### Step 6 — Bump + gates + open PR

- `package.json` version → 0.2.74 (assumes #194 lands at 0.2.73; rebase will surface conflicts otherwise).
- `npm run typecheck && npm run lint && npm test && npm run trackers && npm run trace:matrix && npm run check:reference-data`.
- Use lowercase `bu-coordination-board` references in commit messages + PR title.
- PR title: `feat(coord-board): schema + ADRs (build seq #1 of 8) (v0.2.74)`

Each step is its own commit per CLAUDE.md "commit per logical chunk".

---

## Known gotchas / risks

- **Brief-flip gate is case-sensitive on `BU-`.** Use lowercase `bu-coordination-board` in PR titles + commit messages until the actual ship-flip PR (build sequence #8 — flag flip). Memory-confirmed in this session: PR #192's first commit included uppercase `BU-` in the body and tripped the gate.
- **CI gates not in lint-staged.** `trackers:check` and `trace:check` only run in CI, not pre-commit. Any change touching `status:` front-matter, traceability anchors, or BU front-matter triggers AUTOGEN drift in `bu-sequence.md` and `traceability-matrix.md`. Run `npm run trackers && npm run trace:matrix` before pushing if you've changed any brief.
- **Worktree node_modules.** Each worktree needs `npm install` separately. Without it, husky hooks fail silently (lint-staged + gitleaks won't run; commit goes through unverified). PR #194's first commit landed without lint-staged because of this — was harmless here (docs-only) but a code change without it could ship unformatted.
- **`coord_board_v1` already enabled in dev DB** with `enabledGlobally: true, rolloutPercentage: 100`. Origin unclear — created before this session by a previous session or Paul. Means the Board icon appears in dev as soon as the AppNav code is on disk + dev server is fresh. In prod the row doesn't exist; admin creates it via `/data/featureFlag` CRUD.
- **Dev server doesn't auto-pick-up `git pull`.** Saw this live: dev server was running since Thursday 2026-04-30 on commit `5c0c48f` (v0.2.33), serving stale code despite multiple pulls. Memory `feedback_pull_before_dev` updated to require kill+restart of `next dev` after pulling. Symptom for the next session: "Failed to fetch RSC" floods + 5s+ HTTP timeouts = stuck server, not stale code.
- **F10 fixture flags in dev.** Dev DB has 3 extra rows (`ff_seed_rollout`, `ff_seed_kill`, `ff_seed_pilot`) that are dev-only fixtures from `prisma/seed.ts:1019-1092`. Don't migrate them to prod, don't delete them from dev (would break F10 admin UI fixtures). The `coord_board_v1` audit confirmed this is documented intent.
- **Multi-assignee migration risks.** Dropping `Request.claimedByUserId` requires every existing reader of that field to be updated. Search-and-replace surface: services that read `claimedByUserId`, routers that filter on it, components that render the claimer avatar. Plan: data-migrate any existing values into `Assignment` rows in the same migration before the column drops.

---

## Open PRs at handoff time

| PR | Status | Version | Notes |
|---|---|---|---|
| **#194** | OPEN, awaiting CI rerun (was BLOCKED, fixed `ebd227d`) | v0.2.73 | Brief **v0.4** + scenarios SCN-32/33/34. Status flip planned → ready. Should be mergeable once `trackers:check` + `trace:check` pass. |

Recently merged this session (no longer in flight):

- **#192** v0.2.71 — `feat(coord-board)`: nav slot + `/board` placeholder.
- **#193** v0.2.72 — `docs(coord-board)`: parked Surface 2 feedback.

Recently merged from the prior session (no longer in flight):

- **#187** v0.2.70 — sketches bundle (3 surfaces).
- **#191** v0.2.69 — Broadcast split into `bu-broadcast.md`.

---

## What I would have done next if context allowed

Started the schema PR (build sequence #1 of 8) immediately on a new
worktree. Estimate from the brief: ~1.5–2 hrs for the full 5-ADR +
schema-delta + reference-data-migration + sanity-tests bundle. The
brief's "Schema additions" block is the contract — the ADRs justify
each entry; the migration enforces it; sanity tests prove it doesn't
break existing `Request` callsites.

After schema (PR #1), the build sequence is:

| # | Scope | Estimate |
|---|---|---|
| 2 | Services (groups, board, assignments, subscriptions, notifications, share) | ~1.5 days |
| 3 | Routers + integration tests | ~1 day |
| 4 | Surface 1 (Kanban) | ~1.5 days |
| 5 | Surface 2 (Ticket detail) | ~2 days |
| 6 | Surface 3 (Notifications) | ~1 day |
| 7 | Mobile (tag-switcher + responsive) | ~1 day |
| 8 | Flag flip on pilot teams (Writers + IT) | ~30 min |

Total ~10–12 days for one engineer; ~7 days with two (services +
Surface 1 in parallel after #1). All behind `coord_board_v1`.

## User notes (Session 2)

Paul greenlit (in this order this session): "skip review, accept
Tier-2 defaults, go" → start Phase B with brief v0.4 + scenarios →
handoff for fresh session before schema PR. He also confirmed all
flags are toggleable from admin Settings cog (verified —
`/data/featureFlag` CRUD).
