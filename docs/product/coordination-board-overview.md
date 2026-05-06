# Coordination Board — overview for non-technical readers

_Date: 2026-05-06 · Audience: working-group leads, partner-org reps,
pilot members, anyone evaluating GPS without a developer in the room_

This is the plain-language walkthrough of the coordination board as it
currently ships. It describes what's actually built — the kanban
(Direction A), the ticket detail surface, the notifications pane, the
mobile reflow, and the admin event-config — and points to where each
sits in the app.

For the build-side detail (schema, ADRs, build sequence), see
`docs/build/session-briefs/bu-coordination-board.md`.

> **Status.** Code is in `main` through v0.2.143. The feature flag
> `coord_board_v1` is OFF in production until the named pilot teams
> (Writers + one IT-team member) have used the board end-to-end. Dev
> environments have it enabled. Direction B (the SleekFlow-style
> "shared inbox" alternative) was considered and rejected; Broadcast
> moved to its own build unit (`bu-broadcast`). See the brief for the
> reasoning.

---

## What it is

A shared workspace inside GPS where each team — Writers, Radio, Social
Media, IT, Face-to-face, regional groups, and partner networks like
CUFI — sees a colourful board of the work they're doing. Cards (called
"tickets") move across columns as work progresses. The same ticket can
be directed at more than one team at once, with each team tracking its
own progress.

Today the equivalent happens in WhatsApp threads. People volunteer
verbally, status lives in someone's head, handover between teams is
invisible. The board makes the work and its progress visible without
changing how members like to communicate (WhatsApp, email, in-app —
their choice per team).

---

## How to get to it

Members who have access to at least one group see a **Board** tab as
the first slot in the bottom navigation. Tap it to land on the group
picker (only groups they belong to are listed). Pick a group → land on
that group's Active board.

URL pattern: `/board/<group-slug>`. Available pilot groups in the seed
data: `writers`, `manchester`, `rapid-response`.

If a member belongs to only one group, they could be auto-routed
straight to that group's board — currently we still show the picker
once. (Pilot feedback may change this.)

---

## The three surfaces

### Surface 1 — Kanban board

The default view of a group. Three tabs along the top:

- **Active** — the columns. This is where day-to-day work moves.
- **Backlog** — proposed jobs that aren't on the active board yet. List
  view by default.
- **Done** — completed jobs, archived for reference. List view by
  default.

A "**+ Propose to backlog**" outline button sits in the header. Anyone
in the group can propose; the group admin promotes proposals onto the
Active board.

#### Active tab — desktop

Default columns are `Recruitment → Preparation → Implementation →
Monitoring`. Group admins can rename, add, or remove columns to suit
their team — Writers might use `Draft → Edit → Publish → Distribute`
instead.

Each card on the Active board shows:

- Title
- Kind glyph (icon indicating the type of work)
- Multi-assignee avatar row, with a `+N` overflow if many
- Urgent badge (only shown when the ticket is flagged urgent)
- Last-updated time

Unclaimed cards have a soft yellow background to make them visible at
a glance.

**Drag** to move a card between columns or to reorder within a column.
Reordering writes a new `boardPosition`; column changes write an audit
row. The first time someone self-assigns to a card in Recruitment, the
card auto-advances to Preparation.

**Grid ↔ list toggle.** A small toggle (top right of the Active tab)
switches between the kanban grid and a flat list view of the same
cards, grouped by column. The list view is **read-mostly** — there's
no drag in list view, because dragging between flat sections doesn't
have an obvious gesture. Members who want to move cards switch back to
grid. The choice is remembered per browser (localStorage).

#### Active tab — mobile (≤768px)

Columns are too cramped on a phone, so they flatten into a single
vertical scrolling stack. Each card carries a coloured **tag-switcher
pill** showing its column; tapping the pill opens a small popover to
move it. Card content otherwise matches the desktop card.

The tag-switcher palette runs from warmer to calmer (yellow → blue →
brand teal → green → neutral grey) — the Sharon-warmth principle: the
start of the workflow feels engaging, the end feels settled.
Admin-configured per-column colours are deferred; if pilot feedback
asks for them they'll come in a follow-up.

#### Backlog and Done tabs

Both default to a list view. Backlog is the inbox for proposed work;
admins prioritise here, then drag onto Active. Done is read-only; it's
where finished tickets archive.

### Surface 2 — Ticket detail

Where the work itself happens. Reached by tapping any card.

URL pattern: `/board/<group-slug>/<ticket-id>`.

The page lays out as:

- **Title row**, with an inline edit affordance. Any group member can
  edit; edits are audit-logged.
- **Action pair (unified):** **Assign me / Unassign** sits adjacent to
  **Follow / Unfollow**. Self-assigning auto-subscribes you (so
  notifications start arriving). An explicit unfollow is a separate
  gesture, and it survives unassign — so members can keep watching a
  ticket they've handed off.
- **Multi-assignee row** — anyone assigned shows here. No "owner"
  vocabulary; first-assignee gets no special status.
- **Urgent flag.** Toggleable; flipping it on notifies subscribers.
- **Editable description.** Any group member can edit the body;
  audit-logged.
- **Interleaved thread** — three event types interleaved on the same
  timeline:
  - **Comments** — visible to everyone with access to the ticket.
  - **Internal notes** — visible only to the team that owns this share
    of the ticket. Visually tinted yellow.
  - **System events** — auto-written when something happens (column
    change, assign, urgent flip, edit, etc.).
  - The compose box at the bottom switches between "Comment" and
    "Note" modes.
- **Share with team** — single control replacing the earlier
  "Share-with-team + Invite group" pair. The picker shows allowed
  teams (constrained by the group admin's allow-list); picking creates
  a share row so the ticket appears on the receiving team's board too.
- **Right meta sidebar** — assignees, subscribers (read-only list,
  `+N` overflow if long), labels, kind glyph, group(s) the ticket is
  shared with, last activity.

Multiple teams sharing a ticket each track their own column state.
Writers can be in Implementation while Social Media is still in
Preparation, both viewing the same conversation.

### Surface 3 — Notifications pane

Thin alerts list, separate from the boards. Reached via the existing
**Inbox** glyph in the bottom navigation.

- Tinted (light brand-teal) row background = unacknowledged.
- Plain white = acknowledged.
- Tapping a row jumps to the source ticket and auto-acknowledges. No
  separate "mark read" gesture.
- The list is capped (with a `View all` link if there are more) to
  protect against floods.

Default trigger rules — subscriber-driven:

- Authors, assignees, and anyone ever-mentioned get notified on
  column transitions, comments, and urgent flips.
- Group admins can opt to send a team-wide blast via the Notifications
  path; recipients can mute that specific blast type per-flag.

Per-user notification preferences (channel + frequency) live in
account settings. Per-group overrides are allowed — e.g. "everything
for Writers, mentions only for IT".

---

## Who can do what

| Action                           | Member of group       | Group admin  | System admin |
| -------------------------------- | --------------------- | ------------ | ------------ |
| View this group's board          | ✓                     | ✓            | ✓            |
| Claim (Assign me)                | ✓                     | ✓            | ✓            |
| Move own card between columns    | ✓                     | ✓            | ✓            |
| Move any card                    | —                     | ✓            | ✓            |
| Edit description (audit-logged)  | ✓                     | ✓            | ✓            |
| Reorder column (drag-prioritise) | —                     | ✓            | ✓            |
| Configure columns                | —                     | ✓            | ✓            |
| Approve join requests            | —                     | ✓            | ✓            |
| Promote member → group admin     | —                     | ✓            | ✓            |
| Share ticket to another team     | ✓ (within allow-list) | ✓ (any team) | ✓            |
| Send team-blast notification     | —                     | ✓            | ✓            |
| Configure share allow-list       | —                     | ✓            | ✓            |
| Create new group                 | —                     | —            | ✓            |
| Archive group                    | —                     | —            | ✓            |

Joining a team needs admin approval, with one exception: networks like
CUFI can be configured at creation to allow members to self-attest
their affiliation. The Tech team specifically remains
invitation-only to prevent overload.

---

## How to create a board

There's no separate "create a board" flow — every group has a board.
A system admin creates the group (kind, name, slug, share allow-list);
the group admin configures the column set on the new group's settings
page. System defaults seed in per group kind:

- **Workstream / team** groups: Recruitment / Preparation /
  Implementation / Monitoring.
- **Topic / region / network** groups: same defaults; admins commonly
  rename to fit their work.

Group kinds — `workstream`, `region`, `network`, `team`, `topic` —
control the default column set and where the group appears in the
picker.

---

## Admin: kanban event configuration

System admins control which kanban events write a system entry into
the ticket thread. The setting is per-event-kind, with a simple
on/off toggle on each row of the admin entity page (the inline toggle
landed in v0.2.139).

Defaults — most events default ON (column changes, assignment,
urgent on, comment posted). A handful default **OFF** to reduce noise:

- `title_edit`
- `body_edit`
- `urgent_off`
- `assign_self`
- `unassign_self`

Admins can flip any of these on if their team finds them useful.
System events are written into the same comment thread as human
comments and notes, distinguished by their `source: system` flag.

---

## Pilot rollout

Before the flag flips on in production, two pilot acceptance tests
need to pass:

1. **One Writer** uses the board end-to-end (proposes, claims, moves
   through columns, comments, marks done) without intervention.
2. **One IT-team member** does the same, including the Share-with-team
   path to a second team.

Once both have signed off, the `coord_board_v1` flag flips on globally
(via a small data migration) and the board appears for everyone with
access to a group.

The pilot teams in the seed data are `writers`, `manchester`, and
`rapid-response`; production pilots will use real teams Paul nominates
when the slot is booked.

---

## What this is NOT (yet)

Saying "no" to these now keeps the first version evaluable:

- Real-time presence (who's looking at this card right now).
- Time-tracking / SLA timers.
- Cross-board templates or recurring tickets.
- Inline file attachments on cards (use the linked Request).
- Public / external read-only board view.
- Temporary-access @mentions (Direction B carve-out, dropped).
- Outbound broadcasting — that's `bu-broadcast`, a separate build.

---

## Where to find more

- Build brief (schema + ADRs): `docs/build/session-briefs/bu-coordination-board.md`
- POC sketches: `docs/product/coordination-board-sketches/`
- How GPS uses "Group": `docs/product/groups.md`
- Feature-flag register: `docs/product/feature-flag-register.md` (`coord_board_v1`)
- Scenarios: SCN-32 (Leonid claims), SCN-33 (Sharon shares), SCN-34 (Maya acknowledges).
- Outbound sister BU (not yet built): `docs/build/session-briefs/bu-broadcast.md`
