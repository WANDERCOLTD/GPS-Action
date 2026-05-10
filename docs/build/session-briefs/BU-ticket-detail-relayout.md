---
slug: BU-ticket-detail-relayout
status: shipped
shipped_in: "#316"
phase: 2
priority: medium
note: "Structural counterpart to bu-ticket-view-fixes — ship that smaller bag-of-fixes brief FIRST; this BU rebuilds the layout around the corrected affordances. Design pass complete on 2026-05-10; the 8 design questions are answered with locked decisions inline (§ 'Design pass — locked decisions'), and ASCII frames for the desktop / tablet / mobile breakpoints are captured in § 'Layout frames'. Shipped 2026-05-10."
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

- [x] Figma frames (or hand-sketched equivalent) for desktop +
      mobile breakpoints exist and are linked from this brief.
      _(ASCII frames captured in § "Layout frames" below — equivalent
      to hand-sketched. No external Figma; the prose + ASCII is the
      canonical artefact.)_
- [x] Right-rail content order locked. _(Q1, see § "Design pass —
      locked decisions".)_
- [x] Mobile cascade pattern locked (one of A / B / C from Q3).
      _(Q3 → option C, inline above the discussion thread.)_
- [x] Breakpoint locked (Q4). _(1024px.)_
- [x] Rail width locked (Q5). _(304px.)_
- [x] Persistence behaviour locked (Q6). _(Always-visible on desktop;
      no toggle in this BU.)_
- [x] Cascade-risk decision locked — in scope or explicitly out (Q7).
      _(Ticket detail only; post detail / user profile / network detail
      explicitly out of scope.)_
- [x] Sign-off from product (Paul) on the design. _(Design pass
      authored 2026-05-10 by Paul + Claude; locked decisions are the
      sign-off artefact.)_
- [ ] `bu-ticket-view-fixes` is `status: shipped`. _(Sequence gate —
      verify before scheduling the build session.)_

All design-pass boxes ticked on 2026-05-10. Front-matter flipped to
`status: ready`. Slug remains lowercase `bu-` — this brief is
design-pass-complete, not yet shipping a build. The build session
itself will flip to `BU-` semantics when scheduled.

---

## 8 · Acceptance criteria (refined by 2026-05-10 design pass)

Build session asserts on each:

- [ ] On a 1280px-wide laptop, the Description's first paragraph
      visible above the fold without scrolling.
- [ ] Right-rail content order matches Q1: Lifecycle Status →
      Assignees → Following → Shared-With → Originator + Created-at →
      Last activity → Header actions (Delete + Move-to-board) at the
      bottom.
- [ ] Header actions placed in the rail at the bottom (per Q2), not
      in a top-bar above the title.
- [ ] Mobile cascade matches Q3 (option C — inline cascade above the
      Discussion thread) at the Q4 breakpoint (`< 1024px`).
- [ ] Rail width is **304px** on viewports `>= 1024px` (Q5).
- [ ] Rail is **always-visible** on desktop — no collapse toggle, no
      persistence (Q6).
- [ ] No collapsible panels in v1; if a future panel collapses, state
      is session-scoped only (Q8b).
- [ ] Scope respected: only `app/board/[groupSlug]/[ticketId]/page.tsx`
      and its co-located components are touched. Post detail, user
      profile, and `/network` detail are **not** modified (Q7).
- [ ] No regression on existing ticket-detail behaviours (open,
      assign, share, lifecycle moves, edit body / title, comment /
      note compose, urgent toggle).
- [ ] All `data-testid` selectors still resolve (audited + migrated to
      new parents per F14).
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

## Design pass — locked decisions (2026-05-10)

The 8 questions from § 2 (Q1–Q8) are answered below, with one extra
sub-decision (**Q8b**) on collapsed-section state persistence — surfaced
during the design pass as an implied corollary of Q6's persistence
question. Each carries a one-paragraph **Decision**, a one-paragraph
**Rationale**, and a one-sentence **Trade-off**. None of these may be
re-derived in the build session — if a tension surfaces during build,
surface it back to product, do not re-decide silently.

Numbering follows § 2 of this brief (Q1 = rail order, Q2 = header
buttons, Q3 = mobile cascade, Q4 = breakpoint, Q5 = rail width,
Q6 = persistence, Q7 = cascade-risk, Q8 = migration surface).

### Q1 · Right-rail content order

**Decision.** From top to bottom of the rail: **(1) Lifecycle Status
indicator** (Backlog / Active column / Done — the same `CardLifecycleActions`
control already mounted on the page) → **(2) Assignees panel** (existing
`AssignSelfButton` plus the avatar list) → **(3) Following control**
(existing `FollowSelfButton`, on its own row) → **(4) Shared-With strip**
(team pills with `×` affordance, plus the `ShareWithTeamButton` row) →
**(5) Originator + Created-at** (compact one-liner, no separate panel)
→ **(6) Last activity** (compact one-liner, sits directly under the
Originator block — the existing footer `formatDistanceToNow` text moves
here) → **(7) Header actions** (Delete and Move-to-board, grouped at
the bottom of the rail in a destructive-actions footer block).

**Rationale.** The order tracks "what is this ticket's state right now,
and who owns it" first — Lifecycle Status answers the most-common
glance question (is this in flight or parked?), and Assignees / Following
answer "who's on it / am I tracking it". Shared-With sits below
ownership because it's secondary to triage decisions. Provenance
(Originator + Created + Last activity) is reference data — used when
investigating, not when triaging — so it sits below the active controls.
Destructive actions (Delete) and structural moves (Move-to-board) sit
**at the bottom** of the rail intentionally: out of the primary-glance
zone, behind the warmer controls, harder to fat-finger. This mirrors
Linear's pattern (status / assignee / labels grouped above; danger zone
isolated) and GitHub Issues' sidebar (assignees / labels / projects
grouped above; "delete" + repo-admin actions tucked behind a kebab).
Consistent with the design-philosophy "permission to close" principle —
the user sees what they own first, and the destructive escape hatch is
discoverable but not in the click-path.

**Trade-off.** Originator + Created-at slip below the assignment
controls, so a member investigating "who filed this and when" has to
glance further down — acceptable cost; that question is rarer than
"what's the status / who's assigned".

### Q2 · Header buttons — rail or top-bar?

**Decision.** **In the rail, at the bottom, in a "Header actions"
footer block.** Delete and Move-to-board live as the last item in the
right-rail content order (Q1 item 7), separated from the meta panels
above by a thin divider. They are **not** in a top-bar above the title.

**Rationale.** The tester quote — "Move all the header buttons,
Assignees and Shared With to the right rail" — is explicit. Linear and
Jira both use the rail-actions pattern; GitHub uses a top-bar pattern,
but GitHub's top-bar also carries non-action chrome (Subscribe, Lock
conversation, kebab menu), which we don't have. A top-bar above the
title here would be near-empty most of the time (Delete is gated to
originator + admin, so most viewers wouldn't see it) — a row of mostly
empty space. Putting the actions at the **bottom** of the rail (rather
than the top) is the deliberate choice: destructive actions should not
be in the primary-glance zone. Linear places "danger zone" controls at
the bottom of the rail for the same reason. The cascade preserves this
on mobile — the actions are last in the inline cascade, so a mistap-
while-scrolling-toward-Discussion is unlikely.

**Trade-off.** Originator users have to scroll/scan further to find
Delete than they would with a top-bar — acceptable; Delete is a rare
action and "harder to fat-finger" is a feature, not a bug.

### Q3 · Mobile cascade pattern

**Decision.** **Option C — inline cascade above the discussion thread.**
At narrow widths (< 1024px) the rail unstacks into a vertical cascade
that follows the Description on the main column, ordered the same as
the desktop rail (Lifecycle → Assignees → Following → Shared-With →
Originator/Created → Last activity → Header actions), and the Discussion
panel renders **below** that cascade.

**Rationale.** The brief's tester quote is unambiguous: the user came
for the Description, and any mobile pattern that puts meta back above
Description re-introduces the anti-pattern this BU exists to fix.
Option A (top accordion) does exactly that — even collapsed, it adds
a tap before the content. Option B (bottom-sheet "Details" tab) hides
assignees entirely behind a tap, which contradicts the design-philosophy
principle "every meaningful action is one tap from the post" (Assign-to-me
behind a sheet is two taps). Option C is the only pattern that preserves
the title → description → meta → discussion reading order on mobile that
the tester implicitly endorsed. It mirrors Linear's mobile issue view
(meta sits between description and comments) and GitHub mobile (sidebar
sections stack inline below the body).

**Trade-off.** On a ticket with a long description, mobile users have
to scroll past the body to reach the assignees panel — but assignees are
not the primary mobile action (acting on the ticket via the Discussion
or lifecycle is), so this is the right scroll order to optimise.

### Q4 · Breakpoint width

**Decision.** **1024px.** Viewports `>= 1024px` render the two-column
desktop layout; viewports `< 1024px` render the inline cascade from Q3.

**Rationale.** 1024px is the narrowest typical laptop the GPS Action
coordinator audience uses — it captures iPad-landscape, the 11" MacBook
Air's effective render width (1024×640 in low-density mode), and the
narrowest browser window a coordinator would deliberately keep open
beside Slack/WhatsApp. Going wider (e.g. 1200px) would push every
iPad-landscape user onto the mobile cascade, which is the wrong fit —
they have horizontal room for a rail. Going narrower (e.g. 900px) would
fold a 304px rail beside a main column that would then be < 600px,
producing cramped Description text. iPhone Pro Max landscape is
926×428pt logical / ~932 CSS pixels — comfortably below 1024, so
landscape phones get the cascade (correct: landscape phones still
prioritise reading over meta-glance on this surface). 1024 is also the
Tailwind / Radix `lg` breakpoint default, so the codebase precedent
aligns.

**Trade-off.** A small slice of windowed-laptop users between 900–1024px
will get the mobile cascade even though they have a desktop machine —
acceptable; the desktop layout at 950px would compress the rail to
unreadable widths.

### Q5 · Density — rail width

**Decision.** **304px** — fixed `width: 304px` (not a `%` or `flex` unit;
the rail is a sibling of the main column inside a flex container).

**Rationale.** 304px is wide enough to comfortably display two-line
team pills ("Manchester Photographers"), an assignee avatar plus full
display name on one line ("Bette Davies"), and the existing
`CardLifecycleActions` button group (which currently renders as a
horizontal strip of three buttons, each ~88px). 320px (the next
common-precedent value, e.g. Linear's right rail) is workable but
costs 16px from the Description column, which on a 1024px-min layout
matters. 280px (the narrowest common value) is too tight for the
two-button "Move to → / Delete" footer block at the bottom of the
rail. 304px lands between the two and matches the design-token
spacing rhythm (`var(--space-9)` → 304 if we adopted that, or simply
a fixed 304 in the layout). At 1024px viewport: rail (304) +
gap (24) + main (696) — Description column has 696px of horizontal
space, comfortably above the 600px "readable line length" floor.

**Trade-off.** Slightly narrower than Linear / Jira (320px) — pill
text in the Shared-With strip will need to truncate-with-tooltip on
team names longer than ~22 chars, where 320 would fit ~24.

### Q6 · Persistence — collapsible-on-desktop or always-visible?

**Decision.** **Always-visible.** The rail is fixed at 304px width on
all viewports `>= 1024px`. No collapse toggle, no localStorage
preference, no user-scoped DB flag in this BU.

**Rationale.** Adding a collapse toggle is feature creep on a layout
brief. The argument for collapse is "give users more horizontal room
for Description on demand" — but the Description column at 696px is
already comfortable, and members who want maximum reading width can
zoom the browser. A collapse toggle introduces non-trivial complexity:
state persistence (where? localStorage scopes per-device, DB scopes
per-user but adds a server roundtrip), the Q8b question of
collapsed-section memory below, and a re-render cascade when the toggle
fires. None of those are warranted by the tester feedback, which is
"meta is in the wrong place" not "I want less meta visible". A density-
mode toggle exists in the parking lot as its own concern; if it ships,
it can wrap this rail along with everything else. This BU stays
scoped.

**Trade-off.** Power users with extra-wide monitors (1920+) cannot
hide the rail to maximise Description column width — acceptable;
that's a 5%-of-users edge case not worth the persistence complexity.

### Q7 · Cascade risk — does this layout pattern apply elsewhere?

**Decision.** **Ticket (Request) detail only.** This BU's scope is
locked to `app/board/[groupSlug]/[ticketId]/page.tsx` and the components
it composes. **Post detail (`app/post/[id]/page.tsx`), user profile
(any future `/u/[handle]` surface), and `/network` detail pages are
explicitly out of scope.** They retain their current layouts. Any future
relayout of those surfaces gets its own brief, which **may** reference
this BU's locked decisions as a precedent but must not implicitly
inherit them.

**Rationale.** Each detail surface has a different glance hierarchy.
Post detail is read-first (long-form body, comments below) — its
analogue of "rail meta" (author byline, share counts, region tags)
already lives inline near the title and isn't crying out for a rail.
User profile is identity-first (avatar + display name dominate; meta
like region / role / vetting status pairs with the identity, not in a
separate column). `/network` detail (if it materialises) is graph-
oriented, not record-oriented. Bundling all four into one design pass
would either compromise the ticket-specific decisions to fit the others
(scope creep), or commit the others to a layout that doesn't suit them
(premature lock-in). Splitting also gives each surface its own tester
walk-through cycle, which is how the tester feedback that drove this BU
surfaced in the first place. Explicitly scoping out the others prevents
future "but the brief said relayout" arguments.

**Trade-off.** The product accumulates two-or-more detail-page layout
patterns over time, requiring a "detail-page conventions" doc to
prevent drift — acceptable; that doc can be written when the second
relayout BU lands.

### Q8 · Existing layout — the migration surface

**Decision.** The migration target is exactly
`app/board/[groupSlug]/[ticketId]/page.tsx` plus the components it
already composes (`EditableTicketTitle`, `EditableTicketBody`,
`Discussion`, `UrgentToggle`, `CardLifecycleActions`,
`ShareWithTeamButton`, `SharedWithStrip`, `DeleteTicketButton`,
`AssignSelfButton`, `FollowSelfButton`). The build session **may**
extract a new `<TicketDetailRail />` component into
`components/board/` to host the rail's layout chrome (the panel
container divs, dividers, footer block) — but must **not** modify the
internal behaviour of any of the listed child components. Their
`data-testid` attributes ride along into their new parents unchanged.
No `/server/routers`, `/server/services`, `/server/db`, or
`prisma/schema.prisma` changes.

**Rationale.** The current page already composes seven of the rail's
seven panels as discrete components — they were extracted as part of
`bu-ticket-view-fixes` precisely so the relayout could shuffle their
positions without touching their internals. Lifting the rail's chrome
to a `<TicketDetailRail />` component is optional but clean: it makes
the cascade-vs-rail decision a single conditional render in the page,
and the page itself stays readable. The child components stay where
they are (`components/board/`) — no nested directory, no new
`components/board/rail/` group. Boundary plugin (`/components` cannot
import from `/server/db` etc.) is satisfied by construction; the rail
is pure View. Audit `data-testid` selectors **before** the move, not
after — F14 is enforced and a CI fail at green-tests time costs an
extra round.

**Trade-off.** Extracting `<TicketDetailRail />` adds a new file in
`/components/board` that is essentially layout glue, no logic — a
small architectural cost for the build clarity it buys.

### Q8b · Persistence-of-state for collapsed sections

**Decision.** **No collapsed sections in v1.** Every panel in the rail
renders fully expanded on every visit; no "Show more activity" expander,
no collapsible "Details" group, no per-panel chevron. If a future
iteration adds collapsibles (e.g. an activity-history panel that grows
with time), state persistence will be **session-scoped** (in-memory
React state, no localStorage / DB) — the panel re-expands on each
fresh page load.

**Rationale.** Collapsibles are a feature this BU does not need.
Lifecycle, Assignees, Following, Shared-With, Originator, Last activity,
Header actions — none of these grows unbounded; all have predictable
content footprints. Adding collapsibles introduces the persistence
question (localStorage vs DB), the discoverability question ("is the
panel collapsed because I collapsed it, or because someone moved the
content?"), and the cross-device-consistency question (DB-scoped state
syncs; localStorage-scoped state diverges) — none of which serves the
tester complaint. If activity history later outgrows its panel space,
that's a new BU. The "session-scoped" fallback for any future
collapsible is the simplest position consistent with the design-
philosophy "no anxiety amplification" principle: no remembered state
means no "why is my panel different on this device" frustration.

**Trade-off.** Members who'd prefer to hide the Following panel on
every ticket forever cannot — acceptable; that's a personalisation
feature, not a layout feature, and belongs in a future density-mode
brief.

---

## Layout frames

Three target viewports: desktop @ 1440px, tablet @ 1024px (the
breakpoint boundary — falls into the desktop layout), and mobile @
390px (iPhone, falls into the cascade). All three frames assume the
ticket has populated state (1+ assignee, 2+ shared-with teams,
discussion with comments).

### A. Desktop @ 1440px wide

Outer page container: existing `AppNav` (left rail icon strip — out of
scope here) + main content area. Main content area is centred with
`max-width: 1280px`. Within that:

```
┌────────────────────────────────────────────────────────────────────────────┐ ← 1280px container
│  ← Hendon Writers board                                                    │   (back link, full width)
│                                                                            │
│  ┌─────────────────────────────────────────────┐  ┌──────────────────────┐ │
│  │ TITLE: Saturday count at the gates          │  │ LIFECYCLE STATUS     │ │ ← rail panel 1
│  │ Request · Urgent dot                        │  │ ● Active             │ │
│  │                                             │  │ Move to → ▾          │ │
│  │ DESCRIPTION                                 │  ├──────────────────────┤ │
│  │ Lorem ipsum the Description sits directly   │  │ ASSIGNEES   [+ Me]   │ │ ← rail panel 2
│  │ under the title now. The first paragraph    │  │ ◉ Bette Davies       │ │
│  │ is visible above the fold without           │  │ ◉ Eddie Burrell      │ │
│  │ scrolling. Edit / Save / Cancel affordances │  │ ◉ Ingrid Lin         │ │
│  │ live inside the editor (Ctrl+Enter remains  │  ├──────────────────────┤ │
│  │ a keyboard accelerator).                    │  │ FOLLOWING [Follow]   │ │ ← rail panel 3
│  │                                             │  ├──────────────────────┤ │
│  │ … the body continues with plenty of         │  │ SHARED WITH          │ │ ← rail panel 4
│  │ horizontal room (~696px of column width).   │  │ [Hendon ×] [Manc ×]  │ │
│  │                                             │  │ + Share with team    │ │
│  │ DISCUSSION ─ Comments | Log                 │  ├──────────────────────┤ │
│  │ ┌─ Add a comment or note ─────────────┐     │  │ Filed by Sharon      │ │ ← rail panel 5
│  │ │ Comment | Note   (collapsed pill)   │     │  │ 2 days ago           │ │
│  │ └─────────────────────────────────────┘     │  │ Last activity 4h ago │ │ ← rail panel 6
│  │                                             │  ├──────────────────────┤ │
│  │ ── newest first ──                          │  │ ⚠ Delete ticket      │ │ ← rail panel 7
│  │ Eddie · 4h ago                              │  └──────────────────────┘ │   (header actions
│  │   "I can cover the 9am slot."               │     ↑ 304px wide          │    footer block)
│  │ Bette · 2d ago (edited)                     │                           │
│  │   "Anyone able to take this on?"            │                           │
│  └─────────────────────────────────────────────┘                           │
│   ↑ ~696px wide main column · 24px gap · 304px rail                        │
└────────────────────────────────────────────────────────────────────────────┘

Container widths: 1280px max; centred in 1440px viewport (80px gutter each side).
Main column: flex: 1; effectively 696px at the 1024px breakpoint.
Rail: width: 304px; flex: 0 0 304px.
Gap between main and rail: var(--space-3) ≈ 24px.
```

### B. Tablet @ 1024px (breakpoint boundary — desktop layout still applies)

At exactly 1024px the same two-column layout renders, but tighter:

```
┌────────────────────────────────────────────────────────────────┐ ← 1024px viewport
│  ← Hendon Writers board                                        │
│  ┌────────────────────────────────┐  ┌──────────────────────┐ │
│  │ TITLE                          │  │ LIFECYCLE            │ │
│  │ DESCRIPTION (full width of     │  │ ASSIGNEES            │ │
│  │  ~696px main column)           │  │ FOLLOWING            │ │
│  │                                │  │ SHARED WITH          │ │
│  │ DISCUSSION                     │  │ FILED BY / DATES     │ │
│  │  …                             │  │ DELETE TICKET        │ │
│  └────────────────────────────────┘  └──────────────────────┘ │
│   ↑ flex:1 (~696px)         24px         ↑ 304px               │
└────────────────────────────────────────────────────────────────┘

Identical structure to desktop @ 1440. The container shrinks to viewport;
no fluid margins inside the container.
```

### C. Mobile @ 390px (iPhone — cascade)

The rail unstacks; the cascade follows the Description and precedes
the Discussion. Same panel order as desktop rail (Lifecycle → Assignees
→ Following → Shared-With → Originator/Last-activity → Header actions),
each panel becomes a full-width card.

```
┌──────────────────────────────────┐ ← 390px viewport
│  ← Writers board                 │
│                                  │
│  TITLE: Saturday count at the    │
│  gates                           │
│  Request · Urgent dot            │
│                                  │
│  DESCRIPTION                     │
│  Lorem ipsum the body sits       │
│  directly under the title. The   │
│  first paragraph is the first    │
│  thing the member reads after    │
│  the title. Edit / Save / Cancel │
│  live in the editor.             │
│  … continues full-width.         │
│                                  │
│  ┌─ LIFECYCLE STATUS ─────────┐  │ ← cascade panel 1
│  │ ● Active   [Move to → ▾]   │  │
│  └────────────────────────────┘  │
│  ┌─ ASSIGNEES ────[+ Me]─────┐   │ ← cascade panel 2
│  │ ◉ Bette · ◉ Eddie · ◉ I.. │   │
│  └────────────────────────────┘  │
│  ┌─ FOLLOWING ──────[Follow]─┐   │ ← cascade panel 3
│  └────────────────────────────┘  │
│  ┌─ SHARED WITH ─────────────┐   │ ← cascade panel 4
│  │ [Hendon ×] [Manc ×]       │   │
│  │ + Share with team         │   │
│  └────────────────────────────┘  │
│  Filed by Sharon · 2 days ago    │ ← cascade panel 5 (compact line)
│  Last activity 4h ago            │ ← cascade panel 6 (compact line)
│  ┌─ ⚠ Delete ticket ─────────┐   │ ← cascade panel 7 (originator only)
│  └────────────────────────────┘  │
│                                  │
│  DISCUSSION ─ Comments | Log     │
│  ┌─ Add a comment or note ──┐    │
│  └──────────────────────────┘    │
│  ── newest first ──              │
│  Eddie · 4h ago                  │
│   "I can cover the 9am slot."    │
│  Bette · 2d ago (edited)         │
│   "Anyone able to take this on?" │
└──────────────────────────────────┘

Each cascade panel is a full-width card with the same internal padding
as the desktop rail panels (var(--space-3)). Originator + Last activity
collapse to compact one-liners (no panel chrome) to save vertical space.
The Header actions footer (Delete) still uses a card to keep the
destructive control visually separated from the meta lines above it.
```

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

`ready` — design pass complete on 2026-05-10. The 8 design questions
are answered with locked decisions in § "Design pass — locked decisions"
and the desktop / tablet / mobile frames are captured in § "Layout
frames". One non-design gate remains before the build session can
schedule: confirm `bu-ticket-view-fixes` is `status: shipped`. Slug
remains lowercase `bu-` per the brief-status convention — uppercase
`BU-` semantics belong to the shipping build session, not the design
pass.
