---
slug: bu-coordination-board
status: ready
phase: 3
priority: high
note: 'Brief v0.4 (2026-05-03 PM). Direction A — kanban — confirmed; Direction B (shared-inbox alternative) considered and rejected. Broadcast split into bu-broadcast.md (#191). Tier-2 defaults accepted as proposed; tech-feasibility review skipped per Paul. Companion scenarios SCN-32 (kanban), SCN-33 (ticket detail), SCN-34 (notifications). Coding-plan / 8-PR build sequence folded in. Build is gated only by ADRs landing alongside the schema PR.'
---

# SESSION BRIEF · bu-coordination-board — cross-team coordination surface

_Brief version: 0.4 (Direction A locked, parked feedback applied, build sequence folded in) · Author: Paul (via Claude) · Date: 2026-05-03_

A configurable kanban board where each working group sees its own queue
of work, members can claim and collaborate on cards, and the same job
can be directed at one or more groups (including external networks like
CUFI) without losing per-group state. Three surfaces sit on one shared
coordination spine:

1. **Kanban board** — per-group view with configurable columns. Where
   work is allocated, claimed, and moved through stages.
2. **Ticket detail** — where the work happens. Multi-assignee, urgent
   flag, editable description, threaded comments + internal notes +
   system events, share-with-team.
3. **Notifications pane** — thin alerts surface, separate from the
   boards. Subscriber-driven by default; opt-in for team-wide blasts.

All three are gated by `coord_board_v1` (registered, prod OFF, dev OFF
by default — admin flips when ready). Members behind the flag enter the
board from the new Board tab in `AppNav` (first slot, before Feed —
shipped #192 / v0.2.71).

---

## Why this exists / why now

GPS coordination today happens in WhatsApp threads. Work is allocated
verbally, status is held in people's heads, and cross-team handover is
invisible. Leonid's proposal: a kanban board where each working group
(Writers, Radio, Social Media, IT, F2F, …) sees the tickets they own,
sysadmins see the lot, and members across teams can hand work to each
other without losing track.

Jeremy approved the direction in principle. The Jira-style mockup was
rejected as "alien" for non-technical members; the simpler colourful
card layout was approved. POC sketches at
`docs/product/coordination-board-sketches/` carry the visual direction
forward — Surface 1 (kanban desktop) is POC-accepted as drawn; Surface
2 (ticket detail) has parked feedback applied here; Surface 3
(notifications) reached final read-through.

Without this BU, GPS retains its WhatsApp-coordination ceiling: no
backlog, no prioritisation, no audit, no cross-team visibility.

---

## Objective

Ship a configurable kanban board where each working group sees its own
queue of tickets, admins can configure column names and order per
group, members can subscribe / unsubscribe to individual jobs and
choose how they're notified, and the same ticket can be directed at
one or more groups (including external networks) without losing
per-group state.

Success looks like: a Writer logs in, lands on the Writers board, sees
four columns (Recruitment / Preparation / Implementation / Monitoring)
with cards for active writing tasks, opens one and is auto-subscribed
on assigning herself, gets a WhatsApp notification when it moves to
Review, and can drill up to a "Choose another group" picker showing
only the groups she belongs to.

---

## Direction B (shared inbox) — considered and rejected

A SleekFlow-style filterable list with personal lenses (`Assigned to
me`, `Collaborations`, `Mentions`) was considered as an alternative
inbound metaphor. Both Paul and Leonid landed on the same answer
independently: "we communicate inside each ticket" — the kanban
metaphor matches how the team actually moves work, the inbox metaphor
treats work like customer-support conversations. Direction B is not
revived; the corresponding open questions (was Q14-Q18 in v0.3) are
dropped.

The Notifications pane (Surface 3) absorbs the "personal lens" need
that originally motivated parts of Direction B — `Assigned to me`,
`Mentions`, and `Subscribed-to` are notification filters, not separate
inbox views.

---

## Surfaces

### Surface 1 — Kanban board (per-group)

Default landing per group. Configurable columns (system defaults +
per-group override). Three tabs along the top: **Active** (the
columns) · **Backlog** (off-board intake, list-default) · **Done**
(off-board archive, list-default). "+ Propose to backlog" outline
button in the header. No filter chips beyond Urgent. Cards show:
title · kind glyph · multi-assignee avatar row with `+N` overflow ·
priority chip (Urgent only) · last-updated. Unclaimed cards have a
warning-subtle yellow background.

Drag-reorder updates `Request.boardPosition` (Decimal); column
transitions update `Request.columnId` and write an audit row.
Recruitment → Preparation auto-fires on first self-assign.

Mobile: columns flatten to a vertical list; status becomes a coloured
tag pill (the "tag-switcher" pattern, confirmed in the meeting). List
view is also available for Active on desktop, behind a toggle (Backlog
and Done are list-default).

### Surface 2 — Ticket detail

Where work happens. Layout (post-feedback):

- **Title row** with edit affordance (any group member can edit;
  audit-logged).
- **Action pair (unified):** **Assign me / Unassign** sits adjacent
  to **Follow / Unfollow**. Self-assigning auto-subscribes (per Tier-2
  default #4); explicit unfollow is a separate gesture and survives
  unassign. Both controls share visual language and adjacency to
  surface that "subscribe" and "assign me" are the same conceptual
  motion at different commitment levels.
- **Multi-assignee row** — `Assignment` join, no single-owner
  vocabulary. First-assignee gets no special status.
- **Urgent flag** (per `Request.isUrgent`).
- **Editable description** (`Request.body` editable by any group
  member, audit-logged).
- **Interleaved thread:** Comments (`Comment.kind = comment`) +
  Internal notes (`Comment.kind = note`) + System events
  (`Comment.source = system`). Compose tabs switch between
  Comment / Note (visually distinct — yellow tint for Note).
- **Single share control:** **Share with team.** Replaces the prior
  "Share-with-team" + "Invite group" pair (collapsed per parked
  feedback 2026-05-03). One control covers both routes — admin-pre-set
  workflow allow-list (per `GroupShareWorkflow`) and ad-hoc cross-team
  share. Picker shows allowed teams; picking creates a `RequestGroup`
  row.
- **Right meta sidebar** — assignees, subscribers (read-only list with
  "+N" overflow if long), labels, kind, group(s), last activity.

### Surface 3 — Notifications pane

Thin alerts surface, separate from the boards. Reached via the
`Notification` tab (the existing `inbox` glyph in `AppNav`). Rows are
list-only. Tinted (`primary-subtle`) row background = unacknowledged;
acknowledged rows are plain white. Clicking a row → opens the source
ticket → auto-acknowledges. No separate "mark read" gesture.

Capacity callout: list capped (limit + auto-scroll); `View all` link
opens the full history. Trigger rules split:

- **Defaults (subscriber-driven):** author + assignees + ever-mentioned
  → notified on transitions, comments, urgent flips.
- **Opt-in (team-wide blasts):** group admins can announce to the
  whole group via the Notifications path; recipients can mute per-flag.

Per-user preferences (channel + frequency) live in account settings;
per-group override is allowed (Tier-2 default #5).

---

## Scope (build list)

### Schema (8 entities/extensions, contract-locked migration)

- `Group.kind: GroupKind` enum (`workstream | region | network |
  team | topic`). ADR — the existing `Group` model is per D043;
  this adds the kind dimension without breaking it.
- `Assignment` join table (Request × User, multi-assignee, replaces
  `Request.claimedByUserId`). Auto-subscribes on insert (Tier-2 #4).
- `RequestGroup` join table (Request × Group, with per-link state).
  Covers both admin-pre-set workflow share and ad-hoc share — single
  primitive per parked feedback (drops the prior `GroupInvite` plan).
- `GroupShareWorkflow` — per-team admin allow-list of share targets.
  Constrains the picker on Surface 2's "Share with team."
- `BoardColumn` entity (per-group, configurable, ordered, with
  system defaults seeded per `GroupKind`).
- `Comment.kind: CommentKind` enum (`comment | note`); `.source`
  enum (`human | system`).
- `Notification` lifecycle (`new | acknowledged | dismissed`);
  `Notification.reasonKind` enum (`assignment | mention |
  status-change | comment | urgent-flip | team-blast`).
- `Subscription.source` enum (`auto-author | auto-assignee |
  auto-mention | explicit | team-blast-optin`). No TTL — the
  earlier "@mention 24h temp access" idea is dropped (Direction B
  carve-out, not needed under kanban).

`Request` field changes:

- Drop `Request.claimedByUserId` (replaced by `Assignment`).
- Make `Request.requestType` nullable (kanban tickets carry `null`;
  vetting / flag / kind_review / outcome_review / dedup_merge /
  edit_request / incident / content_submission / link_submission
  rows keep their existing values). Resolved 2026-05-04 — the brief's
  earlier "drop the enum" line was ambiguous; Option B (nullable, not
  removed) was chosen because all 9 enum values are still in active
  use by non-kanban surfaces. The kanban surface itself does not
  branch on requestType — that's what "every ticket is just a ticket"
  means.
- Add `Request.columnId: String?` (FK to `BoardColumn`).
- Add `Request.boardPosition: Decimal` (manual reshuffle).
- Add `Request.isUrgent: Boolean`.
- Reframe `Request.status` as `RequestStatus = backlog | active |
  done | abandoned` (Tier-2 default #1, supersedes D054 collapse).

### Services

- `server/services/groups.ts` — CRUD + RBAC (system-admin +
  group-admin).
- `server/services/board.ts` — column config, drag-reorder, status
  transitions, position math.
- `server/services/assignments.ts` — assign / unassign, auto-subscribe
  hook.
- `server/services/subscriptions.ts` — subscribe / unsubscribe,
  auto-rules, mention extraction.
- `server/services/notifications.ts` — fan-out per scope + channel,
  lifecycle transitions, team-blast path.
- `server/services/share.ts` — share-with-team (workflow allow-list +
  ad-hoc), `RequestGroup` creation.

### Routers

- `server/routers/group.ts`
- `server/routers/board.ts`
- `server/routers/subscription.ts`
- `server/routers/assignment.ts`
- `server/routers/notification.ts`
- `server/routers/share.ts`

### App routes + components

- `app/board/page.tsx` — already shipped as a placeholder (#192). To
  be replaced with the group-areas selector (only groups the user
  can access).
- `app/board/[groupSlug]/page.tsx` — the board view (Active tab
  default, Backlog / Done tabs available).
- `app/board/[groupSlug]/backlog/page.tsx`,
  `app/board/[groupSlug]/done/page.tsx`.
- `app/board/[groupSlug]/[ticketId]/page.tsx` — Ticket detail.
- `components/board/Card.tsx` · `Column.tsx` · `MobileTagSwitcher.tsx`
  · `BoardActionPair.tsx` (the Assign-me / Follow unified pair) ·
  `ShareWithTeamPicker.tsx` · `CommentNoteThread.tsx` ·
  `NotificationRow.tsx` · `NotificationCapacityCallout.tsx`.

### ADRs (5, all land alongside schema PR)

1. **`RequestStatus` redesign** — supersedes D054 collapse plan.
   Reframe to `backlog | active | done | abandoned`; `BoardColumn`
   carries the visual workflow within `active`.
2. **`BoardColumn` configurability + ownership** — system defaults
   seeded per `GroupKind` via reference-data migration (D070);
   group admins override.
3. **`Comment.kind` + `.source`** — note vs comment, human vs system.
4. **`Notification` lifecycle + `reasonKind`** — three-state
   lifecycle, six reason kinds.
5. **`RequestGroup` + `GroupShareWorkflow`** — share-with-team
   semantics, receiving-team permission envelope. Subsumes the
   originally-planned separate Invite-group ADR.

(`GroupMembership.role: lead → admin` — Tier-2 default #8 — is a
rename, not an ADR. Migrates inline with the schema PR.)

### Reference-data migration

- `BoardColumn` system defaults per `GroupKind`. Per D070, these
  ship in `prisma/migrations/`, not `scripts/seed.ts`. Idempotent
  (`ON CONFLICT (groupKind, ordinal) DO NOTHING`).

### Do NOT touch (this BU)

- Anything outside `Request`, `Group`, `GroupMembership`, `Comment`,
  `Notification`, `Subscription`, and the new entities listed above.
- WhatsApp dispatch internals (notifications use the existing send
  path).
- The `/feed` and `/calendar` surfaces.

### Out of scope for this BU

- Real-time presence (who's looking at this card right now).
- Time-tracking / SLA timers.
- Cross-board templates or recurring tickets.
- Inline file attachments on cards (use the linked Request).
- Public / external read-only board view.
- TTL access for @mentions (Direction B carve-out, not needed).

---

## Permission model

| Action | Member of group | Group admin (`role: admin`) | System admin |
|---|---|---|---|
| View this group's board | ✓ | ✓ | ✓ |
| Claim (`Assignment.create`) | ✓ | ✓ | ✓ |
| Move card between columns | ✓ (own assignment) | ✓ (any) | ✓ |
| Edit description (`Request.body`) | ✓ (audit-logged) | ✓ | ✓ |
| Reshuffle column order (drag) | — | ✓ | ✓ |
| Configure columns for the group | — | ✓ | ✓ |
| Approve join requests | — | ✓ | ✓ |
| Promote member → group admin | — | ✓ | ✓ |
| Create new group | — | — | ✓ |
| Archive group | — | — | ✓ |
| Share Request to another team | ✓ (within `GroupShareWorkflow` allow-list) | ✓ (any team) | ✓ |
| Send team-blast notification | — | ✓ | ✓ |
| Configure `GroupShareWorkflow` | — | ✓ | ✓ |

---

## Tier-2 defaults — applied (locked for this build)

Confirmed by Paul 2026-05-03; baked into the build instead of left
open.

| # | Question | Applied default |
|---|---|---|
| 1 | `RequestStatus` values | `backlog · active · done · abandoned` |
| 2 | Column configurability | System defaults per `GroupKind`; per-group override allowed |
| 3 | Recruitment → Preparation transition | Auto on first self-assign |
| 4 | Auto-subscribe rule | Author + all assignees + ever-mentioned |
| 5 | Per-group notification override | Allowed |
| 6 | Network attach authority | Network admin can self-attach |
| 7 | Backlog / Done view defaults | List-by-default for both |
| 8 | `GroupMembership.role` rename | `lead → admin`, yes (inline migration) |
| 9 | Network self-attestation | Per-network setting (admins decide on creation) |
| 10 | Subscriber definition | Author + assignees + manually-subscribed + ever-mentioned |

---

## Tier-1 — settled (carry-forward decisions)

- **Direction A wins** (kanban). Direction B (shared inbox)
  rejected.
- **Broadcast split** to `bu-broadcast.md` (#191).
- **`RequestType` collapsed** — every ticket is just a ticket.
- **Multi-assignee per ticket** — drop "owner" vocabulary;
  `Assignment` join.
- **Description-edit RBAC** — any group member, audit-logged.
- **Subscribe ↔ Assign-me are the same function** at different
  commitment levels — unified language, adjacent placement
  (parked feedback applied).
- **Share-with-team and Invite-group merge** to one "Share with
  team" — single `RequestGroup` primitive, no `GroupInvite`
  (parked feedback applied).

---

## Open questions remaining (do not block schema PR)

The questions still in front of build are UI-shape questions on the
Tier-2 new primitives. Schema lands; UI follows once these settle.

1. **Share-with-team workflow config UI.** Where do group admins set
   the per-team allow-list? Recommend: a section on the group
   settings page (`/board/[groupSlug]/settings`). Surface not yet
   sketched.
2. **Cross-team flags-in-corner.** Trigger logic + render of the
   small badge in the team picker. Touched in Surface 3 callouts;
   not yet a dedicated sketch. Likely a derived UI signal, no new
   schema.
3. **Card top fields.** Surface 1 confirms title + kind glyph +
   assignee avatars + Urgent + last-updated. Confirm at design pass
   when implementing `Card.tsx`.

---

## Schema additions (consolidated)

```
# Type extensions
GroupKind                            : enum  # workstream | region | network | team | topic
RequestStatus                        : enum  # backlog | active | done | abandoned  (replaces existing)
CommentKind                          : enum  # comment | note
CommentSource                        : enum  # human | system
NotificationLifecycle                : enum  # new | acknowledged | dismissed
NotificationReasonKind               : enum  # assignment | mention | status_change | comment | urgent_flip | team_blast
SubscriptionSource                   : enum  # auto_author | auto_assignee | auto_mention | explicit | team_blast_optin

# New entities
Assignment                           : Request × User join (multi-assignee)
RequestGroup                         : Request × Group join (share-with-team; covers both workflow + ad-hoc)
GroupShareWorkflow                   : per-team admin allow-list of share targets
BoardColumn                          : per-group, configurable, ordered

# Field changes — Group
Group.kind                           : GroupKind

# Field changes — Request
Request.status                       : RequestStatus  (re-enum)
Request.columnId                     : String?  (FK BoardColumn)
Request.boardPosition                : Decimal
Request.isUrgent                     : Boolean
- Request.claimedByUserId             # dropped, replaced by Assignment
~ Request.requestType                 # made nullable (Option B, 2026-05-04); kanban cards carry null

# Field changes — Comment
Comment.kind                         : CommentKind
Comment.source                       : CommentSource

# Field changes — Notification
Notification.lifecycle               : NotificationLifecycle
Notification.reasonKind              : NotificationReasonKind

# Field changes — Subscription (existing RequestSubscription)
Subscription.source                  : SubscriptionSource

# Field changes — GroupMembership
GroupMembership.role: lead → admin   # rename, inline migration
```

---

## Build sequence (8 PRs)

Each PR is a discrete reviewable unit, behind `coord_board_v1`. Order
matters where indicated.

| # | Scope | Depends on |
|---|---|---|
| **1** | **Schema + 5 ADRs** — all schema additions above + reference-data migration for `BoardColumn` defaults + the 5 ADRs in one PR. Pure Prisma + ADR text; no behaviour. | — |
| **2** | **Services** — `groups`, `board`, `assignments`, `subscriptions`, `notifications`, `share`. Unit tests at the service layer. | #1 |
| **3** | **Routers** — tRPC procedures + integration tests. | #2 |
| **4** | **Surface 1 — Kanban board view** at `/board/[groupSlug]`. Active / Backlog / Done tabs. Drag-reorder. | #3 |
| **5** | **Surface 2 — Ticket detail** at `/board/[groupSlug]/[ticketId]`. Unified Assign-me / Follow pair, single Share-with-team, comment / note thread. | #4 |
| **6** | **Surface 3 — Notifications pane** under the existing `Inbox` AppNav tab. Subscriber-driven defaults + opt-in team-blast. | #5 |
| **7** | **Mobile** — tag-switcher, responsive board, reflow. | #4–#6 |
| **8** | **Flag flip** — `coord_board_v1` ON in prod for the named pilot teams (Writers + IT first). | #1–#7 |

Estimate: ~10–12 days for one engineer, parallelisable to ~7 days
with two (services + first surface in parallel after #1).

---

## Tests required

Across all 8 PRs the test surface is:

- **Unit (services):** column transitions respect lifecycle invariants
  (no `active` row without `columnId`; Backlog / Done are off-board).
  Subscription auto-rules fire on author / assign / mention.
  Notification fan-out respects scope + channel preferences.
  Self-assigning auto-subscribes; unassigning leaves subscription.
  Share-with-team picker respects `GroupShareWorkflow` allow-list.
- **Integration (routers):** directing a Request at two groups
  creates two `RequestGroup` rows, each with independent state.
  Drag-reorder updates `boardPosition` without renumbering. Editing
  description writes an audit row. Cross-group comment visibility
  respects `Comment.kind` (notes hidden from non-team-members).
- **Component:** card and list views render the same data
  correctly. Mobile tag-switcher behaves as a column-equivalent.
  Action pair (`BoardActionPair.tsx`) handles all four state
  combinations (assigned/unassigned × following/not).
- **E2E:** vetted user joins Writers → sees only Writing board →
  drills up → switches to IT board (only if also a member) → cannot
  see Radio. Author-of-ticket auto-subscribed; receives notification
  on status change; click → ticket → auto-ack.

---

## Definition of done (across the 8-PR sequence)

- [ ] All 5 ADRs merged.
- [ ] Reference-data migration seeds default `BoardColumn` sets per
      `GroupKind`.
- [ ] `coord_board_v1` flipped on for pilot teams in prod.
- [ ] `npm run trackers` updated; `bu-sequence.md` reflects shipped
      status.
- [ ] Non-technical walkthrough doc updated to match shipped UX.
- [ ] Notification preferences accessible via account settings, not
      buried.
- [ ] At least one writer + one IT-team member used the board
      end-to-end without intervention (pilot acceptance).

---

## Companion scenarios

- **SCN-32** — Leonid claims a writing job from the Writers board
  (kanban / Surface 1).
- **SCN-33** — Sharon shares a job to the IT team and comments
  internally (ticket detail / Surface 2; exercises unified
  Assign-me / Follow + single Share-with-team).
- **SCN-34** — Maya gets a notification about a stuck card and
  acknowledges by clicking through (notifications / Surface 3).

---

## Context

- POC sketches: `docs/product/coordination-board-sketches/`
  (index.html · 3 surfaces · SVG + JPG).
- Companion non-technical walkthrough:
  `docs/product/coordination-board-overview.md`.
- Earlier handoff: `docs/build/session-handoffs/bu-coordination-board-2026-05-03.md`
  (carries the SleekFlow-comparison thinking that fed the
  rejected Direction B; preserved for archaeology).
- Existing schema: `prisma/schema.prisma` — `Group`,
  `GroupMembership`, `Request`, `RoleGrant`, `Notification` already
  cover ~70% of the primitives.
- D043 (Groups model) — base for `Group.kind`.
- D054 (Request rename + status collapse plan) — superseded by
  ADR #1 in the schema PR.
- D042 (CoordinatorProfile sidecar pattern) — template for
  `NetworkProfile` if Networks ever sprout fields.
- D070 (reference data lives in migrations, not seed scripts) —
  applies to default column sets.
- D036 + `docs/product/feature-flag-register.md` — `coord_board_v1`
  registered, currently OFF in both prod and dev.
- Parking lot: "Identity & affiliation ideas → Partner
  Organisations" (will be §3.30 in v0.6) — Networks land here.
