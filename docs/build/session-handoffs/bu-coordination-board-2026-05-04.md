# Session handoff — bu-coordination-board build sequence (Session 3)

**Date:** 2026-05-04
**Worktree at handoff:** `.claude/worktrees/coord-board-services/`
**Branch:** `feat/coord-board-services-20260504` (stacked on `feat/coord-board-schema-20260504`)
**Last commit:** `5f2c3c2` — `feat(coord-board): assignments service + auto-subscribe (build seq #2 first chunk)`
**Pushed:** ✅

The next session reads this handoff **plus** Session 2's handoff
(`bu-coordination-board-2026-05-03.md`) and the brief
(`docs/build/session-briefs/bu-coordination-board.md`, v0.4 on main).

---

## What shipped this session

### PR #205 — schema + ADRs (build seq #1) — MERGEABLE, all CI green

- 5 ADRs (0005-0009).
- Schema additions: 7 enums, 5 entities (Assignment, RequestGroup,
  GroupShareWorkflow, BoardColumn, RequestSubscription), field
  additions (Group.kind, Request.columnId/boardPosition,
  Comment.kind/source, Notification.lifecycle/reasonKind).
- Sync-write data migration (Comment.source = system where
  systemKind != null; Notification.lifecycle = acknowledged where
  readAt != null).
- `lead → admin` enum value rename (Tier-2 default #8).
- 28 sanity tests; v0.2.75.

**Pre-build mismatches surfaced + chosen path A (additive only):**

1. `RequestSubscription` was called "existing" in brief — actually
   new; introduced here.
2. `Request.urgency` already exists; reused instead of adding a
   parallel `isUrgent`.
3. Drop of `Request.claimedByUserId` deferred — every existing
   reader (`server/services/request.ts`, vetting/flag/kind_review
   surfaces) needs migrating first.
4. Drop of `Request.requestType` deferred — unclear semantics
   (does it mean drop column, drop enum, or only "kanban cards
   don't carry it"?). **Open question for next session to
   resolve with Paul.**
5. `RequestStatus` reframe deferred — breaking enum change with
   data migration; rides PR #2's drop-and-reframe atom.

### PR #206 — assignments service (build seq #2 first chunk) — DRAFT

- `server/services/assignments.ts` — `assignToRequest`,
  `unassign`, `listAssigneesForRequest`,
  `listActiveAssignmentsForUser`, `isAssigneeActive`.
- Auto-subscribe on assign (creates `RequestSubscription` with
  `source = auto_assignee`; preserves stronger existing source).
- Unassign deliberately leaves subscription in place (Tier-2
  default + Surface 2 Follow/Unfollow split).
- 11 integration tests, mocked Prisma + audit.
- v0.2.76.
- Stacked on PR #205. After #205 merges, rebase onto main.

---

## CRITICAL: Pre-steps for the next session

### 1. Verify worktree

```bash
git branch --show-current && git rev-parse --show-toplevel
```

Path must end in `.claude/worktrees/<slug>`.

### 2. Confirm #205 has merged + rebase #206

```bash
gh pr view 205 --json state,mergedAt
git fetch origin
git -C .claude/worktrees/coord-board-services checkout feat/coord-board-services-20260504
git rebase origin/main  # expect package.json conflict; pick the higher version
git push --force-with-lease
gh pr edit 206 --base main
```

If #205 is still open: check CI; either land it (auto-merge or
manual) or wait. #206 cannot rebase to `main` until #205 is in.

### 3. New worktree for the next chunk

The build sequence's PR #2 (services) is split into stacked atoms.
Pick one — recommendation: **subscriptions service next** (small,
needs `auto_author` rule added to author-create paths, exercises
the `RequestSubscription` shape end-to-end).

```bash
git worktree add .claude/worktrees/coord-board-subs -b feat/coord-board-subs-20260505 origin/main
cd .claude/worktrees/coord-board-subs
cp /Users/paulwander/projects/gps-action/.env .
npm install
```

---

## Suggested sequence — remaining services

Each is its own atomic PR. Stack on `main` once #205 + #206 land.

| # | Service | Scope | Depends |
|---|---|---|---|
| 2a | ✅ `assignments.ts` | Multi-assignee + auto-subscribe. **PR #206.** | #1 |
| 2b | `subscriptions.ts` | Explicit follow/unfollow + author auto-rule. Mention auto-rule from comment service. | #1 |
| 2c | `board-column.ts` | BoardColumn CRUD + reorder + service hook to seed defaults on Group create. Default sets in `shared/board-column-defaults.ts`. | #1 |
| 2d | `group-kanban.ts` | Group-flavoured queries for kanban (member's groups + access checks). Coexists with admin's group CRUD. | #1, 2c |
| 2e | `request-group.ts` | Share-with-team service (RequestGroup CRUD + GroupShareWorkflow CRUD + permission envelope). | #1, 2d |
| 2f | `notifications-kanban.ts` | Lifecycle transitions, reasonKind dispatch, fan-out. Extends existing `notification.ts` rather than replace. | #1, 2b |
| 2g | **Breaking changes** | Drop `Request.claimedByUserId`, drop `Request.requestType`, reframe `RequestStatus`. Update every consumer. **Needs Paul's confirm on requestType semantics first.** | all |

PR #3 (routers) starts after services. PR #4 (Surface 1 kanban)
is unblocked the moment routers exist.

---

## Open questions to resolve with Paul

1. **`Request.requestType` drop semantics.** Brief says "every
   ticket is just a ticket" → does the column drop entirely, or
   does it stay nullable (kanban cards have null type, vetting/
   flag/kind_review keep their type)? Resolution affects PR #2g
   and every downstream consumer.

2. **Default `BoardColumn` workflow names per `GroupKind`.** The
   handoff Session 2 listed defaults but flagged some are
   Writers-team-specific. Confirm with the actual pilot teams
   (Writers + IT) before locking in `shared/board-column-defaults.ts`.

3. **`groupTags` vs `RequestGroup` transition.** `Request.groupTags:
   String[]` (legacy informational join) coexists with the new
   `RequestGroup` join. When does `groupTags` retire? Probably
   alongside the kanban flag-flip (PR #8). Confirm.

4. **GroupShareWorkflow self-share.** Schema has unique
   `(sourceGroupId, targetGroupId)` but no constraint preventing
   a row where source = target. Service-layer enforce in PR 2e?
   Or DB-level CHECK in a follow-up?

---

## Known gotchas

- **Worktree write trap.** I wrote 5 ADRs to `/Users/paulwander/projects/gps-action/docs/adrs/` (the root checkout) instead of `.claude/worktrees/<slug>/docs/adrs/` early in this session. Recovered with `mv`. Always verify `Write` paths include the worktree prefix.
- **Prisma migrate dev needs DB.** The dev DB checksum-mismatched
  earlier migrations (someone edited migration files on main
  locally). Use `prisma migrate diff --from-schema X --to-schema Y --script`
  for safe migration generation without touching DB.
- **Prisma 7 DMMF strips defaults / isRequired / uniqueFields.**
  Tests that check those must read the migration SQL directly
  (string match) — see `tests/unit/coord-board-schema.test.ts`
  for the pattern. Enums work via runtime `Object.keys(<EnumName>)`.
- **`buildOrderBy` in admin/registry.ts is now generic.** Each
  entity binds its own orderBy shape. Future entries that add a
  field whose name conflicts with another entity's relation will
  hit the same issue I hit with `Group.kind` vs `Post.kind`.
- **Stacked PRs need rebase after parent merges.** PR #206 is
  stacked on #205; cannot merge to main until #205 lands and
  #206 rebases.
- **Each new service needs a metadata allow-list entry** (or
  full metadata) — `tests/unit/schema-metadata-coverage.test.ts`
  fails otherwise. The new entities (Assignment, etc.) are
  already allow-listed in PR #205.

---

## Open PRs at handoff time

| PR | State | Version | Notes |
|---|---|---|---|
| **#205** | OPEN, all CI green | v0.2.75 | Schema + ADRs. **Should be mergeable.** |
| **#206** | DRAFT, base is feat/coord-board-schema-20260504 | v0.2.76 | Assignments service. Rebase onto main when #205 merges. |

---

## What I would have done next if context allowed

Continue PR #2's chunks: subscriptions (2b) is next — small,
unblocks Surface 2's Follow/Unfollow gesture, and exercises the
RequestSubscription shape that assignments.ts already touches.

After 2b: BoardColumn (2c) — pure CRUD plus the seed-on-Group-
create service hook. That unblocks Surface 1 (the actual kanban
view), which is the biggest user-facing payoff.

Estimate: 4-5 hours to land 2b + 2c + 2d + 2e (the additive
services). Then 2-3 hours for 2f. Then 2g (breaking changes) —
hardest, needs Paul's resolution on requestType semantics first
and a careful rollout plan because vetting is in production.

## User notes

(None supplied for this handoff — Paul said "let's push on" after
PR #205 went green. No specific flags.)
