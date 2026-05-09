---
slug: bu-ticket-view-fixes
status: ready
phase: 2
priority: high
note: 'Bundles 15 tester-feedback items on the ticket detail view + backlog → move-to-active flow. All directionally locked — defaults applied for Q1 (item 4 unshare permissions), Q2 (item 14 schema), and Q5 (item 10 vs D052 scope). Companion briefs: bu-ticket-detail-relayout (item 6, status: needs-design) and a future palette brief (item 16).'
---

# SESSION BRIEF · bu-ticket-view-fixes — coord-board ticket UX patch bundle

_Author: Paul + Claude · Created: 2026-05-09_
_Type: bundled UX-debt sweep across the ticket detail view (`/board/[groupSlug]/[ticketId]`) and the backlog triage flow (`/board/[groupSlug]/backlog`). All items derive from the 2026-05-09 tester walk-through. Scope is narrow on purpose — relayout (item 6) and palette (item 16) are split out._

---

## 1 · Business Analyst — why this matters

### The scenario in plain language

It's Saturday morning. Bette (Writers coordinator) opens `/board/writers/backlog` after Friday-night activity — there are 30 unread tickets in the backlog, half are duplicates of things already on the active board, a few are urgent, the rest can wait. She wants to triage the lot in fifteen minutes: open each, decide column or kill, move on.

Today, every one of those decisions costs her unnecessary friction:

- She clicks into a ticket, can't find "Assign to me" or "Unassign" because they live at the top of the page rather than in the Assignees panel where she's already looking.
- She tries to unfollow a ticket she's not interested in, and finds herself silently unassigned from it. (Bug — not the design.)
- She picks a destination column for a backlog ticket, and the modal closes, the page navigates to the board, and now she has to click back to `/backlog` to deal with the next 29.
- She wants to delete a duplicate ticket — there's no Delete option, just "Send to backlog" or "Mark done."
- She sees "updated 3d ago" on a ticket that had a comment posted today.
- She wonders why nobody's using the FAB and realises the right-hand half ("paste a link") is so visually fused with the left half ("create a post") that testers don't know it's two buttons.

A second moment, same morning: someone on Bette's Writers team has been pulled into a ticket the Photographers team shared in error — the request really only needs photo coverage. The Writers member opens the ticket, decides "this isn't ours to action", taps the `×` next to "Writers" in the Shared-With strip, confirms, and the ticket vanishes — they land back on their own Writers backlog (or active board, or Done, depending on the ticket's lifecycle state at the moment of unshare). No 403, no scary error, just a quiet toast: "This ticket is no longer shared with your team." That's the receiving-team-leaves-the-share path; it has to feel as gentle as the originating-team-revokes path.

This brief sweeps the lot. None of it is hard individually; the value is doing it as a cluster so the next tester walk-through reads as "tight" rather than "fifteen papercuts."

### What shipping this changes

| Before | After |
| --- | --- |
| Triaging 30 backlog tickets means 30 page navigations | Triage stays on `/backlog`; the modal closes and the row disappears optimistically |
| Assignment controls live at the top of the page; testers can't find them | Assignment controls live inside the Assignees panel |
| Unfollow sometimes also unassigns (intermittent) | Unfollow is button-isolated; regression test guards it |
| "Updated 3d ago" lies when there's been comment activity today | "Last activity" tracks all activity; honest copy, honest semantics |
| Delete a stale or duplicate ticket → not possible without admin DB access | Originator or admin can hard-delete a ticket from the lifecycle controls |
| Edit own typo in a comment → nope | Author can edit / hard-delete own comments and notes; "edited" marker shown |
| FAB right-half discoverability is poor | Captions, tooltips, and a stronger divider make the split pill obviously two buttons |

### User stories

| As a … | I want to … | So that … |
| --- | --- | --- |
| Coordinator | Find Assign / Unassign in the same place I see who's assigned | I don't hunt around the page header for the controls |
| Coordinator | Trust that Unfollow doesn't change my assignment | The button does what it says, no surprise side effects |
| Coordinator | Triage the backlog without losing my place | I can dispose of 30 tickets in a sitting |
| Coordinator | Delete duplicates / stale tickets | The board shows real signal, not noise |
| Receiving-team member | Unshare a ticket that isn't actually relevant to my team | I can leave the share without escalating to an admin or pinging the originator |
| Author | Edit and delete my own comments and notes | I can fix typos and retract things I shouldn't have said |
| Reader | See newest comments first | I get the latest update without scrolling past stale chatter |
| Anyone | See an honest "last activity" timestamp | I know whether this ticket is alive or rotting |
| Anyone | Discover the "paste a link" half of the FAB | I use the 4-tap link-share flow instead of the long compose path |

### Success criteria

- Tester walk-through after ship surfaces zero "I couldn't find X" feedback on the ticket detail view.
- Bette can triage a 30-ticket backlog without leaving `/backlog`.
- The 2026-05-09 unfollow/unassign bug does not recur (regression test in CI).
- "Last activity" matches the user's intuition on every ticket they spot-check.

### What this is NOT

- **Not a relayout.** Item 6 (right-rail relayout — header buttons + Assignees + Shared-With → right rail; Description directly under title) goes to a separate brief `bu-ticket-detail-relayout` (status: **needs-design** — Figma round before implementation; mobile breakpoints cascade). Touching layout here invites scope creep and breaks both briefs.
- **Not a palette change.** Item 16 (pastel palette for the board, replacing "shades of magnolia") is a separate brief, scope TBD. Note that the ticket-view modal already has differentiated columns — the testers' complaint is about a different surface (the kanban itself), and that's where the palette work belongs.
- **Not a permissions overhaul.** Sysadmin still does anything. Originator is a new explicit privilege only on items 13 (delete) and arguably 4 (unshare). Group-admin self-serve UX (group-scoped management at `/board/<slug>/settings`) stays out — that's the territory of `bu-admin-group-membership`'s follow-up.
- **Not a soft-delete migration.** Comment delete (item 10) and ticket delete (item 13) are **hard deletes** by direction. If audit or recovery becomes a real ask, a v2 brief introduces soft-delete; this one ships hard.

---

## 2 · Tech Lead — how to build it

### Surfaces touched

- `app/board/[groupSlug]/[ticketId]/page.tsx` — the ticket detail view (items 1–3, 4–5, 7–13, 14)
- `app/board/[groupSlug]/backlog/page.tsx` — backlog triage flow (item 17)
- `components/board/IntentFab*.tsx` — FAB pill (item 15)
- `server/services/board.ts` — ticket detail mutations + read shape (items 1–4, 10, 13, 14)
- `server/routers/board.ts` (or per-existing wiring) — new mutations / extended inputs
- `prisma/schema.prisma` — **only if item 14 picks the new-column path** (ADR required first; see Open questions)

### Layer boundaries (per the ESLint rule)

- Server-side mutations (`assignSelf`, `unassignSelf`, `follow`, `unfollow`, `unshareTeam`, `editComment`, `deleteComment`, `deleteTicket`, `bumpLastActivity`) live in `server/services/board.ts` and are exposed via `server/routers/board.ts`.
- The detail page (View, in `/app`) imports types only from `/server/routers/board`.
- No new code in `/components` reaches into `/server/db` — the boundary plugin will block it; route via the service.

### Item-by-item plan

#### Group A — Assignees & Following (items 1, 2, 3)

**1 — Move Assign / Unassign-from-me into the Assignees panel.**
Today the Assign/Unassign buttons live in the page header next to Follow/Unfollow as a side-by-side pair (see `components/board/BoardActionPair.tsx` lines 78–107 — both buttons are rendered inside the same inline-flex `div` with `gap: var(--space-2)`). Move Assign/Unassign into the Assignees panel UI as the first row above the avatar list ("You" row with an Assign-to-me button when not assigned, an Unassign button when assigned). Symmetric pattern with the existing Following control.

**This is also the structural fix for Item 2 ("Unfollow sometimes Unassigns").** The two buttons sit side-by-side in `BoardActionPair.tsx`, so a fat-fingered tap on small viewports can land on the neighbour. Separating them into different surfaces (Assignees panel vs. Following control) makes the misclick unreproducible — no shared layout, no neighbour to hit.

**2 — Regression test: `Unfollow leaves assigned untouched`.**
Reduced from "fix the bug + useRef refactor" to a ratchet-only addition. Reading `BoardActionPair.tsx` and `app/board/[groupSlug]/[ticketId]/actions.ts` confirmed the server actions and service layer are clean (no cross-action state), and `useTransition` already disables both buttons during in-flight clicks (`disabled={isPending}` on lines 90 and 101 of `BoardActionPair.tsx`). The intermittent symptom is layout-induced (Item 1's side-by-side proximity), not closure-induced. The useRef refactor proposal is dropped.

What this item ships:

- A regression test at `tests/unit/board-action-pair.test.tsx` that asserts: with `assigned=true, following=true`, clicking the follow button (which renders as "Unfollow") only invokes the unfollow action, never the unassign action.
- The test guards against future regressions if the layout or action wiring is ever revisited.

Symmetry rules (for reference — confirmed by Paul 2026-05-09):

| Action | Side effect |
| --- | --- |
| Assign-to-me | **Also Follows** (intentional asymmetry) |
| Unassign-from-me | Does **not** Unfollow |
| Follow | Does **not** Assign |
| Unfollow | Does **not** Unassign |

**3 — Surface the asymmetric Assign↔Follow coupling.**
The "Assign-to-me also follows" rule is non-obvious and currently silent. Surface via:

- `title` attribute on the Assign-to-me button: `"Also follows this ticket"`
- A first-use coachmark on the Assignees panel (one-shot, dismissed by tap; persisted via `localStorage` keyed by user id — not a server-side flag, this is UX polish not data)

Coachmark uses the existing tooltip primitive if there is one; if not, a lightweight inline hint card is fine.

#### Group B — Sharing (items 4, 5)

**4 — Unshare from a team.**
Add an `×` on each team pill in the Shared-With strip. Tapping opens a confirmation modal: "Unshare from <Team>?" → Cancel / Unshare. Server: `board.unshareTicketFromTeam({ ticketId, groupId })`. Audit-logs the unshare.

> **Sharing (unchanged):** Admins and members of the **originating team** can share a ticket with another team.
>
> **Unsharing (new):** Admins and members of **both teams** can unshare. The originating team's members can revoke the share; the receiving team's members can effectively "leave" the share by unsharing themselves out of it. In either direction, after unshare the ticket becomes unreachable for the receiving team's members.
>
> **No error on self-unshare:** When a receiving-team member triggers unshare-from-our-team, do not surface an error. The action is legitimate ("leaving the share") and idempotent.
>
> **Auto-navigate on unshare-while-open:** When the unshare commits, any receiving-team member who currently has that ticket open on their screen must auto-navigate back to their **own team's** corresponding list — Backlog, Board (active), or Done — depending on the ticket's lifecycle state at the moment of unsharing. Implementation hint: this is a server-pushed redirect (or the next route revalidation detecting the user no longer has access) that moves them to `/board/<their-own-team-slug>/<lifecycle-list>`. Do NOT show a 403 / unauthorized page; navigate gracefully with a brief toast ("This ticket is no longer shared with your team.").

**5 — Drop the originating team from the Shared-With strip.**
The originating team is already shown in the breadcrumb / page chrome (e.g. "Writers board" header). Showing it again in the Shared-With strip is redundant noise.

- Default: drop it.
- Optional fallback: keep it but render with a "home" icon (lucide `home` is reserved for the Feed tab — substitute `flag` or `anchor` if a marker is wanted; **check the glyph register in `docs/product/design-philosophy.md` before introducing**).

Recommend "drop it" — simpler, less to explain. The breadcrumb is the source of truth for context.

#### Group C — Discussion (items 7, 8, 9, 10, 11, 12)

**7 — Description editor: visible Save / Cancel buttons.**
Currently Ctrl+Enter is the only save path. Add primary `Save` and secondary `Cancel` buttons inside the editor. Ctrl+Enter remains as a keyboard accelerator. Cancel reverts the edit and exits the editor. Same affordance shipped on `Request.body` editing.

**8 — Discussion tabs (Comments / Log).**
Today: one stacked stream of comments + system events; the activity log scales with time and pushes the typed comments down. Replace with a tabbed UI:

- **Comments** tab — default. Shows user-authored comments + notes only.
- **Log** tab — shows system events (status change, assignment, share/unshare). Count badge on the tab header (`Log · 12`).

Reuse `D014a` system-events styling. The split is purely a UI concern; no schema change.

**9 — Comment vs Note toggle styled as tabs (not buttons).**
Inside the compose box, the Comment / Note picker becomes a tab control, mirroring item 8's pattern. Same component if practical.

**10 — Edit + delete own comments/notes.**
- **Author only** (no time window).
- **Hard delete** per Paul 2026-05-09 — soft delete deferred to v2.
- Edited comments display an "edited" marker (small caption, no full timestamp; tooltip can show the edit time).
- Server: `board.editComment({ commentId, body })` and `board.deleteComment({ commentId })`. Both gate on `comment.authorId === currentUser.id`.
- **Scope (resolved):** Edit and delete are scoped to **Request comments only** (board tickets). Post comments remain immutable per D052. The author-only / no-time-window / hard-delete rules apply only to request comments. ADR clarifying scope at `docs/adrs/0016-comment-edit-delete-scope.md` (ADR-0016, decision-log entry **D082**). The `Comment` model is polymorphic via two nullable FKs (`postId` / `requestId`) — **not** a `targetType` discriminator string. The gate is therefore `requestId !== null` (equivalently `postId === null`), enforced at both router and service layers for defence-in-depth. Per ADR-0016, edit/delete on Request comments reuses the existing `AuditLog` table with new action codes `kanban_comment.edit` / `kanban_comment.delete` (and `.note` variants for the note sub-type). System-authored rows (`source !== 'human'`) are foreclosed from edit/delete by construction. The new comment mutations land in `server/routers/comment-thread.ts` (kanban router), explicitly **not** `server/routers/comment.ts` (post-discussion router).

**11 — Compose box at the top of the discussion, collapsed by default.**
Replace the always-open compose textarea with a collapsed "Add a comment or note" pill. Tap expands into the full editor (Comment/Note tabs from #9, body field, Save/Cancel). Saves vertical space; prevents accidental focus.

**12 — Newest comment at the top.**
Reverse the current oldest-first ordering. Per Paul 2026-05-09: "coordination context is 'what's the latest update', not 'read the whole conversation'." Pairs naturally with #11 (compose at top → first reply lands directly below it).

The Log tab (item 8) follows the same newest-first rule for symmetry.

#### Group D — Lifecycle (item 13)

**13 — Delete option on the lifecycle control.**
Today the lifecycle control offers `Send to backlog` / `Mark done` / (currently maybe `Active`). Add a destructive `Delete` option (hard delete).

- **Permissions:** originator (the user whose `Request.createdById` matches) **OR** admin. Receiving-team members and uninvolved members do not see the option.
- Confirmation modal: "Delete this ticket? This can't be undone."
- Server: `board.deleteTicket({ ticketId })`. Cascades:
  - Hard-delete comments and notes (FK cascade in schema, or explicit deletion in service).
  - Hard-delete `RequestGroup` shares, `RequestAssignment`, `RequestFollow` rows.
  - Audit log entry: `request_deleted` with the originator/admin id and the ticket title for forensic recovery.
- Cancel-as-status (a separate "this didn't pan out" terminal state) is **out of scope** — explicitly deferred.

#### Group E — Last activity (item 14)

**14 — `Last activity` tracks all activity, not just description edits.**

> **Schema (resolved):** Add a new `lastActivityAt` column to the `Request` model (DateTime, indexed). What we colloquially call a "ticket" on the kanban board is canonically a `Request` row with `type = null` per ADR-0010. The new column lives on `Request.lastActivityAt`. Existing `Request.lastHeartbeatAt` (ADR-0011) sets precedent for multiple recency timestamps with different jobs on the same model. `updatedAt` retains its existing Prisma row-level auto-bump semantics. The displayed label is renamed to **'Last activity'**. Bumped on: comment posted, note posted, lifecycle status change, assignee change, share/unshare. ADR at `docs/adrs/0015-ticket-last-activity-at.md` (ADR-0015, decision-log entry **D081**).

Bumps on:

- New comment or note (item 10's edit also bumps; delete does NOT bump — deleting shouldn't make a ticket look "fresh").
- Status change (`backlog` ↔ `active` ↔ `done`).
- Assignment change (assign / unassign).
- Share / unshare (item 4).
- Description edit (today's behaviour, retained).

Rename the label from `Updated` to **`Last activity`** in the UI (honest copy per CLAUDE.md voice notes). The `RelativeTime` component renders the same way; only the prefix changes.

Service helper: `bumpLastActivity(tx, ticketId)` called inside each mutation transaction. Don't sprinkle `prisma.request.update` calls — one helper, one source of truth.

#### Group F — FAB clarity (item 15)

**15 — Make the split pill obviously two buttons.**

DOMRect verified 2026-05-09: both halves render correctly. The fix is **visual discoverability**, not layout. Apply all four:

- `title` attribute on each half: `"Create a post"` (left) / `"Paste a link"` (right). Desktop tooltip; assistive-tech also benefits.
- Visible captions under each glyph: `"Post"` and `"Paste"`. Mobile/PWA has no hover, so caption is the primary affordance.
- Bump the `border-left` divider opacity from 25% → ~50% (use `color-mix(in oklch, currentColor 50%, transparent)` per the global CSS-alpha rule). Currently the two halves blend into one visual unit.
- Optional: swap the right glyph if `Link` reads better than `ClipboardPaste`. **Check the glyph register in `docs/product/design-philosophy.md` first** — `clipboard-paste` is the registered glyph for this concept; changing it would either retire `clipboard-paste` or violate the one-concept-one-glyph rule. Recommend leaving it as `clipboard-paste` and relying on the caption to disambiguate.

#### Group G — Backlog → Move-to-active flow (item 17)

**17 — Stay on `/backlog` after column pick.**

Today: pick a column → modal closes → `router.push('/board/<slug>')`. Coordinator wants: pick a column → modal closes → ticket vanishes from the backlog list optimistically → **stay on `/backlog`**.

Implementation:

- Mutation: `board.moveTicketToColumn({ ticketId, columnId })` (likely already exists).
- `onMutate` — remove the ticket from the cached `listBacklogTickets` query data optimistically.
- `onError` — roll the cache back, show error toast.
- `onSettled` — invalidate the query (defensive resync).
- **Delete the post-success `router.push`** in the modal's success handler. That's the only line that needs changing for the navigation behaviour; everything else is in the cache mechanics.
- Toast on success: `"Moved to <Column>"` with an inline `View →` link that takes the user to `/board/<slug>` if they want to see it land. Voice: Sharon-warmth (per CLAUDE.md), so a soft confirmation, not "Success!" or "Operation complete."

### Schema impact

| Item | Change | Migration | ADR? |
| --- | --- | --- | --- |
| 1, 3 | None (UI-only) | — | — |
| 2 | None (bug fix) | — | — |
| 4 | None (uses existing `RequestGroup`) | — | — |
| 5 | None (UI-only) | — | — |
| 7, 8, 9, 11, 12 | None (UI-only) | — | — |
| 10 | None — no new tables; reuse `AuditLog` for edit/delete events (action codes `kanban_comment.edit` / `kanban_comment.delete` + `.note` variants per ADR-0016). Delete is `Comment` row deletion (cascade rules already exist). | — | YES — `docs/adrs/0016-comment-edit-delete-scope.md` (ADR-0016, D082) |
| 13 | None (hard delete on existing rows; cascades exist) | — | — |
| **14** | **`Request.lastActivityAt: DateTime` (indexed; resolved per Q2)** | **Forward-only; back-fill from `createdAt` via `COALESCE`** | **YES — `docs/adrs/0015-ticket-last-activity-at.md` (ADR-0015, D081)** |
| 15 | None (CSS + JSX) | — | — |
| 17 | None (cache behaviour change + UI) | — | — |

### Tests required

- **Service unit tests** (in `server/services/board.test.ts`):
  - Item 2 regression: 4 tests for button isolation (assign↔follow asymmetry).
  - Item 4: unshare permission gate (originating-team member success; receiving-team member success — "leave the share"; admin success; uninvolved-member-of-neither-team forbidden); idempotent — repeated unshare does not error.
  - Item 4: auto-navigate path — receiving-team member unshares while the ticket is open; assert redirect to `/board/<own-team-slug>/<lifecycle-list>` (one test per lifecycle state: backlog / active / done); never a 403.
  - Item 10: edit gate (author success; non-author forbidden); delete gate (same).
  - Item 13: ticket-delete gate (originator success; admin success; uninvolved-member forbidden); cascade behaviour (comments/notes/shares/assignments removed).
  - Item 14: every mutation that should bump `lastActivityAt` does; `deleteComment` does NOT bump.
- **Integration test** (tRPC): backlog `moveTicketToColumn` flow — optimistic cache removal + rollback on error.
- **Component test**: discussion-tabs (Comments default; Log shows count badge); compose-box collapsed-by-default state.
- **Manual click-through**: full triage flow for 5+ tickets on `/backlog`; FAB caption visible on mobile viewport (375px).

### Test discipline

**Static state-coverage tests for item 14 (`lastActivityAt`):** before this BU is signed off, run static / unit tests covering **every ticket lifecycle state** (Backlog, all active board columns, Done, Deleted) and **every bump-event** (comment, note, status change, assign, unassign, share, unshare, title edit, body edit). Assert that `lastActivityAt` is set on creation, bumped exactly once per event, and never decreases. Fix any defects surfaced by this matrix before merging. The matrix is exhaustive — not just happy-path. This is a build-time requirement, not a stretch goal.

Concretely, the matrix is the cartesian product `lifecycle-state × bump-event`, asserting on each cell:

- `lastActivityAt` is non-null after the event.
- `lastActivityAt > previous lastActivityAt` (strictly increasing).
- Exactly one bump per event (no double-bump from cascading mutations or transaction retries).
- `deleteComment` does NOT bump (per item 14).
- Soft / hard transitions to Deleted state are exercised — even a deleted ticket's `lastActivityAt` reflects the deletion event timestamp (or whatever the resolved ADR specifies for terminal states).

### Feature flag

None proposed. These are incremental UX fixes on a surface already gated by `coord_board_v1`. If the discussion-tabs change (item 8) feels risky for the pilot, wrap that one specific change in a `coord_board_discussion_tabs` flag — but lean toward shipping unflagged given how minor the visual change is.

### Risks / gotchas

1. **Item 10 vs D052.** D052 says comments are not editable / deletable in MVP. This brief (and ADR-0016 / D082) carve out an exception for board (Request) comments only. `Comment` is polymorphic via two nullable FKs (`postId` / `requestId`) — not a `targetType` string — so the editor/deleter gates on `requestId !== null` (equivalently `postId === null`). Enforce at router AND service for defence-in-depth. The `Post` side stays uneditable.

2. **Item 14 ADR latency.** With the new-column path now resolved per Q2, the ADR (`docs/adrs/0015-ticket-last-activity-at.md`, ADR-0015) needs to land in the same PR or one ahead. Don't merge the column without the ADR; CI's schema-locked rule will block.

3. **Item 17 optimistic update vs server validation.** If the column is full, soft-blocked, or the user lacks permission, `onMutate` removes a ticket that the server then rejects. `onError` rolls back, but the user sees a flash. Worth a 200ms debounce on the optimistic remove, or accept the flash.

4. **Item 2 regression test belongs in CI immediately.** This is a "fixed once, regressed twice" candidate — the optimistic-update coupling that caused the bug is the kind of thing that returns when someone refactors the cache invalidations. Get it into the pipeline first.

5. **Item 5 + breadcrumb dependency.** Dropping the originating team from the Shared-With strip assumes the breadcrumb / page chrome reliably shows the originating team. Verify on mobile (cramped header) before deleting the strip element.

6. **F14 testid rule.** Every new interactive element gets a `data-testid`. The `unshare` button, the `Delete ticket` button, the discussion tabs, the FAB captions — all need testids. Grep the existing brief patterns (`bu-coordination-board.md` PR #5) for the prefix convention.

7. **Item 4 — auto-navigate on unshare-while-open (the gotcha).** When a receiving-team member unshares themselves out of a ticket they currently have open, the next render must not 403. The page must detect the access loss and redirect to the user's own team's corresponding lifecycle list (`/board/<own-team-slug>/<lifecycle-list>` — backlog / board / done depending on the ticket's state at unshare time). Implement via a server action that returns a `redirect()` after the mutation, OR via middleware / route revalidation that picks up the access loss on the next navigation tick. Do NOT rely on the client to clear the page — a stale optimistic render could briefly show the ticket after the server has revoked access. **Test required:** "receiving-team member unshares while ticket is open" — assert the user lands on `/board/<own-team-slug>/<lifecycle-list>` with the toast, never on a 403 page.

### Permission matrix

| Action | Member | Originator | Receiving-team member | Group admin | Sysadmin |
| --- | --- | --- | --- | --- | --- |
| Assign-to-me / Unassign-from-me (any member) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Follow / Unfollow (any member) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Share to another team (item 4) | — | ✓ (originating-team member) | — | ✓ | ✓ |
| Unshare from a team (item 4 — corrected Q1) | — | ✓ (originating-team member) | ✓ (receiving-team member, "leave the share") | ✓ | ✓ |
| Edit own comment / note | — | (if author) | (if author) | (if author) | (admins editing others' comments out of scope) |
| Delete own comment / note | — | (if author) | (if author) | (if author) | — |
| Delete ticket (item 13) | — | ✓ | — | — | ✓ |
| Move ticket between backlog ↔ active ↔ done | (existing rules — out of scope) | | | | |

### Acceptance

- [ ] Items 1, 3, 5, 7, 8, 9, 11, 12, 15 ship as UI-only changes; no regressions on the existing ticket detail flows.
- [ ] Item 2's regression test passes in CI; the four asymmetric button-isolation cases are explicit.
- [ ] Item 4 ships with the corrected unshare permission gate per Q1: originating-team members revoke; receiving-team members "leave the share" (no error, idempotent); admins on either side. After unshare, receiving-team members lose access cleanly.
- [ ] Item 4 auto-navigates the receiving-team member back to their own team's `/board/<slug>/<lifecycle-list>` if they had the ticket open at unshare time — never a 403; toast confirms.
- [ ] Item 10's author-only edit / hard-delete works; "edited" marker visible on edited comments.
- [ ] Item 13's originator/admin-only ticket-delete works; cascade verified for comments / notes / shares / assignments.
- [ ] Item 14 ships with the new `Request.lastActivityAt` column (indexed) per Q2; "Last activity" label updates on every catalogued mutation; ADR (`docs/adrs/0015-ticket-last-activity-at.md`, ADR-0015) merged before or with the schema PR.
- [ ] Item 14 state-coverage matrix passes: every `lifecycle-state × bump-event` cell asserts `lastActivityAt` set on create, bumped exactly once per event, never decreasing; `deleteComment` does not bump. Defects surfaced by the matrix are fixed before merge.
- [ ] Item 17's `/backlog` triage flow stays on `/backlog`; toast confirms; optimistic update + rollback verified.
- [ ] FAB captions visible on mobile (375px viewport); divider contrast bumped; tooltips present on desktop.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] `package.json` PATCH bumped.
- [ ] Glyph register in `docs/product/design-philosophy.md` updated in the same commit if any new lucide icon ships (rule: one concept = one glyph).

### Estimate

One full session (4–5 hours). The work is a wide cluster of small surgeries; the single risk that could blow it open is item 14's ADR latency (now resolved as the new-column path per Q2). The ADR drafting is in flight in parallel.

### Out of scope (split into companion briefs)

- **Item 6 — Right-rail relayout.** Header buttons + Assignees + Shared-With strip → right rail; Description directly under title. → `bu-ticket-detail-relayout` (status: **needs-design**, Figma round before implementation; mobile breakpoints cascade).
- **Item 16 — Pastel palette for the kanban.** Replace "shades of magnolia" column backgrounds. The ticket-view modal already differentiates columns; the complaint is about the kanban surface itself. → Separate brief, scope TBD; defer until palette tokens are settled.

---

## Open questions to surface

All previously-blocking TBDs are now resolved with applied defaults:

1. **Item 4 — unshare permissions (Q1, corrected 2026-05-09).** Sharing is unchanged: originating-team members + admins. Unsharing now permits **both teams**: originating-team members revoke the share; receiving-team members "leave the share" (idempotent, no error). After commit, the ticket is unreachable for receiving-team members. If a receiving-team member has the ticket open when unshare commits, they auto-navigate to their own team's `/board/<slug>/<lifecycle-list>` (backlog / active / done depending on lifecycle state) — never a 403.
2. **Item 14 — schema choice (Q2, resolved).** New `Request.lastActivityAt` column (DateTime, indexed) — what we colloquially call a "ticket" is a `Request` row with `type = null` per ADR-0010. `updatedAt` retains its Prisma row-level semantics. Label renamed to "Last activity". ADR at `docs/adrs/0015-ticket-last-activity-at.md` (ADR-0015, D081).
3. **Item 10 vs D052 scope (Q5, resolved).** Edit/delete scoped to Request comments only; Post comments remain immutable per D052. ADR at `docs/adrs/0016-comment-edit-delete-scope.md` (ADR-0016, D082).

Items resolved during drafting (no surfacing needed):

- **Item 5 fallback.** "Drop the originating-team pill" assumes breadcrumb is reliable. Verify on mobile before delete.

---

## Context

- **Companion briefs:** `bu-ticket-detail-relayout` (item 6, needs-design) · future palette brief (item 16, scope TBD).
- **Related decisions:**
  - **D079** (typed `Request.title` / `body`) — context for item 7's editor + item 14's bumps-on-description-edit.
  - **D054** (Request entity) — base entity for ticket detail.
  - **D052** (Comment polymorphic + MVP-immutability) — directly contradicted for board comments by item 10; gate accordingly.
  - **D070** (reference data in migrations) — applies if item 14 adds a column.
  - **D068** (brief lifecycle status front-matter) — this brief flips to `shipped` only when the PR lands.
  - **D080** (hydration-safe deferred render) — `RelativeTime` reuse for the `Last activity` label.
  - **D043** (groups as identity + queue filters) — context for item 4's unshare permission model.
  - **D014a** (system events styling) — reuse for item 8's Log tab.
- **Companion scenarios:** `SCN-32` (kanban triage) and `SCN-33` (ticket detail). Both should still pass after this BU.
- **Glyph register:** `docs/product/design-philosophy.md` — `clipboard-paste` is the registered FAB-paste glyph; do not introduce alternatives without updating the register in the same commit.
- **CLAUDE.md voice:** Sharon-warmth on the toast (item 17); honest copy on "Last activity" (item 14); no anxiety amplification (no urgent framing on Delete confirmations — calm, matter-of-fact).

---

## Status

`ready` — drafting complete; defaults applied for Q1 (item 4 unshare permissions), Q2 (item 14 schema), and Q5 (item 10 vs D052 scope). No outstanding TBDs. Schedule when capacity allows.
