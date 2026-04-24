# Groups

**Purpose:** Define how groups exist within GPS Action — what they are,
what membership means, what consequences (and non-consequences) follow
from joining one.

**Status:** Architectural + product. Affects ERD Slice 1.5 (between
foundation and content primitives). Will become §3.34 of feature spec.

**Build Unit:** BU-007a (Groups foundation) — to be created.
**Related ADR:** D043 (Groups as identity markers + queue filters, not
permission).
**Related:** `admin-surface.md` (role model — groups don't grant roles),
`claim-and-lease.md` (queue filtering by group), `coordinator-profile`
in admin-surface.md (different concept entirely).

---

## What groups are (and are not)

GPS Action has _one feed everyone sees_. This is a foundational principle
(per D041). But within that single shared space, members have **affinities**
— writers identify with writers, parents with parents, Manchester locals
with Manchester locals. Groups give those affinities a place to live in
the data model without fragmenting the feed.

### Groups ARE:

- **Identity markers** that members can join and display on their profile
- **Queue filters** that queue managers can use to surface work items
  related to a particular group's interests
- **A way to create soft cohorts** within the wider community without
  walling them off
- **First-class entities** with a name, optional description, optional logo

### Groups are NOT:

- **Not permission gates.** Joining a group doesn't grant or restrict
  what you can see or do
- **Not visibility filters for the feed.** You see everything regardless
  of which groups you're in
- **Not the same as queue_manager role.** You can be in the Vetting
  Group without being a queue manager (you just identify with it)
- **Not the same as coordinator_profile.** Coordinator profile is about
  groups you run _outside_ GPS Action; groups (this doc) are inside GPS
  Action
- **Not native chat channels.** No private threads, no group-only feed,
  no DMs. The feed remains unified
- **Not WhatsApp dispatch routes.** Routes (the WhatsApp groups GPS
  Action members dispatch _to_) are a separate model

### Why this is the right level of "groupness"

Stronger groups (their own feeds, their own permissions, members-only
content) would fragment GPS Action into Slack-style siloes. We've
deliberately rejected that direction (per D041 — solidarity, single
shared feed).

Weaker groups (just labels with nothing attached) would be virtue
signalling — meaningless badges with no operational value.

The middle ground — identity + soft queue filtering — gives groups
purpose without compromising the unified-feed principle.

---

## Examples of groups

To make this concrete, here are groups that might exist:

| Group name          | Type                     | Why it exists                                                                                          |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Writers             | Skill-based              | Members who write op-eds, articles, letters to the editor                                              |
| Newsletter Editors  | Skill-based              | Members who run external newsletters; coordination of campaign asks                                    |
| Vetting Team        | Operational              | Members who actively work the vetting queue (overlaps with queue_manager role but is its own affinity) |
| BDS Response Team   | Topic-focused            | Members focused on BDS-related content and responses                                                   |
| Talk Radio Group    | Skill-based              | Members willing to phone into talk radio shows; need quick alerts                                      |
| Northwood Mums      | Geographic + demographic | Members from the Northwood area who are mums (informal cohort)                                         |
| Manchester          | Geographic               | Members in/near Manchester                                                                             |
| Education Campaigns | Topic-focused            | Members focused on schools, universities, antisemitism in education                                    |

Some are skill-based, some topic-based, some demographic, some geographic.
The model accommodates all of them — they're all just `Group` records
with different names.

### Examples that should NOT be groups

- "Jewish members" — too broad; the whole community is broadly Jewish
- "Active members" — not a group, that's an analytics segment
- "Sharon's friends" — too narrow; that's a personal connection, not a
  cohort
- "Anyone who's posted recently" — that's a query, not a group
- "Premium tier" — there are no tiers; one membership level

The guideline: a group is a **named affinity** that members can recognise
and identify with. If it's not something a member would say "yes I'm
in that," it's not a group.

---

## Per-group join policy

Per the design conversation: **per-group flag, default open**.

```prisma
enum GroupJoinPolicy {
  open                   // any member can self-join
  request_to_join        // member requests, admin approves
  admin_only             // only admins can add members
}
```

### `open` (default)

Most groups. A member sees the group, taps "Join", and they're in. No
approval. No friction.

Used for:

- Skill-based groups (Writers, Talk Radio Group)
- Topic-focused groups (BDS Response Team)
- Geographic groups (Manchester)

### `request_to_join`

Member taps "Join", which creates a join request. Admins (or group leads,
if implemented later) review and approve/decline. Member sees "Your
request is pending."

Used for:

- Sensitive skill groups (Vetting Team — you want some quality control)
- Trusted-circle groups (admin-led campaigns where you want to know
  the cohort)

For MVP, "request" creates a `work_item` of type `group_join_request`
in the queue. Admins resolve it. If resolved as approved, the membership
is created.

### `admin_only`

The group's membership is fully curated by admins. Members cannot
self-join or request. Admins add members directly.

Used for:

- Operational groups with strict rosters (e.g. "Beta Testers" if we
  needed one)
- Groups where membership is a recognition (e.g. "Founding Members" if
  we wanted such a group as a permanent badge)

---

## What members see when they're in a group

### On their profile

- Small group badges/chips listed under their name
- e.g. "Sharon Cohen — _Writers, BDS Response Team, Northwood Mums_"
- Each badge shows the group's logo (if set) or a default icon
- Tap a badge to see the group's page

### On their post bylines (subtle)

- Optionally, the most recent or most relevant group badge appears next
  to their name on posts
- Single badge max, kept small, doesn't dominate the byline
- A member can choose which group (if any) to feature on bylines, in
  their settings

### On the group's page (a member or admin can view)

- Group name, description, logo
- List of members (if member privacy permits — see below)
- Recent posts where any member tagged this group as relevant
- A "leave group" button for the viewing member (if they're in)

### Member privacy of group memberships

By default, a member's group memberships are **visible to other members**
(badges on profile, byline). Three reasons this is the default:

1. The whole point of joining is to declare an affinity
2. Cross-group connection benefits from visibility
3. Coordinators can see "Sarah's a writer; she might want this work item"

Members can opt to **hide** their group memberships in their profile
settings. Hidden memberships still affect queue filtering (their
membership exists; it's just not displayed). This matters for sensitive
groups where membership might be private (e.g., "Survivors Support" — if
GPS Action ever hosts such a thing).

For MVP: assume all group memberships are visible by default; the
"hide my groups" setting is parking-lot.

---

## Group-related fields on work items

Work items can carry a tag identifying which group(s) they relate to.
This is what enables queue managers to filter their queue by group
interest.

### Where the tag comes from

Two sources, no automated content inference:

1. **Author-tagged at post time.** When Sharon posts something about a
   councillor's antisemitic remarks, she can optionally tag it
   "Education Campaigns" or "Newsletter Editors" in the composer (a
   small dropdown). This metadata flows through to the work item if one
   is created (e.g., a flag against this post).

2. **Manually tagged at queue-management time.** When a queue manager
   picks up an item, they can add or remove group tags from it. Useful
   for items the author didn't tag, or where the right group becomes
   clearer once a manager looks at the content.

### Schema addition to WorkItem

The existing `WorkItem` (per claim-and-lease.md) gains:

```prisma
model WorkItem {
  // ... existing fields ...

  groupTags    String[]  @default([])  // array of Group slugs; informational + filterable

  // ... existing fields ...

  @@index([groupTags])  // GIN index for array search
}
```

`groupTags` is an array of group slugs because a single work item might
relate to multiple groups (e.g., a flag about a school incident might
relate to both "Education Campaigns" and a regional group). Postgres
arrays + GIN index make this fast to query.

### Queue filtering by group

In the queue UI, queue managers see a filter dropdown:

```
Filter by group: [All groups ▾]
                  ◯ All groups
                  ◯ My groups (Writers, BDS Response Team)
                  ◯ Writers
                  ◯ Newsletter Editors
                  ◯ Vetting Team
                  ...
```

"My groups" is the natural default for queue managers who are also in
groups — they see items relating to communities they identify with.

Filtering is **preference, not exclusion**. Other queue managers see
all items regardless of group filter. The filter is just "show me what's
relevant to me first" — not "this work item is only for Writers Group
members."

### The queue manager + group overlap

A common pattern: a member is both a queue manager AND in some groups.
They use the queue's group filter to focus on their groups' items. They
can still see and pick up unfiltered items.

This is the core operational value of groups — soft routing of work
items to the people most likely to care about them, without rigid
assignment.

---

## Group leads (a soft hierarchy, optional)

Some groups benefit from having a "lead" or "coordinator" — a member
who's the informal point of contact for the group. They might:

- Help admins decide who to admit (in `request_to_join` groups)
- Coordinate group activities
- Curate the group's identity

For MVP, this is a **soft role with no special permissions**. The data
model supports it but the UI just displays it ("Sarah is the lead of
Writers"); it doesn't grant any technical privileges.

```prisma
enum GroupMembershipRole {
  member        // default
  lead          // soft hierarchy, no special tech permissions
}
```

Group leads can be added to existing groups by admins. Multiple leads
per group is allowed (writers might have two leads).

If the lead role becomes operationally meaningful later (e.g., leads
can approve `request_to_join` requests for their group without admin
involvement), the schema is ready. For MVP, it's just a label.

---

## Schema for ERD Slice 1.5

### `Group` table

```prisma
model Group {
  id            String           @id @default(uuid())
  slug          String           @unique  // url-safe; "writers", "northwood-mums"
  displayName   String           // "Writers"
  description   String?          // "Members who write op-eds, articles, letters"
  logoUrl       String?          // uploaded image; defaults to type-appropriate icon

  joinPolicy    GroupJoinPolicy  @default(open)

  // Officially blessed groups have an admin badge
  isOfficial    Boolean          @default(false)

  // Soft delete
  deletedAt     DateTime?

  createdAt     DateTime         @default(now())
  createdByUserId String
  createdBy     User             @relation("groupsCreated", fields: [createdByUserId], references: [id], onDelete: Restrict)

  updatedAt     DateTime         @updatedAt

  memberships   GroupMembership[]

  @@index([slug])
  @@index([deletedAt, isOfficial])
}

enum GroupJoinPolicy {
  open
  request_to_join
  admin_only
}
```

### `GroupMembership` table

```prisma
model GroupMembership {
  id              String              @id @default(uuid())

  userId          String
  user            User                @relation("groupMemberships", fields: [userId], references: [id], onDelete: Cascade)

  groupId         String
  group           Group               @relation(fields: [groupId], references: [id], onDelete: Cascade)

  role            GroupMembershipRole @default(member)

  joinedAt        DateTime            @default(now())
  joinedVia       JoinSource          @default(self_join)

  // Soft delete (left the group)
  leftAt          DateTime?
  leftReason      String?             // optional, member-supplied

  // Tracking for request_to_join groups
  approvedByUserId String?
  approvedBy      User?               @relation("groupApprovals", fields: [approvedByUserId], references: [id], onDelete: SetNull)
  approvedAt      DateTime?

  @@unique([userId, groupId])  // one active membership per (user, group)
  @@index([userId])
  @@index([groupId, leftAt])
}

enum GroupMembershipRole {
  member
  lead
}

enum JoinSource {
  self_join
  request_approved
  admin_added
  admin_invited
}
```

### `User` additions

```prisma
model User {
  // ... existing fields ...

  groupMemberships  GroupMembership[]   @relation("groupMemberships")
  groupsCreated     Group[]             @relation("groupsCreated")
  groupApprovals    GroupMembership[]   @relation("groupApprovals")

  // ... existing fields ...
}
```

### `WorkItem` additions

```prisma
model WorkItem {
  // ... existing fields per claim-and-lease.md ...

  groupTags         String[]            @default([])   // group slugs

  // ... existing fields ...

  @@index([groupTags], type: Gin)
}
```

### `Post` additions (Slice 2)

```prisma
model Post {
  // ... existing fields ...

  groupTags         String[]            @default([])   // group slugs author tagged

  // ... existing fields ...

  @@index([groupTags], type: Gin)
}
```

---

## tRPC procedures

The group-related router exposes:

| Procedure            | Purpose                                        | Auth                                        |
| -------------------- | ---------------------------------------------- | ------------------------------------------- |
| `group.list`         | List all groups (filterable)                   | member                                      |
| `group.get`          | Get one group by slug                          | member                                      |
| `group.getMembers`   | List members of a group                        | member (subject to member-privacy settings) |
| `group.create`       | Create a new group                             | admin                                       |
| `group.update`       | Update group fields                            | admin                                       |
| `group.archive`      | Soft-delete a group                            | admin                                       |
| `group.join`         | Self-join an open group                        | member                                      |
| `group.requestJoin`  | Request to join a request_to_join group        | member                                      |
| `group.leave`        | Leave a group                                  | member (must be member)                     |
| `group.addMember`    | Add a member (admin or admin_only group)       | admin                                       |
| `group.removeMember` | Remove a member                                | admin                                       |
| `group.setRole`      | Set member's role within group (member ↔ lead) | admin                                       |

All procedures follow api-contract-discipline.md. Audit log entries for:

- group_created, group_updated, group_archived
- group_member_added, group_member_left, group_member_removed
- group_join_request_created, group_join_request_resolved
- group_member_role_changed

---

## Member-facing UI

### Discovery — "find groups"

Members can browse all groups via `/groups` page:

- List of all (non-deleted) groups
- Each shows: logo, name, description, member count
- "Joined" indicator if the member is in
- "Join" / "Request to join" button if not, depending on policy
- Search by name; filter by official vs informal

### Group page — `/groups/{slug}`

Each group has its own page:

- Logo, name, description
- Member count and (if visible) member list
- Recent posts tagged with this group
- Recent work-items tagged with this group (only visible to queue
  managers and admins)
- Join/leave button as appropriate
- Group leads listed separately

### In the composer — group tagging

When composing a post, an optional dropdown:

```
Relevant to: [Choose group(s) ▾]
              ☐ Writers
              ☐ BDS Response Team
              ☐ Education Campaigns
              ☐ ...
```

Multi-select. Default empty. Shows up under post type and visibility,
small and unobtrusive.

The group filter on work items uses these tags to surface the work item
to the right queue managers.

### In the queue — group filter

```
Filter: [Type ▾] [Group ▾] [Priority ▾]
                  ↳ ◯ All groups
                    ◯ My groups
                    ◯ Writers
                    ◯ Newsletter Editors
                    ◯ ...
```

Filter is sticky (remembered per queue manager) so they don't have to
re-set each session.

---

## Admin-facing UI

### Group management — `/admin/groups`

Standard admin-surface entity page:

- List of all groups
- Create new group
- Edit / archive / restore
- View each group's full membership list
- Add or remove members (manual)
- Set group leads
- Approve pending join requests

### Group analytics (Phase 1.5+)

Per group, show:

- Member count over time
- Posts tagged with this group, last 30 days
- Work items tagged with this group, last 30 days
- Active vs dormant members (last activity)

Phase 1.5 because it requires aggregation infrastructure. MVP just shows
the lists.

---

## Migration / bootstrap

### Initial groups at MVP launch

Seed data (via the F10 seed script) creates a small set of starter
groups:

- Writers
- Newsletter Editors
- Talk Radio Group
- Vetting Team
- Education Campaigns
- BDS Response Team

Plus 3-5 geographic ones for the pilot's anchor regions:

- Manchester
- North London
- South London
- ...

Admins can create more later. These six are bootstrap; they ground the
model with realistic examples on day one.

### Member onboarding includes optional group join

After signup + vetting approval, the onboarding flow includes:

> _"Are there any groups you'd like to join? It helps your fellow
> members route relevant content your way."_
>
> [list of open groups with brief descriptions]
> [Skip — I'll browse later]

Optional, skippable, no pressure. Members can browse groups anytime.

---

## What this doc does NOT cover

(The pattern — naming gaps explicitly.)

1. **Group-private content.** No "post visible only to Writers Group" —
   that breaks the unified-feed principle (D041). If members want
   group-only conversations, they use external channels (WhatsApp, etc.).
   This may be revisited in Phase 2 if real demand emerges, but for now,
   no.
2. **Group-specific feeds.** Same reasoning. The feed is unified.
3. **Group-to-group messaging.** No groups DM-ing each other. Coordination
   between groups happens in the unified feed.
4. **Group-level analytics for non-admins.** Members in a group can see
   members, posts, work items — but not aggregate stats. Admin-only.
5. **Multi-tenancy.** No "this group has its own admin team". All admin
   functions are global. If a group needs autonomy, it's probably a
   different organisation.
6. **Group-based access control.** Joining a group never grants
   permissions. Permissions are per-role (member, queue_manager, admin).
7. **Algorithmic group suggestions.** "We think you'd like Northwood
   Mums" — Phase 2; needs user activity data and recommendation infra.
8. **Group-level notifications preferences.** "Notify me when something
   relevant to Writers happens" — Phase 2; needs notification system to
   be built first.
9. **Bulk group operations.** "Move all Vetting Team members to Vetting
   Team v2" — admin can do member-by-member; bulk later if needed.
10. **Group naming conflicts and renames.** Slugs are unique; renames
    update displayName but slug stays. URL stability matters more than
    rename flexibility.

---

## What lands in MVP

**MVP day 1:**

- Group entity + GroupMembership entity
- Per-group join policy (open default)
- Member browse + join flow
- Group badges on profiles
- Author group-tagging in composer
- Queue manager group filter
- Admin CRUD for groups via admin surface
- Seed data with ~10 starter groups

**Phase 1.5 (a few weeks in):**

- Group leads role (soft)
- Request-to-join workflow (work_item type)
- Member-side group analytics
- Onboarding optional group join

**Phase 2:**

- Hide-my-groups privacy setting
- Algorithmic group suggestions
- Group notification preferences
- Group-level analytics for members
- Bulk group operations

**Never (or only on strong signal):**

- Group-private feeds
- Group permissions / access control
- Native group chat
- Group-to-group messaging
