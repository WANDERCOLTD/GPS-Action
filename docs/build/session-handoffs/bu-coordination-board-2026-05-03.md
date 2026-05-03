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
| **1 · Kanban desktop** | Revised per all 5 of Paul's stakeholder feedback items: group-name title only · Active/Backlog/Done tabs · "+ Propose to backlog" as outline button in header · no chips beyond Urgent · avatar-only with `+N` overflow · warning-subtle yellow bg for unclaimed cards. | Any further Paul feedback. |
| **2 · Ticket detail** | NEW, built fresh during the pivot commit. Title with edit affordance · multi-assignee row · urgent flag · editable description · interleaved comments + notes + system events · Comment/Note compose tabs · Subscribe + Share-with-team + Invite-group actions · right-side meta sidebar. | Paul's first-pass feedback. |
| **3 · Notifications pane** | NEW + iterated this session per Paul's 6 follow-ups: tinted (primary-subtle) row bg replaces dot indicator · acknowledged rows plain white · click → ticket → auto-ack as the only ack path · capacity callout (limited list + auto-scroll + View-all) · trigger rules split into Defaults (subscriber-driven) vs Opt-in (team-wide blasts). | Final read-through. |

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
