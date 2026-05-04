# Session handoff — bu-coordination-board (Session 4)

**Date:** 2026-05-04 (evening)
**Last branch:** `feat/coord-board-routers-3c-20260504`
**Last commit:** `354d504` — `feat(coord-board): share + notification-kanban routers (PR 3c, v0.2.90)`
**Pushed:** ✅ (PR #221 — final router PR, awaiting merge)

The next session reads this handoff **plus** the prior one
(`bu-coordination-board-2026-05-04.md`) and the brief
(`docs/build/session-briefs/bu-coordination-board.md`, v0.4 on main —
all ADRs and field changes already absorbed).

---

## What shipped this session (10 PRs)

| # | PR | Atom | Version |
|---|---|---|---|
| 1 | #208 | 2c — `board-column.ts` service + seed-on-Group-create | 0.2.77 |
| 2 | #209 | 2d — `group-kanban.ts` service (read-only access) | 0.2.78 |
| 3 | #211 | 2e — share-with-team service (`request-group.ts`) | 0.2.79 |
| 4 | #213 | 2f — `notifications-kanban.ts` (lifecycle + fan-out) | 0.2.81–82 |
| 5 | #214 | 2g.1 — `Request.type` nullable (ADR-0010, Option B) | 0.2.83 |
| 6 | #216 | 2g.2 — drop claim trio, migrate to `Assignment` (ADR-0011) | 0.2.84–85 |
| 7 | #218 | 2g.3 — `RequestStatus` reframe (ADR-0012) | 0.2.86–87 |
| 8 | #219 | 3a — assignment + subscription routers | 0.2.88 |
| 9 | #220 | 3b — board-column + group-kanban routers | 0.2.89 |
| 10 | #221 (in-flight) | 3c — share + notification-kanban routers | 0.2.90 |

**Net delta:** 6 services + 6 routers + 3 ADRs + 3 breaking-change
migrations + ~50 unit/integration tests. Test count went from
1066 → 1215 across the session.

### ADRs added
- **0010** — `Request.type` nullable (Option B; the brief's "drop"
  was ambiguous, all 9 enum values still in use).
- **0011** — drop claim trio (`claimedByUserId` + `claimedAt` +
  `claimExpiresAt`); migrate to `Assignment`. Backfill in migration.
- **0012** — `RequestStatus` reframe. Mapping: `unclaimed→backlog`,
  `claimed→active`, `in_review→active`, `resolved→done`,
  `abandoned→abandoned`. Postgres enum-swap pattern.

---

## CRITICAL: pre-steps for the next session

### 1. Verify worktree + start fresh

```bash
git branch --show-current && git rev-parse --show-toplevel
```

Path must end in `.claude/worktrees/<slug>`. If you're picking up
PR #4 (Surface 1) — see "Next chunk" below — start a fresh
worktree:

```bash
git fetch origin
git worktree add .claude/worktrees/coord-board-surface1 \
  -b feat/coord-board-surface1-20260505 origin/main
cd .claude/worktrees/coord-board-surface1
cp /Users/paulwander/projects/gps-action/.env .
npm install
```

### 2. Confirm #221 has merged

```bash
gh pr view 221 --json state,mergedAt
```

If still open: at handoff time it was 4/5 green (Vercel rate-limited
only). Per Paul's established "merge anyway" precedent for Vercel
rate limits, manually merge:

```bash
gh pr ready 221 && gh pr merge 221 --squash --delete-branch
```

After merge: `git fetch origin && git pull --ff-only` on main +
remove the worktree:

```bash
git worktree remove .claude/worktrees/coord-board-routers-3c
git branch -D feat/coord-board-routers-3c-20260504
```

---

## Build-sequence status

| | What | Status |
|---|---|---|
| PR #1 | Schema + ADRs | ✅ #205 |
| PR #2a | assignments service | ✅ #206 |
| PR #2b | subscriptions service | ✅ #207 |
| PR #2c | board-column service | ✅ #208 |
| PR #2d | group-kanban service | ✅ #209 |
| PR #2e | request-group / share service | ✅ #211 |
| PR #2f | notifications-kanban service | ✅ #213 |
| PR #2g.1 | `Request.type` nullable | ✅ #214 |
| PR #2g.2 | drop claim trio | ✅ #216 |
| PR #2g.3 | `RequestStatus` reframe | ✅ #218 |
| PR #3a | assignment + subscription routers | ✅ #219 |
| PR #3b | board-column + group-kanban routers | ✅ #220 |
| **PR #3c** | share + notification-kanban routers | 🟢 **#221** (mergeable) |
| **PR #4** | **Surface 1 — kanban view** | **next; unblocked when #221 merges** |
| PR #5 | Surface 2 — ticket detail | depends on #4 |
| PR #6 | Surface 3 — notifications pane | depends on #4 |
| PR #7 | Polish (mobile, capacity callouts) | depends on #4–6 |
| PR #8 | Flag flip + admin enable | last |

PR #2 (services tier) is **fully complete end-to-end**. PR #3
(routers) is one merge away from done. PR #4 is the biggest
user-facing payoff still to ship.

---

## Next chunk — PR #4 (Surface 1, the kanban view)

Brief reference: `docs/build/session-briefs/bu-coordination-board.md`
sections "Surface 1 — Kanban board" + "App routes + components".

Routes to build:
- `app/board/page.tsx` — group-areas selector. Today's #192
  placeholder is replaced with the picker (only groups the user
  can access). Backed by `groupKanban.listMine`.
- `app/board/[groupSlug]/page.tsx` — the board view (Active tab
  default; Backlog / Done tabs). Backed by:
  - `groupKanban.bySlug` — load + access check.
  - `boardColumn.listForGroup` — column set.
  - A new query (likely `request.listKanbanForGroup` or similar —
    NOT yet built) — Requests in this group, joined to columns
    via `Request.columnId`. **Decide first** whether to add this
    to the existing `request` router or a new `board` router.
- `app/board/[groupSlug]/backlog/page.tsx`,
  `app/board/[groupSlug]/done/page.tsx` — list-default views.

Components (per brief):
- `components/board/Card.tsx` — title + kind glyph + multi-assignee
  avatar row (+N overflow) + priority chip + last-updated. Unclaimed
  cards = warning-subtle yellow background.
- `components/board/Column.tsx` — column header + droppable area.
- `components/board/MobileTagSwitcher.tsx` — mobile flat list with
  tag-switcher status pill.

Drag-reorder + status transitions: each card move calls a mutation
that updates `Request.columnId` + `Request.boardPosition`. **NOT yet
built** — needs a new `boardColumn.moveRequestTo` mutation or a
`board.moveCard` router. Decide on placement.

`coord_board_v1` flag is registered, prod OFF, dev OFF by default.
Surface 1 ships behind it — admin flip when ready.

### Open question to resolve before building Surface 1

**Card-move mutation placement.** Options:
- A) Extend `boardColumn` router (`moveCardTo({ requestId, columnId, boardPosition })`).
- B) Extend `request` router (`request.moveOnBoard({ requestId, columnId, boardPosition })`).
- C) New `board` router that aggregates moves + lifecycle transitions.

Brief lists `server/routers/board.ts` as a planned router but no
service has matched it yet. Likely (C) is cleanest — a new
`server/services/board.ts` that owns drag-reorder, status
transitions, and position math (per the brief services list, line
213 of v0.4 brief). Surface to Paul.

---

## What user has been driving (patterns to keep)

- **Splits big breaking-change atoms** — for 2g (3 PRs), for
  routers (3 PRs). Smaller PRs are easier to review.
- **"Merge anyway" on Vercel rate limits** — Vercel's daily
  preview-build quota is exhausted; the fix Paul considered
  (Ignored Build Step in Vercel project settings) hasn't
  shipped yet — see suggested script in earlier session
  conversation. For now, manual `gh pr merge 221 --squash` is
  authorized when 4/5 GH checks green.
- **Pacing**: one explicit "merge X and continue with Y" per
  chunk. Don't auto-merge other sessions' PRs without explicit
  authorization.
- **Option B locked for `requestType`** — kanban tickets carry
  `null`; legacy reviewer flows keep enum values. Already shipped
  (#214, ADR-0010). The brief is updated.

---

## Known gotchas

- **Worktree write trap.** Always verify the worktree path before
  `Write` calls — otherwise files land on the root checkout.
- **Prisma 7 DMMF strips `isRequired`/`default`/`uniqueFields`.**
  Schema sanity tests must read migration SQL via `readFileSync`
  (see `tests/unit/coord-board-schema.test.ts` for the pattern).
- **Postgres enum changes need the swap pattern.** Direct `DROP
  VALUE` isn't supported. See migration
  `20260504140000_request_status_reframe` for the canonical shape
  (CREATE _new + DROP DEFAULT + ALTER TABLE … TYPE … USING(CASE)
  + DROP TYPE old + RENAME _new + SET DEFAULT).
- **Stacked PRs need rebase after parent lands.** Each session
  PR rebased onto current main; force-push with `--force-with-lease`.
  Version-bump CI job catches collisions early — bump again on
  every rebase.
- **Vercel rate limit.** PR previews fail with "Deployment rate
  limited — retry in 24 hours". Production deploys may still work.
  Workarounds: `cloudflared tunnel --url http://localhost:3000`
  for instant sharing; or set up Vercel's Ignored Build Step to
  reduce preview noise.
- **`STATUS_LABELS` member-facing labels** kept their warm legacy
  copy (`backlog → 'new'`, `active → 'in discussion'`, `done →
  'done'`) per ADR-0012 — schema literals don't leak to the UI.
- **Service-level permission is opt-in.** Most services accept
  `actorId` and trust the caller for system-admin status. Group
  admin status lives in `getGroupAccess` (group-kanban service).
  Routers are the gate.

---

## Open PRs at handoff time

| PR | State | CI | Notes |
|---|---|---|---|
| **#221** | OPEN, draft | 4/5 (Vercel rate-limited) | 3c — final router. Manually merge per the precedent. |

---

## What I would do next if context allowed

1. **Land #221.** Manual squash-merge.
2. **Surface the card-move-mutation placement question.** Recommend
   option C (new `server/services/board.ts` + `server/routers/board.ts`)
   matching the brief's services + routers lists.
3. **Build PR #4 in stacked atoms** — same split pattern:
   - 4a: `server/services/board.ts` (drag-reorder + status
     transition + position math primitives) + tests.
   - 4b: `server/routers/board.ts` (router for the above) + tests.
   - 4c: `app/board/page.tsx` (group picker) — first user-visible
     change.
   - 4d: `app/board/[groupSlug]/page.tsx` + `Card.tsx` + `Column.tsx`
     (the actual board) — biggest payoff.
   - 4e: Backlog / Done tabs + `MobileTagSwitcher`.

Estimate: 4–6 hours of fresh-session work. Each chunk is reviewable
in isolation. PR #5 (Surface 2 — ticket detail) follows naturally
once the card-detail route exists.

## User notes

(None supplied for this handoff — Paul drove this session by saying
"merge X and continue" after each green CI. The Vercel-rate-limit
"merge anyway" pattern was established explicitly. Otherwise: keep
shipping in the same rhythm.)
