---
slug: bu-ticket-detail-relayout
status: needs-design
phase: 2
priority: medium
note: "Structural counterpart to bu-ticket-view-fixes — ship that smaller bag-of-fixes brief FIRST; this BU rebuilds the layout around the corrected affordances. Waits on a design pass (Figma or hand-sketched equivalent) before it can move to ready."
---

# SESSION BRIEF · bu-ticket-detail-relayout — main + right-rail restructure of the ticket detail page

_Author: Paul + Claude · Created: 2026-05-09_
_Type: View-layer relayout. Tester-driven; structural; needs-design._

---

## 1 · Business Analyst — why this matters

### The problem in plain language

Bette opens a ticket on her laptop. Today the page reads top-to-bottom as:

1. Title
2. A row of header buttons (Edit / Delete / Move-to-active / Move-to-backlog)
3. Assignees
4. Shared-With pills
5. Lifecycle / status indicators
6. _Finally_ — the Description

To find out what the ticket is **actually about**, she has to scroll past
a stack of meta-info that she didn't ask for. That's the inverse of what
a coordinator opening a ticket needs. The information she came for is
buried; the chrome around it is shouting.

### The tester feedback (verbatim)

> "Move all the header buttons, Assignees and Shared With to the right
> rail, so that the Description is right under the title."

That single sentence is the whole brief, expressed at the user-feedback
level. The work below unpacks what it implies and surfaces the questions
a design pass needs to answer before code starts.

### The proposed shift

A two-column "main + right rail" pattern, well-established on tickets/
issues in the wider tooling world:

- **Main column** (left): Title → Description → discussion thread.
- **Right rail**: all meta-info — header action buttons, Assignees,
  Shared-With, lifecycle/status, Created-by, Created-at, Last-activity.

### Reference precedent

This is not a novel pattern. It's the de-facto standard for issue/ticket
detail views:

- **Linear** — title + description left; status/assignee/labels/cycle right.
- **GitHub Issues** — title + body left; assignees/labels/projects/milestone right.
- **Jira Cloud** — summary + description left; status/assignee/reporter/sprint right.

Members coming from any of those tools will find the pattern familiar.
Members who haven't used them will find it more discoverable than what
we have today (the meta-stack-above-content anti-pattern).

### Before / after — described, not drawn

This is a stub. The real before/after lives in the design pass. For
now:

**Before** (current, on a 1280-wide laptop, above-the-fold):

```
┌────────────────────────────────────────────────────────────────┐
│  Ticket title                                                  │
│  [Edit] [Delete] [Move→Active] [Move→Backlog]                  │
│  Assignees: Bette · Eddie · Ingrid                             │
│  Shared with: Hendon · Manchester                              │
│  Status: Active · Created 2 days ago by Sharon                 │
│  ─── (Description below the fold) ───                          │
└────────────────────────────────────────────────────────────────┘
```

**After** (target, same viewport):

```
┌──────────────────────────────────────────┬─────────────────────┐
│  Ticket title                            │  [Edit]             │
│                                          │  [Delete]           │
│  Description starts here. Visible        │  [Move→Active]      │
│  immediately. Reads first.               │  ──                 │
│                                          │  Assignees          │
│  …continues, plenty of room.             │  Bette · Eddie      │
│                                          │  Shared with        │
│  Discussion / comments below.            │  Hendon · MCR       │
│                                          │  Status: Active     │
│                                          │  Created 2d ago     │
└──────────────────────────────────────────┴─────────────────────┘
```

### Success criteria

- On a **1280px-wide laptop** (the narrowest typical coordinator
  workstation), the Description's first paragraph is visible above the
  fold without scrolling.
- All meta-info that lives in the rail today remains discoverable —
  not hidden, not buried, not behind extra clicks.
- **Mobile experience is clearly defined**, not a desktop afterthought.
  See TL question 3 below.
- The pattern feels like Linear / GitHub / Jira — familiar muscle
  memory, not bespoke.

### What this is NOT

- Not a rebrand or theme change.
- Not a board-list view change (the kanban grid stays as-is).
- Not a mobile-app view (PWA layout only).
- Not a redo of the items in `bu-ticket-view-fixes` (the smaller
  sibling brief). Those fixes — visual polish on the existing layout —
  ship FIRST. This BU then rebuilds the layout around already-corrected
  affordances. **Sequence matters.** If flipped, the smaller brief
  would have to redo work this BU later overwrites.

---

## 2 · Tech Lead — the design questions to resolve

The build is mechanically straightforward (View-layer only, no schema, no
router, no service). The hard work is **design decisions** — none of
which Claude Code should make autonomously. This brief frames the
questions; the design pass answers them.

### Q1 · Right-rail content order

Which meta lives in the rail, and in what order? Suggested groupings —
not prescriptive; design pass decides:

- Header actions (Edit / Delete / Move-to-active / Move-to-backlog)
- Assignees
- Followers / watchers (if/when introduced)
- Shared-with
- Lifecycle / status
- Created-by · Created-at
- Last-activity

The tester sentence puts header buttons + Assignees + Shared-With in
the rail. Other meta is implied but not explicit — design pass to
confirm scope.

### Q2 · Header buttons — rail or top-bar?

Two valid patterns, both common:

- **In the rail** (Linear, Jira Cloud) — actions sit with the rest of
  the meta, ungrouped from content.
- **Top-bar above the title** (GitHub) — primary actions stay
  visually-anchored to "this ticket" as a header strip.

The tester sentence says "rail." Design pass to confirm whether that
applies to all four header actions or whether a destructive-vs-
constructive split makes sense.

### Q3 · Mobile cascade — the critical question

At narrow widths the rail can't sit beside the main column. Three
options, none obviously right:

| Option                                                               | Pro                                              | Con                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| **A.** Rail collapses to a top accordion above Description ("Show details ▼") | All meta one tap away, before content            | Adds a tap before the user reaches what they came for — mirrors today's anti-pattern in collapsed form |
| **B.** Rail collapses to a bottom-sheet ("Details" tab)              | Description is fully unobstructed                | "Details" tab can hide important meta (assignees) on a glance |
| **C.** Rail collapses inline above the discussion thread (after Description) | Most natural reading order: title → desc → meta → discussion | Long descriptions push meta far down; assignees may be many scrolls away |

The right answer depends on **how members actually use the page on
mobile** — whether they primarily read tickets, primarily act on them,
or primarily check assignees first. That's a design-research call,
not a Claude Code call. **STOP and ask before building.**

### Q4 · Breakpoint

At what viewport width does the rail fold from beside-the-main-column
to one-of-the-mobile-cascades-above? 1024px? 1200px? The narrowest
typical coordinator laptop drives this — design pass to lock.

### Q5 · Density — rail width

280px? 320px? Wider rail = less Description horizontal space; narrower
rail = pill text wraps awkwardly. Design pass to lock; cite the
narrowest typical viewport when justifying.

### Q6 · Persistence

Should the rail be **collapsible on desktop** (user preference,
remembered) or **always visible**? A coordinator-density-mode toggle
(per the parking-lot's density direction) might apply here. Design
pass to decide; if collapsible, decide where the persistence lives
(localStorage? user-preference table? cookie?).

### Q7 · Cascade risk — does this pattern apply elsewhere?

Other detail pages may benefit from the same restructure:

- Post detail (`/post/[id]`)
- User profile (`/u/[handle]` or wherever)
- Group settings (`/board/[groupSlug]/settings`)

Design pass to either **cover them in the same pass** (one consistent
detail-page layout across the product) or **explicitly scope them
out** (this BU is ticket-detail only; post-detail gets its own BU
later). Don't leave it ambiguous — that's how layouts diverge.

### Q8 · Existing layout — the migration surface

The current ticket detail page lives at:

```
/Users/paulwander/projects/gps-action/app/board/[groupSlug]/[ticketId]/page.tsx
```

Plus any co-located components in that directory. The design pass
should know this is the migration target — no lifting components into
`/components`, no router/service changes, no schema work. Pure View
layer.

---

## 3 · Layer boundary impact

Pure **View layer** — `/app` + `/components`. No router/service/schema
changes. ESLint boundary rules satisfied by construction.

| Layer            | Touched? |
| ---------------- | -------- |
| `/app`           | Yes — relayout `app/board/[groupSlug]/[ticketId]/page.tsx` |
| `/components`    | Maybe — if the rail extracts to a reusable `<TicketDetailRail />` |
| `/server/routers` | No      |
| `/server/services` | No     |
| `/server/db`     | No       |
| `/shared`        | No       |
| `prisma/schema.prisma` | No |

---

## 4 · Tests required

- **Visual-regression** for desktop and mobile breakpoints — if VR
  infra exists. (Today: probably doesn't. Note as a roadmap follow-up
  rather than blocking this BU.)
- **Manual sign-off** on each breakpoint at the locked sizes from Q4.
- **Existing tests audit** — any test that targets current DOM
  structure via `data-testid` selectors will need its selector path
  updated. Audit BEFORE migration; don't discover at green-CI time.

Not required:

- Performance benchmarks (a layout change at this scale doesn't move
  the needle).
- E2E coverage (manual click-through through the locked scenarios is
  enough for a layout change).

---

## 5 · Risks / gotchas

- **Mobile design afterthought** — the most common failure mode for
  "right rail" patterns. Designers solve desktop first, then collapse
  the rail to whatever fits at narrow widths. The mobile cascade
  question (Q3) is genuinely first-class — design pass treats it as
  a peer, not a fold-down.
- **Existing tests with `data-testid` selectors** may break. The F14
  testid rule is enforced; the relayout will move selectors to new
  parents. Audit + update in the same PR.
- **Sibling-brief sequence** — `bu-ticket-view-fixes` ships **first**;
  this BU **second**. If sequence flips, the smaller brief redoes
  work. Confirm `bu-ticket-view-fixes` is shipped (`status:
  shipped`) before this BU is moved to `ready`.
- **Cascade-risk drift** — if Q7 says "ticket-detail only this BU,"
  follow-up BUs for post-detail / user-profile must explicitly
  reference this BU's locked design choices, not re-derive them.
  Otherwise we'll end up with three near-identical-but-different
  detail-page layouts.

---

## 6 · Out of scope (park)

- The small-fix items in `bu-ticket-view-fixes` (Items 1, 8, 9, 11,
  12, 14, etc.). Those ship in the sibling brief. Reference but don't
  redo.
- Post detail / user profile / group settings relayouts (see Q7) —
  unless the design pass explicitly pulls them in.
- Density-mode toggle (parking-lot item). May surface here via Q6 but
  the toggle itself is its own concern.
- Drag-to-reorder rail content. No.
- Member-customisable rail (which fields show / hide). No.

---

## 7 · Acceptance for moving to `ready` status

This brief is `needs-design`. It moves to `ready` when **all** of:

- [ ] Figma frames (or hand-sketched equivalent) for desktop +
      mobile breakpoints exist and are linked from this brief.
- [ ] Right-rail content order locked.
- [ ] Mobile cascade pattern locked (one of A / B / C from Q3).
- [ ] Breakpoint locked (Q4).
- [ ] Rail width locked (Q5).
- [ ] Persistence behaviour locked (Q6).
- [ ] Cascade-risk decision locked — in scope or explicitly out (Q7).
- [ ] Sign-off from product (Paul) on the design.
- [ ] `bu-ticket-view-fixes` is `status: shipped`.

Once all boxes tick, flip front-matter `status: needs-design` →
`status: ready`, fill in a Build / Don't-touch file list, and the
brief is ready for a build session.

---

## 8 · Acceptance criteria (provisional — design pass refines)

These are placeholders. Design pass may add / refine.

- [ ] On a 1280px-wide laptop, the Description's first paragraph
      visible above the fold without scrolling.
- [ ] Right-rail content matches the locked order from Q1.
- [ ] Header actions in the locked location from Q2.
- [ ] Mobile cascade matches the locked pattern from Q3, at the
      locked breakpoint from Q4.
- [ ] Rail width is the locked value from Q5.
- [ ] Rail persistence matches Q6.
- [ ] No regression on existing ticket-detail behaviours (open,
      assign, share, lifecycle moves all still work).
- [ ] All `data-testid` selectors still resolve (audited + migrated).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] `package.json` PATCH bumped.

---

## 9 · Open questions to surface (for the design pass)

Repeated here in one place so the design lead can scan them quickly:

1. Right-rail content order? (Q1)
2. Header buttons in rail or top-bar? (Q2)
3. Mobile cascade — A / B / C? (Q3)
4. Breakpoint at which the rail folds? (Q4)
5. Rail width? (Q5)
6. Collapsible-on-desktop or always-visible? (Q6)
7. Cascade — does this pattern apply to post-detail / user-profile
   in the same pass, or scope to ticket-detail only? (Q7)
8. (For the build session, once `ready`) which file(s) need touching
   beyond `app/board/[groupSlug]/[ticketId]/page.tsx`?

---

## 10 · Context

- Sibling brief: `docs/build/session-briefs/bu-ticket-view-fixes.md`
  (currently on branch `docs/bu-ticket-view-fixes-20260509`). Ships
  first.
- Design philosophy: `docs/product/design-philosophy.md` — particularly
  density, calm-not-anxious, mobile-first.
- Tester feedback verbatim quoted in §1.
- Layout pattern references: Linear, GitHub Issues, Jira Cloud — issue
  detail views.
- Migration surface: `app/board/[groupSlug]/[ticketId]/page.tsx`.

---

## Status

`needs-design`. Hold for design pass.
