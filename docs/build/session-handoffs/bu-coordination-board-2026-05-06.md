# Session handoff — bu-coordination-board (post-Stream-B + propose button)

**Date:** 2026-05-06 (morning, after late-night 2026-05-05 work)
**Branch worked on:** `feat/coord-board-comment-thread-20260505` (#245),
`feat/board-propose-ticket-20260505` (#247) — **both merged**.
**Last commit on main:** `c6de848` — feat(board): + Propose to backlog
button + service + router (v0.2.118) (#247)
**Pushed to origin:** ✅ everything is on `main`. No live feature
branches owned by this session remain.

The next session reads this handoff **and** the brief at
`docs/build/session-briefs/bu-coordination-board.md`. The earlier
handoffs (`bu-coordination-board-2026-05-04c.md`, `bu-coordination-
board-2026-05-05.md`, `parallel-stream-b-comment-thread-2026-05-05.md`)
are the build-up; this is the freshest snapshot.

---

## What just shipped

| PR   | Version | Summary                                                                                                                        |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| #243 | 0.2.116 | **bu-kanban-event-config** — `KanbanEventConfig` table + admin toggles + `isEventEnabled()` read primitive. Unblocks atom 5d-3. |
| #244 | 0.2.111 | **Surface 3 — Notifications pane** under the existing Inbox tab.                                                               |
| #245 | 0.2.114 | **Surface 2 — Comment / Note thread** atoms 5d-1/2/4/5. Note visibility filter + compose router + `CommentNoteThread` + page wire. |
| #246 | 0.2.117 | **Surface 1 — 2-col gallery layout** for `/board`.                                                                             |
| #247 | 0.2.118 | **Surface 1 — `+ Propose to backlog`** button + `board.propose` mutation + service + ProposeTicketButton component.            |

**Net effect:** Surfaces 1, 2, 3 are now all live behind `coord_board_v1`.
Members can land on a board, propose a ticket, drag it across columns,
open it, edit title/body, assign-self, follow, comment, and (for the
originating team) post internal notes.

---

## What's still unbuilt against the brief

Lifted from `docs/build/session-briefs/bu-coordination-board.md`
"Scope" + the older 2026-05-05 handoff "Surface 1 polish gaps" —
minus what's now shipped above.

### High-signal, immediately actionable

- ❌ **Atom 5d-3 — system-event hook in the comment thread.** Now
  unblocked (Stream A merged). Wire `Comment.source = 'system'` rows
  into the kanban thread when:
  - column move / status change (in `server/services/board.ts` →
    `moveCard`, `setRequestStatus`).
  - urgent flip (no router yet — see "Risks" below).
  - assign-self / unassign-self (in `server/services/assignments.ts`).
  - title / body edit (in `server/services/board.ts` →
    `editTicketTitle`, `editTicketBody`).
  - share-to-team (in `server/services/request-group.ts` →
    `shareRequestToGroup`).

  Each emit goes through `isEventEnabled(eventKind)` first
  (`server/services/kanban-event-config.ts`); if `false`, no row.
  Default-on kinds (per the bu-kanban-event-config brief): `column_move`,
  `status_change`, `urgent_on`, `share_to_team`. Default-off:
  `urgent_off`, `assign_self`, `unassign_self`, `title_edit`,
  `body_edit`.

  The thread component (`components/board/CommentNoteThread.tsx`)
  already renders `source === 'system'` rows correctly — italic, info
  glyph, no avatar. No UI work, just hook + write the `Comment` row
  with `kind='comment'`, `source='system'`, `authorId=actorId`,
  `body=<phrasing>`.

  Phrasing question is unresolved — see "Open questions" below.

### Surface-1 polish (lower priority, per brief)

- ❌ **Recruitment → Preparation auto-advance** on first self-assign
  (Tier-2 default #3). Tied to `assignToRequest`; ~10 lines of service
  glue + a column-name lookup.
- ❌ **Kind glyphs on cards** — Card.tsx currently shows kind
  `displayName` text but not the glyph. The PostKind table already
  carries `icon` slugs.
- ❌ **MobileTagSwitcher** — placeholder component name in the brief;
  no component file exists yet.

### Other brief items (not yet started)

- ❌ **5e — Share-with-team picker UI.** The router (`share.toGroup`)
  + service (`request-group.ts`) are shipped. No UI wraps them yet —
  Surface 2 has no "Share with team" button.
- ❌ **PR #7 — Mobile** (responsive board, tag-switcher, reflow).
- ❌ **PR #8 — Flag flip** (`coord_board_v1` ON in prod for Writers + IT
  pilot teams).

### Definition-of-done items (from brief)

- ❌ Non-technical walkthrough doc updated to match shipped UX
  (`docs/product/coordination-board-overview.md`).
- ❌ At least one Writer + one IT-team member used the board
  end-to-end without intervention (pilot acceptance gate before flag
  flip).

---

## CRITICAL: Pre-steps for the next session

1. **Worktree from `origin/main`.** The brief is large but the next
   atom (5d-3) is small (~120 lines + tests). One worktree, one PR,
   single commit. Suggested branch:
   `feat/coord-board-system-event-hook-<YYYYMMDD>`.

2. **Check a stale tsconfig** in the **root** checkout. As of
   2026-05-06 morning, `git status` from `/Users/paulwander/projects/
   gps-action` showed `tsconfig.json` modified locally with `jsx:
   "react-jsx"` (vs `"preserve"` on main). Source unknown — possibly
   an editor extension. **Don't carry it into a feature branch.**
   Worktrees branch from `origin/main` so they're clean; just don't
   `git add tsconfig.json` from the root.

3. **No rebase needed** if you start fresh from `origin/main` — main
   was at `c6de848` at handoff time.

---

## Suggested next-session sequence

Single PR atom — atom **5d-3**.

1. **Helper module** `server/services/kanban-system-events.ts` — one
   `emitSystemComment({ requestId, eventKind, body, actorId })` that
   gates on `isEventEnabled(eventKind)` and writes the `Comment` row
   (`kind='comment'`, `source='system'`). Keep phrasing in this module
   so all the call-sites stay one-liners.

2. **Wire call-sites** in services:
   - `board.ts/moveCard` → emit `column_move` with the from→to column
     names. (Originating only — shared-group moves don't change global
     status.) When `newStatus !== before.status`, also emit
     `status_change`.
   - `board.ts/setRequestStatus` → emit `status_change`.
   - `board.ts/editTicketTitle` → emit `title_edit`.
   - `board.ts/editTicketBody` → emit `body_edit`.
   - `assignments.ts/assignToRequest` → emit `assign_self` (only when
     `actorId === userId`).
   - `assignments.ts/unassign` → emit `unassign_self` (same condition).
   - `request-group.ts/shareRequestToGroup` → emit `share_to_team`.
   - **`urgent_on` / `urgent_off`** — ⚠️ no urgent-flip mutation
     exists yet. See "Open questions" below before wiring.

3. **Tests.** One unit test per call-site verifying:
   - Row is written when `isEventEnabled` returns true.
   - Row is **not** written when `isEventEnabled` returns false.
   - Row carries the right `eventKind` phrasing.

   Mock `isEventEnabled` directly. Keep tests at the service layer; the
   wired call-sites are already covered by their own integration tests.

4. **Smoke** — manually flip a card and check the thread on Surface 2.

5. **Version bump → 0.2.119** (or whatever's next on main at PR time).
   Follow the post-merge protocol on the way out.

Each atom is one commit per CLAUDE.md "commit per logical chunk."

---

## Known gotchas / risks

- **No urgent-flip mutation exists.** I grepped `server/routers/` —
  there's no `setUrgent` or `toggleUrgent`. The brief calls for it
  (Surface 2: "Urgent flag (per `Request.isUrgent`)"), the schema has
  `Request.urgency` and `RequestGroup.isUrgent`, but the surface to
  flip them isn't built. **Decision the next session needs:** either
  (a) build the urgent-flip mutation as part of 5d-3 (scope creep), or
  (b) ship 5d-3 without the urgent_on/off wiring and leave it as a
  follow-up. Recommend (b) — keep 5d-3 tight, file an issue for
  urgent-flip as its own atom. Surface this to Paul before starting.

- **Phrasing of system-event bodies is unresolved.** Examples from the
  brief: "Sharon moved this to Preparation", "Maya marked it Urgent".
  Concrete copy doesn't live in the brief. Either pick conservative
  phrasing in the helper module (with a comment block listing the
  rules), or surface as a Tier-2-default-equivalent question. The
  brief's "honest copy" rule applies — past tense, named actor.

- **No backfill** — toggling an event on doesn't rewrite history.
  This is intentional (per ADR-0014); flag it in the helper module
  doc-comment.

- **Cross-group note visibility was carefully gated** in
  `comment-thread.ts/listForKanbanTicket`. System-event rows have
  `kind='comment'` (not `note`), so they pass through the visibility
  filter to **everyone** linked to the ticket — including shared
  teams. That's intentional for things like `column_move` (everyone
  should see "moved to Review") but **odd for `title_edit` /
  `body_edit`** if the originating team meant the edit privately.
  Default-off mitigates; flag this to Paul if defaults change.

- **`coord_board_v1` is still prod-OFF.** Anything 5d-3 writes is
  invisible to prod users until the flag flips. Dev-mode demo is
  populated by `prisma/seed.ts` + `scripts/seed.ts`.

---

## Open questions (surface to Paul before/at PR time)

1. Should atom 5d-3 ship with or without the urgent-flip wiring?
   (Mutation doesn't exist yet.) **Recommendation: without.**
2. Phrasing rules for system-event bodies — past tense, actor name,
   target. Sample for review:
   - column_move → `"<Actor> moved this to <newColumn>."`
   - status_change → `"<Actor> set status to <newStatus>."`
   - urgent_on → `"<Actor> marked this Urgent."`
   - title_edit → `"<Actor> renamed this ticket."`
   - body_edit → `"<Actor> updated the description."`
   - share_to_team → `"<Actor> shared this with <targetTeam>."`
   - assign_self → `"<Actor> claimed this ticket."`
   - unassign_self → `"<Actor> unclaimed this ticket."`

---

## Open PRs at handoff time

None owned by this session. Open PRs in the repo are all Dependabot
bumps (#197–#210) — not blocking the board work.

---

## What I would have done next if context allowed

Atom 5d-3 with the conservative scope: one helper, eight wired
call-sites (all but urgent-flip), eight unit tests, default phrasing
listed above. ~150 LoC + ~200 LoC tests. One PR, ~30 minutes of
focused work, version bump, auto-merge on green, post-merge cleanup.

After that the natural next steps are kind glyphs on cards (~30 min),
then Recruitment → Preparation auto-advance (~30 min — hooks into
`assignToRequest`), then a Paul-call on whether to start mobile or do
the share-with-team picker (5e) first.
