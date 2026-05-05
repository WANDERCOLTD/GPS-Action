# Parallel session handoff — Stream B: 5d comment / note thread (minus system-event hook)

**Date:** 2026-05-05
**For:** A new CC session running in parallel with the main session.
**Reads:** `docs/build/session-briefs/bu-coordination-board.md` (the
parent brief, see "Surfaces → Surface 2 — Ticket detail" + "Tests
required" + "Companion scenarios → SCN-33").

This handoff scopes the work for one parallel stream. Two other
streams (A: kanban-event-config admin table; C: notifications pane
UI) ship simultaneously and are independent.

---

## Mission

Ship atoms **5d-1, 5d-2, 5d-4, 5d-5** of `bu-coordination-board`.
Atom 5d-3 (the system-event hook) is **explicitly out of scope** —
it depends on `bu-kanban-event-config` (Stream A) landing first.

End state after this stream: any team member opening a kanban
ticket sees the interleaved Comment + Note thread with a working
compose box. System events (column moves, urgent flips) are NOT
yet appearing — that's atom 5d-3 in a follow-up after Stream A.

## Worktree + branch

```bash
cd /Users/paulwander/projects/gps-action
git fetch origin
git worktree add .claude/worktrees/coord-board-5d -b feat/coord-board-comment-thread-20260506 origin/main
cd .claude/worktrees/coord-board-5d
npm install
git branch --show-current && git rev-parse --show-toplevel  # verify
```

(Use the date the session actually starts.)

## Build list (4 atoms, 4 stacked PRs)

### 5d-1 — read query

`server/services/comment-thread.ts` (new):

- `listForKanbanTicket({ requestId, viewerGroupId, viewerId })` —
  returns interleaved `Comment` rows ordered by `createdAt`.
- **Visibility filter (critical):** `Comment.kind = 'note'` rows
  are visible only to members of the *originating* group. Cross-team
  viewers (members of a shared group) do NOT see notes.
- Returns shape includes author display name + avatar URL +
  `kind` + `source` so the component can branch on render style.
- Unit tests for the visibility filter — at least the cases:
  originating-group viewer sees notes ✓, shared-group viewer sees
  comments only ✓, non-member sees nothing (via gate above).

Schema is already on `main` from PR #205 (`Comment.kind` + `.source`
enums exist). No migration needed.

### 5d-2 — compose mutations

`server/routers/comment-thread.ts` (new) or extend the existing
`comment` router if it can be made kanban-aware:

- `postComment({ requestId, body })` — writes
  `Comment.kind='comment'`, `source='human'`. Subscribes the author
  via existing subscription auto-rules.
- `postNote({ requestId, body })` — writes `Comment.kind='note'`,
  `source='human'`. Same subscription rule.

Server actions `postCommentAction` + `postNoteAction` in
`app/board/[groupSlug]/[ticketId]/actions.ts` (extend existing
file). `revalidatePath` the ticket route on success.

Permission gate: viewer must be a member of any linked group (or
admin).

### 5d-4 — `CommentNoteThread.tsx` component

`components/board/CommentNoteThread.tsx` (client component):

- Renders the thread sorted oldest-first.
- Comment rows: standard look (avatar + name + timestamp + body).
- Note rows: yellow tint background (`--colour-warning-subtle`),
  small "Note" label, otherwise same shape.
- System-event rows (none yet, but render path must exist for 5d-3):
  smaller, italic, no avatar, prefix glyph (info icon).
- Compose box at the bottom with two tabs: "Comment" (default) /
  "Note". Submit via the matching server action.
- Inline error if the action returns `{ ok: false }`.

### 5d-5 — page wire-up

`app/board/[groupSlug]/[ticketId]/page.tsx`:

- Insert `<CommentNoteThread>` below the assignees panel and above
  the meta footer.
- Server-side fetch of the thread via the new service; pass as a
  prop.

## Tests required (per the parent brief)

- Service: visibility filter (the integration-level test the brief
  calls out: "Cross-group comment visibility respects `Comment.kind`
  (notes hidden from non-team-members)")
- Router: permission gate
- Component: render branches (comment / note / system-event row),
  compose tab switch
- E2E (optional v1): post a comment, see it appear; post a note as
  team member A, verify team member B (cross-group viewer) doesn't
  see it.

## Out of scope

- **Atom 5d-3 (system-event hook).** Lands in a separate PR once
  `bu-kanban-event-config` is merged.
- Editing or deleting comments / notes
- Reactions on comments (already exists for posts; out for kanban v1)
- @mention parsing in compose (the parser exists in
  `server/services/subscriptions.ts` for auto-subscribe; UI for
  rendering @mentions is later)

## Pre-merge checklist

- [ ] `npm run typecheck && npm run lint && npm test` clean
- [ ] Each atom is its own PR (4 stacked PRs total)
- [ ] Version bumped on each (PATCH minimum)
- [ ] CSS uses **only existing** `--colour-*` tokens — see
      `styles/tokens.css` for the canonical list. Do NOT invent
      `--colour-X-strong` or similar (we just shipped #238 cleaning
      up exactly that class of bug).
- [ ] `coord_board_v1` flag stays as-is (currently 100% / globally
      enabled in dev; prod still OFF)

## Open questions for this stream

None blocking. The system-event question is Stream A's problem.

## What success looks like

A team member opens `/board/writers/[ticketId]`, scrolls past the
assignees panel, sees the existing thread (probably empty for seeded
demo data), types a comment in the box, hits Send, and sees it
appear immediately. Switches to the Note tab, types an internal note,
sees the yellow-tinted row appear. A different team in a shared
context sees the comment but not the note.
