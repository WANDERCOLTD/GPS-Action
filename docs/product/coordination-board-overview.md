# Coordination Board — overview for non-technical readers

_Date: 2026-05-03 · Audience: working-group leads, partner-org reps, anyone evaluating GPS without a developer in the room_

This is the plain-language companion to the build brief at
`docs/build/session-briefs/bu-coordination-board.md`. It captures
what we're proposing to build, why, and which decisions are still open.

---

## What we're proposing

A shared workspace inside GPS where each team — Writers, Radio, Social
Media, IT, Face-to-face, and so on — sees a colourful board of the
work they're doing. Cards move across the board as work progresses.
Admins see every team's board; members see only the boards they belong
to. The same job can be sent to more than one team at once (for
example, a campaign that needs both Writing and Social Media).

Today, all of this happens in WhatsApp threads. People volunteer
verbally, status lives in someone's head, and handover between teams
is invisible. The board makes the work and its progress visible
without changing how members like to communicate (WhatsApp, email,
in-app — their choice per team).

---

## What it looks like

**On a laptop or tablet**, each team's board is a row of columns —
for example: Recruitment → Preparation → Implementation → Monitoring.
Each card is one job. Cards move left to right as work progresses.
Admins can drag cards to reorder them by priority.

**On a phone**, columns are too cramped. Instead, jobs appear as a
single scrolling list, and the column name becomes a coloured tag
on each card.

**Two extra views** sit alongside the active board:

- **Backlog** — jobs that have been proposed but aren't yet on the
  active board. Admins prioritise here, then move the chosen jobs
  onto the board.
- **Done** — completed jobs, archived as a list for reference and
  reporting.

Both Backlog and Done can be displayed as cards or as a plain list.

---

## Who uses it, and what they can do

| Role | What they can do |
|---|---|
| **Member of a team** | See the team's board, claim cards, move cards they own through the columns, comment, subscribe to specific jobs |
| **Team admin** | Everything above, plus: approve people who want to join the team, promote a member to team admin, configure the team's columns, drag cards to reorder priority, accept jobs sent to the team from elsewhere |
| **System admin** | Everything above, across every team. Plus: create new teams, archive teams that are no longer active, intervene if a team admin is unavailable |

Joining a team needs admin approval (with one exception — see
"Networks" below). The Tech team specifically remains
invitation-only to prevent overload.

---

## How a job moves through the board

1. **Backlog.** Anyone authorised can propose a job. It lands in the
   relevant team's backlog. Sits there until an admin prioritises it.
2. **Recruitment.** Admin moves it onto the active board. Job is
   visible but not yet claimed. Anyone in the team can pick it up.
3. **Preparation → Implementation → Monitoring.** Whoever claimed it
   moves the card across as work progresses. The exact column names
   are configurable per team — Writers might use "Draft → Edit →
   Publish → Distribute" instead. The four-column shape is the
   default; teams can rename, add, or remove columns to suit how they
   actually work.
4. **Done.** When the work is complete, the card moves to Done and
   leaves the active board. Available in the Done archive for
   reference.

A job can be sent to more than one team. Each team tracks its own
progress on the same job — Writers might be in Implementation while
Social Media is still in Preparation. Both teams can see each other's
state by default; we can hide one team from another for sensitive
work if needed.

---

## Networks (CUFI and partner organisations)

Networks like CUFI work the same way as internal teams underneath the
hood, but they show up in a separate area of the picker. Two practical
differences:

- A user saying "I'm affiliated with CUFI" might not need network-admin
  approval the way joining Writers does — networks can be set up to
  let members self-attest. (To be confirmed per network.)
- A network may have many more members than an internal team. The
  data model supports both equally well.

A job can be directed at one or more networks alongside one or more
teams — for example, an action sent to Writers, Social Media, and
CUFI simultaneously, with each tracking their own progress.

---

## How members stay informed

Every member chooses two things in their settings:

**How much to be notified about:**
- Everything on my boards
- Only jobs I've subscribed to
- Only when I'm @mentioned
- Nothing

**Where to be notified:**
- Inside GPS
- WhatsApp
- Email
- (Any combination)

These can be set globally and overridden per team — e.g. "everything
for Writers, mentions only for IT."

A member can open any job and tap **Subscribe** to follow it
specifically, or **Unsubscribe** to stop hearing about a job they're
auto-following (because they authored it, claimed it, or were
mentioned in it).

---

## Drilling between teams

Members who belong to several teams switch between boards through a
**team picker**. The picker shows only teams they have access to —
no leakage of teams they don't belong to. They can switch between
boards as often as they like.

Within a board, a member can also choose to see only their subscribed
jobs, hiding everything else.

---

## What this is NOT (yet)

- It is not real-time collaborative editing of cards.
- It is not a time-tracker or SLA tool.
- It does not replace WhatsApp for ad-hoc chat — it sits alongside.
- It does not surface jobs across teams the member doesn't belong to.
- It does not yet support recurring jobs or templates.
- It does not yet have a public read-only view for transparency
  partners.

These can come later if useful. Saying "no" now keeps the first
version evaluable.

---

## Open questions for stakeholders

Before we lock the build, we'd value views on:

1. **Default column names.** Recruitment / Preparation / Implementation
   / Monitoring is the proposed system default. Teams can override.
   Are these the right defaults?
2. **Card front face.** What's the most useful information on top of
   each card at a glance? Job title is obvious. Beyond that — claimer
   name, priority chip, last-updated time, subscriber count, a short
   excerpt? Pick three.
3. **Sending a job to a team you don't run.** Can any member direct
   a job at any team, or does the team admin need to accept it before
   it appears on their board?
4. **Network membership.** For each network we onboard, who decides
   whether membership is self-attestation or admin-approval? Per
   network, or one rule for all?
5. **Cross-team visibility on shared jobs.** When a job is sent to
   two teams, default is full transparency (each team sees the
   other's progress). Are there cases where teams should be hidden
   from each other on the same job?
6. **Notification defaults for new members.** When someone joins a
   team, what notification level should they default to? "All" risks
   overwhelm; "subscribed only" risks invisibility. "Mentions" is
   probably the safe middle.

---

## What happens next

1. Technical review meeting: Simon, Harry, Grant, Paul. Leonid is
   booking. Output: confirmation that the build is feasible as
   described.
2. UI prototype: a clickable mock of the friendly version, in our
   colours, on a real device. Output: something non-technical
   stakeholders can react to.
3. Non-technical review: writers, radio, partner-org reps walk
   through the prototype. Output: changes to the brief.
4. Build, in the order the brief lists.

This document will be updated as those steps complete.

---

## Where to find more

- **Build brief** (technical): `docs/build/session-briefs/bu-coordination-board.md`
- **How GPS uses the word "Group"**: `docs/product/groups.md`
- **Existing data model**: `prisma/schema.prisma` (the team, member,
  and job entities are already mostly in place)
