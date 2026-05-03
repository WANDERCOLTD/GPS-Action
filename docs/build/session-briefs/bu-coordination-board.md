---
slug: bu-coordination-board
status: planned
phase: 3
priority: high
note: 'Stub captured 2026-05-03 from Leonid pitch + cross-team meeting (Simon/Harry/Grant/Paul/Jeremy/Leonid). Awaiting (1) technical-feasibility review with the four-person tech group and (2) prototype UI before non-technical stakeholders can evaluate. Two UI directions on the table for the inbound surface — kanban-board (Direction A) vs shared-inbox a la sleekflow.io (Direction B) — plus an outbound Companion (Broadcast, SleekFlow-style 4-step wizard) folded in 2026-05-03 PM after a closer look at the SleekFlow Inbox + Broadcast tour pages. Tech review picks the inbound direction; Broadcast can ride alongside or be split into its own BU later. Brief is shaped enough to anchor the meeting; decisions block code.'
---

# SESSION BRIEF · bu-coordination-board — cross-team coordination surface

_Brief version: 0.3 (Inbox sharpened + Broadcast companion folded in) · Author: Paul (via Claude) · Date: 2026-05-03_

This is a **planned-status stub** capturing direction from the
Leonid-led meeting (2026-05-02), expanded 2026-05-03 after reviewing
sleekflow.io's Inbox and Broadcast product surfaces.

**Three surfaces, one shared spine.** The coordination board is now
framed as three pillars sharing one identity / Group / Network /
Channel / Label / Audit substrate:

1. **Inbox** — inbound + collaborative work. Two UI directions still
   on the table for this surface:
   - **Direction A — kanban board** (Leonid's original pitch).
   - **Direction B — shared inbox** (SleekFlow-style list with status
     filters and personal lenses).
2. **Broadcast** — outbound, one-to-many, structured campaigns to
   Groups / Networks / Regions / Roles. SleekFlow's 4-step wizard
   (Segmentation → Personalization → Automation → Analytics) maps
   cleanly onto "GPS sends this to our Groups or Networks." Folded in
   here as a **Companion surface**; can be split into `bu-broadcast`
   later if review prefers that split.
3. **Coordination state** — the schema that both surfaces sit on
   (Requests, ownership, status, comments, subscriptions, labels).

Inbox A and Inbox B share ~70% of the schema; Broadcast adds a
campaign primitive plus a per-recipient delivery state, but reuses
audience (Groups/Networks/Regions/Roles), channels, labels, and audit.
Pick the Inbox metaphor in tech review; the data model adapts and
Broadcast layers on top either way.

Two gates remain in front of execution: a tech-feasibility review
with Simon, Harry, Grant, and Paul (booking pending), and a UI
prototype to take to non-technical stakeholders (writers, partner-
org leads).

---

## Why this exists / why now

GPS coordination today happens in WhatsApp threads. Work is allocated
verbally, status is held in people's heads, and cross-team handover
is invisible. Leonid's proposal: a kanban board where each working
group (Writers, Radio, Social Media, IT, F2F, …) sees the tickets
they own, sysadmins see the lot, and members across teams can hand
work to each other without losing track.

Jeremy approved the direction in principle. The Jira-style mockup
was rejected as "alien" for non-technical members; the simpler
colourful card layout was approved. Mechanics first, friendly UI
next, non-technical evaluation after that.

Without this BU, GPS retains its WhatsApp-coordination ceiling: no
backlog, no prioritisation, no audit, no cross-team visibility.

---

## Objective

Ship a configurable kanban board where each working group sees its
own queue of tickets, admins can configure column names and order
per group, members can subscribe/unsubscribe to individual jobs and
choose how they're notified, and the same ticket can be directed at
one or more groups (including external networks like CUFI) without
losing per-group state.

Success looks like: a Writer logs in, lands on the Writers board,
sees four columns (Recruitment / Preparation / Implementation /
Monitoring) with cards for active writing tasks, opens one and
subscribes, gets a WhatsApp notification when it moves to Review,
and can drill up to a "Choose another group" picker showing only
the groups they belong to.

---

## Scope (sketch — to be fleshed out post-tech-review)

### Build (tentative)

- `prisma/schema.prisma` (additions only — no destructive change):
  - `Group.kind: GroupKind` enum (`workstream | region | network | team | topic`)
  - `BoardColumn` entity (per-group, configurable, ordered)
  - `RequestGroup` join table (Request × Group, with per-link state)
  - `RequestSubscription` (per user per ticket, with explicit/auto source)
  - `NotificationPreference` (user-level + per-group sidecar)
  - `Request.boardPosition: Decimal` for manual reshuffle
  - `Request.columnId: String?` (FK to `BoardColumn`)
  - Lifecycle revision: `RequestStatus` reframed as
    `backlog | active | done | abandoned` (D054 collapse plan revisited
    in light of `BoardColumn` carrying the visual workflow)
- `server/services/groups.ts` — CRUD + RBAC (system-admin + group-admin)
- `server/services/board.ts` — column config, drag-reorder, transitions
- `server/services/subscriptions.ts` — subscribe/unsubscribe, auto-rules
- `server/services/notifications.ts` — fan-out per scope + channel
- `server/routers/group.ts` / `board.ts` / `subscription.ts`
- `app/(member)/board/[groupSlug]/page.tsx` — the board view (card + list)
- `app/(member)/board/[groupSlug]/backlog/page.tsx` — off-board intake
- `app/(member)/board/[groupSlug]/done/page.tsx` — off-board archive
- `app/(member)/board/page.tsx` — group-areas selector (only groups
  the user can access)
- `components/board/Card.tsx` / `Column.tsx` / `MobileTagSwitcher.tsx`
- ADR for the `RequestStatus` redesign (supersedes the D054 collapse plan)
- ADR for `BoardColumn` configurability + ownership

### Do NOT touch (this BU)

- Anything outside `Request`, `Group`, `GroupMembership`, and the new
  entities listed above.
- Existing `RequestType` enum (this BU adds the board view; types stay).
- WhatsApp dispatch internals (notifications use the existing send path).

### Out of scope for this BU

- Real-time presence (who's looking at this card right now).
- Time-tracking / SLA timers.
- Cross-board templates or recurring tickets.
- Inline file attachments on cards (use the linked Request).
- Public/external read-only board view.

---

## Permission model (sketch)

| Action | Member of group | Group admin (`role: lead`) | System admin |
|---|---|---|---|
| View this group's board | ✓ | ✓ | ✓ |
| Claim a card | ✓ | ✓ | ✓ |
| Move card between columns | ✓ (own claim) | ✓ (any) | ✓ |
| Reshuffle column order (drag) | — | ✓ | ✓ |
| Configure columns for the group | — | ✓ | ✓ |
| Approve join requests | — | ✓ | ✓ |
| Promote member → group admin | — | ✓ | ✓ |
| Create new group | — | — | ✓ |
| Archive group | — | — | ✓ |
| Attach group to a Request | — | ✓ | ✓ |

---

## Open questions (block tech-review meeting)

1. **`RequestStatus` redesign.** D054 collapse to (new/in_discussion/done)
   pre-dates the configurable-column model. Likely new shape:
   `backlog | active | done | abandoned`, with `Request.columnId`
   carrying the visual stage. Needs ADR before any code touches status.
2. **Multi-claimer per ticket.** Today `Request` is single-claimer.
   If a "Doing" card means "team of 3 working together," we need an
   `Assignment` join table. Confirm intent.
3. **Column configurability scope.** Per-group only, or system defaults
   that groups can override? Recommend the latter.
4. **Recruitment → Preparation transition.** Auto on claim, or manual
   move by claimer? Affects card UX and audit trail.
5. **Auto-subscribe rules.** Author + claimer + @mentioned is obvious.
   Should group admins be auto-subscribed to *everything* in their
   group?
6. **Per-user vs per-group notification preferences.** Meeting captured
   per-user. Recommend allowing per-group override (a Writer might want
   "all" for Writing, "mentions only" for an IT board they're tangentially
   in). Confirm.
7. **Network attachment authority.** Can a Network admin (e.g. CUFI rep)
   self-attach their network to a Request, or must the Request creator
   direct it to them? Affects trust model.
8. **Cross-group visibility on multi-group Requests.** When CUFI and
   Writers are both directed at one Request, does each see what the
   other is doing? Default yes; some Requests may want isolation.
9. **Card top: what fields show?** Meeting left this open ("Job name,
   …. ?"). Title + kind glyph + claimer avatar + priority chip + last-
   updated suggested; confirm at design pass.
10. **Mobile layout: tags-instead-of-columns.** Confirmed in meeting.
    SCN write-up needed so it doesn't drift. Card `Status` becomes a
    coloured tag pill in a vertical scroll list.
11. **List vs card view toggle on Backlog and Done.** Meeting confirmed
    both layouts available. Default per view? List for Backlog, cards
    for active board, list for Done is the natural pattern.
12. **`GroupMembership.role` rename: `lead → admin`.** Cleaner UI copy,
    matches user language. One migration, no data loss. Recommend yes.
13. **Networks with self-attestation membership.** A user saying "I'm
    affiliated with CUFI" might not need admin approval the way joining
    Writers does. Maps to existing `Group.joinPolicy = open` per-kind.
    Confirm the model holds.

---

## Direction B — shared inbox (sleekflow.io style) — under consideration

Added 2026-05-03 after reviewing sleekflow.io's Inbox product. **Not
yet decided** vs Direction A (kanban board, above). Tech review picks
between them — or chooses a hybrid where the kanban becomes a Phase 2
view on top of a list-first inbox.

### What SleekFlow actually is

A **shared inbox** for customer conversations across channels. UI is
a 3-pane layout — left sidebar of views, centre conversation list,
right conversation detail. Crucially, **no kanban columns**. The "board"
is a filterable list with a status filter at the top:
**Open · Snoozed · Closed · All**, shown with a live count
(e.g. `Open (1350)`) so triage load is visible at a glance.

Personal navigation in the left sidebar groups views by user role:

- **My views:** *Assigned to me* · *Collaborations* · *Mentions* ·
  *Starred* · *Scheduled*
- **Company views:** *All* (unified across teams you can access) +
  per-team folders (= per-team inboxes, e.g. *Sales*, *Marketing*,
  *Support HK*, *Support MY* — note the geographic split, which maps
  cleanly to GPS regional working groups)

### Additional UX patterns observed (Inbox tour, 2026-05-03)

A closer look at the Inbox product page surfaced a handful of patterns
worth lifting verbatim into Direction B:

- **Status filter with live count** (`Open (1350)` dropdown header).
  Surfaces queue depth without a separate dashboard.
- **Unassigned / Assigned grouping inside Open** — not a separate
  filter, an in-list grouping. Forces unassigned items to the top so
  admins can sweep through.
- **Read indicator per row** (double-tick) — assignee-has-opened
  awareness, no notification needed.
- **Channel / source badge per row** (WhatsApp / IG / TikTok glyph in
  SleekFlow). For GPS, this maps to job *origin*: composed in-app vs
  `/share` ingest vs partner-org submission vs RSS pull.
- **Multi-label chips per row with overflow** (`INBOUND · RENT ·
  FEMALE · 2+`). Confirms the labels-on-cards pattern at row level.
- **Two distinct routing verbs** in the assign panel: **"Assign via
  team"** (re-route or add a team to the conversation) vs **"Assign
  to user"** (set owner inside the current team). These are different
  gestures and should look different in the UI; conflating them is a
  common collaboration-tool failure mode.
- **Reply / Internal note as tabs**, not a checkbox. Tab switch
  changes composer styling (yellow tint for internal). Visual mode
  prevents misposting an internal thought publicly.
- **System-message badge** ("Automated message") in the thread —
  bot/system entries are distinguished from human comments in-thread,
  preserving audit visibility.
- **Search-name-or-email picker** scoped to current team for
  "Assign to user."
- **Top-bar action separation:** add-collaborator (person-plus icon)
  is a different control from set-owner (assign panel). Worth keeping
  distinct in the GPS UI too.
- **Saved replies** appear in SleekFlow's marketing rail as a
  per-team library of canned responses — a Phase 2 candidate for GPS
  (partner-org liaisons repeat the same intake/triage messages).

### SleekFlow primitives mapped to GPS

| SleekFlow | GPS equivalent | Already in Direction A? |
|---|---|---|
| Conversation | `Request` | yes |
| Channel (WhatsApp/IG/etc) | n/a — GPS jobs originate in-app | — |
| Team / Team inbox | `Group` (kind=workstream) | yes |
| Assignee / Contact Owner (one per item) | `Request.claimedByUserId` | yes (claim-and-lease) |
| Collaborator (many, full reply access) | `RequestSubscription` (`source=explicit`) | yes |
| @mention with 24h temp access | **NEW** — TTL on `RequestSubscription` | no |
| Status: Open / Snoozed / Closed | `backlog / active / done` + **add `snoozed`** | partial |
| Labels | `Request.labels: String[]` (new, lightweight) | no |
| First-to-reply becomes owner | Maps to claim-and-lease | yes |
| Internal note vs reply | `CommentAudience: all | reviewers` | yes (existing) |
| Saved replies / AI smart reply | n/a for MVP | — |

### What changes if Direction B wins

1. **The board becomes a *view*, not the metaphor.** Default landing
   per group: a filterable list (Open / Snoozed / Closed) with the
   three personal lenses in a left sidebar. Kanban-with-columns
   survives as an optional toggle for planners and admins.
2. **`BoardColumn` configurability drops from P0 to Phase 2 polish.**
   Significantly simpler — removes one of the hairier ADRs from the
   critical path.
3. **D054 status-collapse can land cleanly:** 4–5 lifecycle values,
   no orthogonal column model needed at MVP.
4. **Three default personal views:** *Assigned to me* · *Collaborating*
   · *Mentions* — queries over the same `Request` table; not new
   entities.
5. **Add `snoozed`** — recommendation: a `snoozedUntil: DateTime?`
   field that hides the row from default views until the timestamp
   passes, rather than a new lifecycle state. Sweeper similar to
   claim TTL.
6. **First-class `@mention` with TTL temp access.** When a comment
   @-mentions a user, auto-grant 24h read access to that Request,
   even if they're not a member of the directing Group. Schema:
   extend `RequestSubscription` with `expiresAt: DateTime?`.
7. **Lightweight Labels.** Distinct from `Group` — admin/user-applied
   tags on individual Requests for ad-hoc filtering ("urgent-this-
   week", "needs-Hebrew-translation"). `Request.labels: String[]`
   is enough for v1.
8. **Non-tech sell improves significantly.** "Imagine SleekFlow's
   inbox, but for our internal jobs" is a far easier pitch to Jeremy
   and the writers than abstract column diagrams.
9. **Star** as a 4th personal lens (lightweight per-user bookmark,
   distinct from Subscribe). Cheap to add — `Star` join or
   `Request.starredBy: User[]`.
10. **Scheduled** as a 5th personal lens — for GPS this is the natural
    home for drafts queued for publish, snoozed-by-me items surfacing
    as their wake-time approaches, and (if Broadcast lands) campaigns
    you've authored that are not yet sent.
11. **System messages in-thread.** Implies `Comment.source: human |
    system` (or a separate `SystemEvent` primitive) — needed for
    `/share` ingest, partner submissions, snooze-wakes, broadcast
    delivery summaries.

### What Direction B complicates

- **TTL access for @mentions** has security implications — temp
  readers must be excluded from sensitive Requests. Needs explicit
  policy.
- **First-to-reply becomes owner** is fine for support tickets but
  awkward for activist work where someone might comment without
  intending to take ownership. Likely we want **explicit Claim
  button** even if it drifts from SleekFlow's model.
- **`snoozedUntil`** introduces a date-driven hide rule needing a
  sweeper similar to the existing claim TTL.

### Hybrid option (worth weighing in the meeting)

The two directions are not mutually exclusive at the schema level
(~70% overlap). A workable hybrid:

- **MVP** ships Direction B (list-first shared inbox) — simpler,
  faster, easier to evaluate with non-technical members.
- **Phase 2** adds Direction A's kanban as a per-group toggle for
  admins and planners who want the visual workflow.

This defers `BoardColumn` configurability without abandoning it.

### Open questions that *only* Direction B raises

14. **Snooze model:** state value (`snoozed` in `RequestStatus`) vs
    field (`snoozedUntil: DateTime?`)? Recommend the field.
15. **TTL @mention access:** how long? 24h matches SleekFlow.
    Configurable per group?
16. **Claim semantics:** explicit Claim button (recommended for GPS)
    vs implicit-on-reply (SleekFlow default)?
17. **Labels vs `Group.kind=topic`:** when do we use a label and when
    do we use a topic Group? Risk of two ways to do the same thing.
18. **Default landing view per user:** *Assigned to me* (focus) vs
    the Group inbox (situational awareness)? SleekFlow defaults to
    "Assigned to me."

Sources reviewed (sleekflow.io docs, 2026-05-03):
- https://help.sleekflow.io/en_US/inbox/getting-started-with-sleekflow-inbox
- https://help.sleekflow.io/assigning-and-collaborating-on-conversations
- https://sleekflow.io/inbox
- Inbox UI walkthrough (sleekflow.io/agentflow, screenshot review
  2026-05-03 PM) — used to derive the additional UX patterns above.

---

## Companion surface: Broadcast (outbound) — split into bu-broadcast

The Broadcast / outbound campaign surface that was originally folded
into this brief has been **split into its own BU** as of 2026-05-03 PM
(per Q5 — see `docs/build/session-briefs/bu-broadcast.md`). Reason:
Leonid noted Broadcast "looks like a separate tool from Kanban,"
the review audience differs (comms / Jeremy + partner-org leads vs
Leonid + tech crew), and the schema seam is clean enough to evolve
the two independently.

Coord-Board now owns the inbound + collaborative half (kanban,
ticket detail, notifications pane); `bu-broadcast` owns the outbound
+ measurement half (4-step wizard, audience builder, scheduling,
analytics). They share the audience model (Groups · Networks ·
Regions · Roles), channel model, and label taxonomy at the spine
layer; both ride a single underlying fan-out service. Cross-cutting
seams (Broadcast replies → tickets, shared `MessageTemplate`
library, single fan-out service for Notifications + Broadcast) are
documented in the bu-broadcast brief.

The 13 Broadcast-specific open questions previously listed here as
Q19–Q31 have moved to that brief.

---

## Net-new schema implied (consolidated, both surfaces)

The list below merges Direction B's additions with the new Broadcast
companion. Any of these may be deferred or split across BUs at tech
review; surfaced here so the schema seam is visible up front.

```
# Inbox primitives (Direction B)
Group.kind                           : enum  # workstream | region | network | topic
Request.snoozedUntil                 : DateTime?           # Q14, Q7
Request.labels                       : String[]            # Q13/Q14 (curation)
Request.starredBy                    : User[]   (or Star join)
RequestGroup                         : join    # per-team Open/Snoozed/Closed + (Q2) per-team owner?
RequestSubscription.expiresAt        : DateTime?           # @mention TTL access (Q10)
Comment.source                       : enum  # human | system  (Q12)
CommentAudience                      : keep current (all | reviewers); maybe add team-only (Q11)
MessageTemplate                      : per-team canned-response library (saved replies)

# Broadcast primitives (Companion)
Broadcast                            : campaign object
  - audienceFilterJson               : snapshot of segment definition
  - contentTemplate                  : message body w/ variable pills
  - channels                         : enum[]  # whatsapp | email | inApp | push | sms
  - schedule                         : oneShot | recurring | triggered | drip
  - status                           : draft | scheduled | sending | sent | archived
  - approvedBy                       : User?   # gate above N recipients (Q20)
BroadcastRecipient                   : per-recipient delivery state
  - status                           : queued | sent | delivered | opened | acted | failed | unsubscribed
  - channel                          : whichever the fan-out picked
  - actedAt                          : DateTime?  # for stop-on-action (Q25)
UserChannelPreference                : per-user channel opt-in state (Q21, Q28)
UserUnsubscribe                      : per-user opt-out, per-category (Q28)
BroadcastReply                       : pointer from inbound Request → originating Broadcast (Q29)
```

ADRs implied (likely):

- ADR — `RequestStatus` redesign (supersedes D054, ties Inbox lifecycle).
- ADR — `BoardColumn` configurability (only if Direction A or hybrid wins).
- ADR — TTL access on `RequestSubscription` (security boundary).
- ADR — `Broadcast` + `BroadcastRecipient` shape and approval-gate
  policy (only if Companion stays in this BU; otherwise lives in
  `bu-broadcast`).
- ADR — Single fan-out service shared by Notifications + Broadcast
  (Q26).

---

## Pending dependencies (block build)

- **Tech-feasibility review** with Simon, Harry, Grant, Paul. Leonid
  to book. This brief is the input document.
- **UI prototype** (post-meeting). Non-technical members cannot
  evaluate the system until the prototype reaches a friendly state.
  Jeremy will not approve general rollout without it.
- **Leonid's processed system requirements** — confidential follow-up
  doc from the meeting. May change scope before build.

---

## Tests required (when build starts)

- Unit: column transitions respect lifecycle invariants
  (no `active` row without `columnId`; Backlog/Done are off-board).
- Unit: subscription auto-rules fire on author/claim/mention.
- Unit: notification fan-out respects scope + channel preferences.
- Integration: directing a Request at two groups creates two
  `RequestGroup` rows, each with independent state.
- Integration: drag-reorder updates `boardPosition` without renumbering.
- Component: card and list views render the same data correctly.
- Component: mobile tag-switcher behaves as a column-equivalent.
- E2E: vetted user joins Writers → sees only Writing board → drills up
  → switches to IT board (only if also a member) → cannot see Radio.

---

## Definition of done (when build starts)

Standard per template, plus:

- [ ] ADR for `RequestStatus` redesign merged
- [ ] ADR for `BoardColumn` configurability merged
- [ ] Reference-data migration seeds default column sets per `GroupKind`
- [ ] `npm run trackers` updated; `bu-sequence.md` reflects shipped status
- [ ] Non-technical walkthrough doc updated to match shipped UX
- [ ] Notification preferences accessible via account settings, not buried

---

## Context

- Meeting outcomes (2026-05-02): in this brief's "Open questions" + the
  non-technical companion doc at
  `docs/product/coordination-board-overview.md`.
- Existing schema: `prisma/schema.prisma` — `Group`, `GroupMembership`,
  `Request`, `RoleGrant`, `Notification` already cover ~70% of the
  primitives.
- D054 (Request rename + status collapse plan) — needs supersession.
- D043 (Groups model).
- D042 (CoordinatorProfile sidecar pattern — template for
  `NetworkProfile` if Networks ever sprout fields).
- D070 (reference data lives in migrations, not seed scripts) — applies
  to default column sets.
- Parking lot: "Identity & affiliation ideas → Partner Organisations"
  (will be §3.30 in v0.6) — Networks land here.
