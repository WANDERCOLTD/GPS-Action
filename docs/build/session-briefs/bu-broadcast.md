---
slug: bu-broadcast
status: planned
phase: 3
priority: medium
note: 'Stub split out 2026-05-03 PM from bu-coordination-board.md per Q5 (Leonid + Paul). SleekFlow-Broadcast-style 4-step wizard for sending campaigns to Groups / Networks / Regions / Roles, with audience builder, variable-pill personalization, scheduling/automation, and analytics. Different review audience from the kanban core (comms-side: Jeremy + partner-org leads, vs Leonid + tech crew). 13 open questions to lock before code (was Q19-Q31 in coord-board v0.3). Awaits its own tech-feasibility review.'
---

# SESSION BRIEF · bu-broadcast — outbound campaigns to Groups & Networks

_Brief version: 0.1 (stub, split from bu-coordination-board.md) · Author: Paul (via Claude) · Date: 2026-05-03_

This is a **planned-status stub** capturing the outbound side of GPS
coordination — sending structured campaigns to Groups (Writers, Radio,
Social), Networks (CUFI, partner orgs), Regions (Hendon, Edgware), or
filtered audiences within them. Inspired by SleekFlow's
[Broadcast](https://sleekflow.io/broadcast) product, whose 4-step
wizard (Segmentation → Personalization → Automation → Analytics) maps
cleanly onto "GPS sends this to our Groups or Networks."

Originally folded into `bu-coordination-board.md` as a Companion
surface; split out 2026-05-03 PM (per Q5 in that brief) on Leonid's
observation that Broadcast "looks like a separate tool from Kanban."
The schema seam between the two is clean enough that they evolve
independently — Coord-Board owns the inbound + collaborative half;
Broadcast owns the outbound + measurement half. They share an
audience model (Groups · Networks · Regions · Roles), channel model,
and label taxonomy at the spine layer; both ride a single underlying
fan-out service.

Two gates remain before execution:

1. **Tech-feasibility review** — likely separate from the coord-board
   one, with at least one comms-side stakeholder.
2. **Stakeholder evaluation** with Jeremy + partner-org leads (the
   people who'd actually author broadcasts).

---

## Why this exists / why now

GPS already sends WhatsApp messages out as part of dispatch. What's
missing is the structured layer above it: an audience picker, a
personalised template, scheduling, audit, and analytics. Without
this, sending a "thank you to everyone who shared this week" is a
manual job that doesn't get done. With it, GPS becomes a coordination
*and* mobilisation platform.

Without this BU, GPS retains a one-shot dispatch ceiling: no audience
segmentation, no personalisation, no measurement, no audit of who
got what when.

---

## Objective

Ship a 4-step Broadcast wizard that lets authorised members send a
personalised, multi-channel message to a filtered audience, schedule
it (one-shot, recurring, triggered, or drip), and see post-send
analytics broken down by segment.

Success looks like: Sharon (Writers admin) wants to thank everyone
who shared the Pesach flyer last week. She opens the wizard, picks
audience = "Writers + CUFI, members who shared at least once in the
last 7 days" (live count: 87), composes a message with `{firstName}`
and `{personalShareLink}` variables, picks WhatsApp + email, schedules
for Friday 10am, ships. Friday afternoon she sees 82 delivered, 67
opened, 41 replied with thanks; 3 unsubscribed.

---

## What SleekFlow Broadcast is

A **4-step wizard** for sending personalised messages to a filtered
audience across multiple channels, with scheduling/automation and
post-send analytics:

1. **Segmentation.** Build the audience by filtering contacts —
   labels, channel availability, last-active date, attributes.
2. **Personalization.** Pick channels (WhatsApp / SMS / IG /
   Messenger / WeChat). Name the broadcast. Compose a message
   template with variable placeholders, multimedia attachments,
   dynamic links, and quick-reply buttons. Preview shows a
   per-recipient render.
3. **Automation.** One-shot scheduled, recurring, or triggered
   (event-driven). Stop-on-action rules.
4. **Analytics.** Delivery rate, open rate (channel-permitting),
   click-through, reply rate, action-taken, unsubscribe rate.

---

## Mapping to GPS

| SleekFlow Broadcast            | GPS analogue                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Channels (WA / SMS / IG / etc) | WhatsApp dispatch (existing send path) · AM email · in-app notification · push (Phase 2) · SMS (parking-lot)                          |
| Audience segment               | Boolean filter over `Group` × `Network` × `Region` × `RoleGrant` × vetted-state × activity (e.g. last-share-date)                     |
| Personalization variables      | `{firstName}` · `{region}` · `{personalShareLink}` (token-stamped per recipient — see D018) · `{lastActionDate}` · language variant   |
| Interactive buttons            | GPS verbs: **Share · Boost · Skip · I'm in · RSVP** — each triggers an attributed server action                                       |
| Broadcast (campaign object)    | NEW — `Broadcast` entity: name, audience filter snapshot, content template, channels, schedule, status                                |
| Per-recipient delivery state   | NEW — `BroadcastRecipient`: queued / sent / delivered / opened / acted / failed / unsubscribed                                        |
| Saved replies (templates)      | Shared `MessageTemplate` library, scoped per team                                                                                     |
| Analytics dashboard            | Per-broadcast view + aggregate per-team                                                                                               |

---

## Scope (sketch — to be fleshed out post-tech-review)

### Build (tentative)

- `prisma/schema.prisma` (additions only):
  - `Broadcast` entity — name, audience filter snapshot, content
    template, channels, schedule, status (`draft | scheduled |
    sending | sent | archived`), `approvedByUserId?`
  - `BroadcastRecipient` join — per-recipient state machine + acted-at
  - `MessageTemplate` (shared with future bu-coord-board "saved replies")
  - `UserChannelPreference` — opt-in state per channel
  - `UserUnsubscribe` — per-user opt-out, per-category
- `server/services/broadcast.ts` — audience-resolve, draft, schedule,
  fan-out, stop-on-action sweeper
- `server/services/audience.ts` — boolean filter compiler over
  Groups / Networks / Regions / Roles / activity
- `server/services/messaging-fanout.ts` — single channel-aware
  fan-out service shared with the in-app Notification primitive
  (per Q8 below)
- `server/routers/broadcast.ts`
- `app/(member)/broadcast/page.tsx` — list view (drafts /
  scheduled / sent)
- `app/(member)/broadcast/new/page.tsx` — the 4-step wizard
- `app/(member)/broadcast/[id]/page.tsx` — detail + analytics
- `components/broadcast/AudienceBuilder.tsx`
- `components/broadcast/MessageEditor.tsx` (variable-pill composer)
- `components/broadcast/SchedulePicker.tsx`
- `components/broadcast/AnalyticsPanel.tsx`
- ADR — single fan-out service (Notifications + Broadcast)
- ADR — `Broadcast` schema + approval-gate policy
- ADR — variable-pill template syntax + fallback semantics

### Do NOT touch (this BU)

- Existing dispatch internals (`server/services/dispatch/whatsapp/*`).
  Broadcast reuses the same send path; doesn't modify it.
- Coord-Board kanban / ticket detail / notifications pane (separate BU).
- `Request` schema — Broadcast replies create new Requests but the
  Request schema itself doesn't change here.

### Out of scope for this BU

- AI smart-reply / generative templates.
- A/B testing of message variants beyond simple Hebrew/English.
- Anonymous-recipient broadcasts (everything goes to known members).
- Broadcasts to non-members (no public-list mailshot).

---

## Open questions (block tech-review meeting)

1. **Authoring authority matrix.** Members → their own teams? Group
   admins → their group + adjacent? Sysadmins → anyone? Network
   admins → their network only?
2. **Approval gate threshold.** Above what audience size (or what
   cross-org reach) does a second approver kick in? Who's the
   approver — sysadmin pool, or any Group admin from the target
   audience?
3. **Channel selection: per-recipient preference vs sender choice.**
   If Sharon's prefs say "WhatsApp only" and a broadcast is sent on
   email, does she get nothing, or does sender override? Define the
   fallback chain (try WhatsApp → fall back to email → fall back to
   in-app).
4. **Personalization variable set.** Confirm `{firstName}`, `{region}`,
   `{personalShareLink}`, `{lastActionDate}`, language. Fallback
   strings for missing values? ("Hi friend" if no first name.)
5. **Multilingual broadcasts.** Hebrew + English variants of the same
   broadcast picked per-recipient by language attribute, or N
   broadcasts with shared audience?
6. **Interactive button → GPS-verb mapping.** WhatsApp quick-reply
   buttons map to: Share / Boost / Skip / I'm in / RSVP. Does each
   button trigger a server-attributed action (verified share / RSVP
   record), or just a templated reply that lands as a ticket for
   human triage?
7. **Stop-on-action semantics.** A drip sequence must stop when the
   recipient has done "the thing." Define "the thing" — generic
   `RequestAction` event (verified share, RSVP, comment), or
   per-broadcast custom condition?
8. **Triggered broadcasts vs Notification primitive.** Big overlap.
   Recommend single underlying fan-out service, two surfaces (in-app
   notifications are short-form; broadcasts are long-form campaigns).
9. **Anti-spam caps per recipient.** Max broadcasts per recipient
   per day across all senders. Per-channel? Per-category? Whose
   responsibility — platform / team / sender?
10. **Unsubscribe granularity.** Per-broadcast, per-category
    (operational vs campaign), or per-channel? Affects opt-in schema
    and member-facing settings.
11. **Broadcast replies → tickets.** Reply lands as a ticket in the
    originating team's coord-board, threaded against the Broadcast.
    Assignee defaults to broadcast author, on rotation, or unassigned?
12. **Analytics privacy.** Aggregate metrics (delivery / open /
    click) are safe. Per-recipient read receipts may feel
    surveillance-y. Pick a line; default to aggregate-only for
    non-sysadmins.
13. **Member-facing copy.** "Send to..." vs "Broadcast to..." —
    "Broadcast" reads as power-user/admin language. Recommend
    "Send to..." in member UI; keep "Broadcast" as the data/admin
    term. (Carries the CLAUDE.md "Send not Dispatch" rule forward.)

---

## Pending dependencies (block build)

- **Tech-feasibility review** — separate from coord-board's, since
  the schema is mostly orthogonal. Likely audience: Simon, Harry,
  Grant, Paul + a comms-side stakeholder (Jeremy or delegate).
- **Stakeholder evaluation** — comms-side review with Jeremy and at
  least one partner-org lead. They'll be the ones authoring
  broadcasts.
- **bu-coordination-board** core schema (Group / Network / Region /
  RoleGrant) needs to be in place — Broadcast reuses it. Not a
  hard dependency for the brief, but is for the build.

---

## Tests required (when build starts)

- Unit: audience-filter compiler returns expected member set across
  `Group × Network × Region × RoleGrant × vetted × activity` axes.
- Unit: variable substitution with fallbacks (missing firstName →
  configured fallback string).
- Unit: stop-on-action sweeper halts a drip sequence when the
  recipient has acted.
- Integration: broadcast send fans out across multiple channels
  respecting per-recipient preferences + opt-out state.
- Integration: replies inbound (WhatsApp / email) land as tickets in
  the originating team's coord-board, threaded against the Broadcast.
- Integration: analytics aggregation matches per-recipient state
  (delivered / opened / acted) without cross-broadcast leakage.
- E2E: author opens the 4-step wizard, builds an audience, composes,
  schedules, ships, sees analytics post-send.

---

## Definition of done (when build starts)

Standard per template, plus:

- [ ] ADR — single fan-out service shared with Notifications
- [ ] ADR — Broadcast schema + approval-gate policy
- [ ] ADR — variable-pill template syntax + fallbacks
- [ ] Reference-data migration seeds default channel preferences
- [ ] `npm run trackers` updated; `bu-sequence.md` reflects shipped
      status
- [ ] Member-facing copy uses "Send to..." not "Broadcast"
      (per Q13 + CLAUDE.md "Send not Dispatch" rule)

---

## Context

- Origin: lifted from `bu-coordination-board.md` v0.3, "Companion
  surface: Broadcast" section, on 2026-05-03 PM after the Q5 split
  decision (Leonid + Paul).
- See `bu-coordination-board.md` for the inbound-side primitives
  this Broadcast surface reuses (Group, Network, Region, RoleGrant).
- Sources reviewed: <https://sleekflow.io/broadcast> (4-step wizard
  tour, screenshot review only).
- D018 (inbound sharing endpoint) — `personalShareLink` variable
  uses the per-recipient token from this scheme.
- CLAUDE.md voice rules: "Send" not "Dispatch", "Share" not
  "Amplify".
