---
slug: bu-coordination-board
status: planned
phase: 3
priority: high
note: 'Stub captured 2026-05-03 from Leonid pitch + cross-team meeting (Simon/Harry/Grant/Paul/Jeremy/Leonid). Awaiting (1) technical-feasibility review with the four-person tech group and (2) prototype UI before non-technical stakeholders can evaluate. Brief is shaped enough to anchor that meeting; decisions block code.'
---

# SESSION BRIEF · bu-coordination-board — cross-team kanban with per-group views

_Brief version: 0.1 (stub) · Author: Paul (via Claude) · Date: 2026-05-03_

This is a **planned-status stub** capturing the agreed direction from
the Leonid-led meeting (2026-05-02). It is not yet ready to build.
Two gates sit in front of execution: a tech-feasibility review with
Simon, Harry, Grant, and Paul (booking pending), and a UI prototype
to take to non-technical stakeholders (writers, partner-org leads).

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
