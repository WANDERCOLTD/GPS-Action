# Claim and lease — multi-user work coordination

**Purpose:** Multiple queue managers work the queues from day one. Without
explicit claim semantics, two queue managers can grab the same item and
create duplicate work, conflicting decisions, and audit confusion. This
document defines the unified work-items model, the claim/lease mechanics,
and the schema implications for ERD.

**Status:** Architectural. ERD must include the `work_items` table per spec
below.
**Related ADR:** D040 (work_items as unified queue primitive), D041 (region
as tag only, no queue-side filtering), D042 (coordinator identity vs
queue-manager permission split).
**Build Unit:** BU-001 (admin scaffolding) builds the queue UI; the
work-items table is a foundational schema concern.
**Related:** admin-surface.md, security-baseline.md, B07 (audit log spec).

---

## The model — one queue, type-driven

All work that requires human judgement and could be picked up by any of
several queue managers flows through a single `work_items` table. Each row
represents one unit of work. Type-driven UI renders the right form for each
type.

**Why one table:**
- One claim mechanism, not six
- One audit pattern
- One notification system
- One queue UI ("what needs me?") — the only place queue managers look
- Cross-type queries become trivial ("Sharon's open work this week")

**Eight work item types (MVP):**

| Type | What needs human judgement |
|---|---|
| `vetting` | New member application requires identity + suitability check |
| `flag` | A member has flagged a post for moderation |
| `outcome_review` | A posted outcome requires verification before "Verified" tag |
| `dedup_merge` | Edge case where dedup detection wasn't confident |
| `edit_request` | Member has asked for their post to be edited (e.g. fix a typo after publish) |
| `incident` | Anything escalated from elsewhere — security, safety, urgent ops |
| `content_submission` | Member submitted a graphic / fact sheet / toolkit for the content library (per SRS §8) |
| `link_submission` | Member submitted a link for the Useful Links repository (parking lot, future) |

The types list extends as features mature. Adding a new type:
1. Add to the `WorkItemType` enum
2. Define its context shape (TypeScript type + Zod schema)
3. Register its form component in the type-driven renderer
4. Done. Claim mechanic, audit, notifications, queue UI all work for free.

---

## The five design decisions (locked)

### Q1 — What needs claiming
The eight work-item types above. Posts, comments, reactions, feed items do
**not** need claiming — they're not single-worker workflows.

### Q2 — How claims are surfaced
**Tab split.** The queue page has two tabs:
- **Available** — `WHERE status = 'unclaimed'`
- **In Progress** — `WHERE status IN ('claimed', 'in_review')`

Claimant's avatar shows next to each in-progress item. Tap to see name and
claim age.

### Q3 — Claims are exclusive
Once claimed, only the claimant can perform resolution actions on that work
item. The API rejects resolution attempts from other users with
`TRPCError({ code: "FORBIDDEN", message: "Claimed by Sharon" })`.

Other queue managers can still **view** the work item and its underlying
content. The lock is on the *resolve action*, not on visibility.

### Q4 — Three tiers of release
1. **Self-release.** The claimant can release their own claim at any time,
   one click. "Done" or "won't action" are both legitimate.
2. **Admin force-release.** Users with `admin` role can release anyone's
   claim. Requires a reason. Audit-logged. Claimant gets a notification.
3. **System auto-release.** TTL expiry (no heartbeat) and max-duration cap
   trigger automatic release. No notification (silent).

### Q5 — Scope of the lock
The claim locks the **work item**, not the underlying entity. If Paul has
claimed flag #42 (which is about post #99), Sharon can still:
- View post #99
- Comment on post #99
- React on post #99
- Even flag post #99 again (creating flag #43, which is its own work item)

What Sharon cannot do is resolve flag #42. That's Paul's, while it's claimed.

---

## No region scope in MVP (per D041)

**Every queue manager sees every work item.** There is no region-based
filtering of the queue.

Reasons:
- Pilot cohort is small — a shared workload with many eyes is robust
- Workload self-balances without admin intervention
- Coverage gaps don't exist because everyone covers everything
- Simpler queue UX — no "switch region" mental overhead

Region still appears as **informational** on work items — a vetting case
tagged "Manchester" shows that tag in the list — but it does not filter what
any queue manager can see.

**Implication:** `WorkItem.regionSlug` is populated (inherited from the
underlying entity or post) but is not used for access control. It's a
display field only.

**Revisit trigger:** if pilot reveals that queue managers want region-
focused queues ("I'm better at vetting Londoners"), re-evaluate. Likely
driver: queue volume grows past the point where everyone seeing everything
becomes noisy.

---

## Lease mechanics

### TTL — default 30 minutes

When a claim is made, `claim_expires_at = now() + 30 minutes`. If the lease
isn't renewed before expiry, the work item auto-releases on the next queue
read or scheduled sweep.

30 minutes is a balance:
- Long enough for genuine work (read context, make a decision, action it)
- Short enough that a forgotten claim doesn't block the queue all day

Configurable per work-item type. Vetting cases (which need careful identity
review) might use 60 minutes; quick flag triage might use 15.

### Heartbeat — every 60 seconds while page is open

While a queue manager has the work-item detail page open, the client sends a
heartbeat every 60 seconds:

```
trpc.workItem.heartbeat.mutate({ workItemId })
→ Server: extends claim_expires_at to now() + 30 minutes (the configured TTL)
```

Heartbeat is idempotent — only the claimant's heartbeat extends the lease.

If the queue manager closes the tab or loses connection, heartbeats stop,
lease expires within 30 minutes, item returns to queue.

### Maximum claim duration — 4 hours hard cap

Even with continuous heartbeats, a claim is force-released after 4 hours.
This catches the "left it open on another monitor" failure mode.

When max-duration force-release happens:
- Work item returns to `unclaimed`
- Claimant gets a notification: "Your claim on X was released after 4 hours.
  If you're still working on it, claim it again."
- Audit entry: `claim_max_duration_expired`

### Sweeper — runs every 5 minutes

A scheduled job runs every 5 minutes:

```sql
UPDATE work_items
SET status = 'unclaimed',
    claimed_by_user_id = NULL,
    claimed_at = NULL,
    claim_expires_at = NULL,
    last_heartbeat_at = NULL
WHERE status = 'claimed'
  AND (
    claim_expires_at < NOW()
    OR claimed_at < NOW() - INTERVAL '4 hours'
  );
```

Audit entries written for each release. Notifications sent for max-duration
releases (TTL releases are silent).

### Role revocation also releases claims

Per admin-surface.md, when an admin revokes a user's `queue_manager` role,
all of that user's currently-claimed work items are auto-released
immediately. This is a forced release with a different audit reason:
`claim_released_on_role_revoke`.

---

## The race condition — atomic claim

Two queue managers tap "Claim" on the same item within the same second.
Naive implementation: both reads see `status = 'unclaimed'`; both writes
succeed; both think they have it.

**Solution: atomic conditional update.**

```sql
UPDATE work_items
SET status = 'claimed',
    claimed_by_user_id = $userId,
    claimed_at = NOW(),
    claim_expires_at = NOW() + INTERVAL '30 minutes',
    last_heartbeat_at = NOW()
WHERE id = $workItemId
  AND status = 'unclaimed'
RETURNING *;
```

The `WHERE status = 'unclaimed'` makes the update conditional. Only one of
the two simultaneous attempts will affect a row. The other gets zero rows
back and the API responds:

```
TRPCError({
  code: "CONFLICT",
  message: "Already claimed by Sharon"
})
```

The second queue manager's UI handles the error gracefully: "Sharon got
there first. Here's the next available item."

This is solved entirely at the database level. No application-level locking
needed.

---

## The claim avatar — UI-in-scope

A small, well-defined feature on every claimed work item:

**On the queue list (In Progress tab):**
- Each row shows the claimant's avatar (24px circle) at the right edge
- Tap/hover reveals: claimant name + claim age ("Sharon, claimed 12 minutes
  ago")
- Visual cue if claim is about to expire (avatar gets a subtle ring at the
  20-min mark)

**On the work-item detail page:**
- Header shows the claimant's avatar + name + claim age + "Release" button
  (visible to claimant only)
- For admins viewing a claim they don't own: avatar + name + "Force release
  (admin)" button

**Copy** (per design philosophy):
- "Claimed by Sharon, 12 minutes ago" — honest, plain
- "Released by Paul" — past-tense, factual
- "Released automatically (no activity for 30 minutes)" — explains the why

This is sufficient social-awareness for MVP. Full presence indicators
(stacked avatars showing who's *currently viewing*) are deferred — see
parking lot.

---

## Schema for ERD

### `work_items` table

```prisma
enum WorkItemType {
  vetting
  flag
  outcome_review
  dedup_merge
  edit_request
  incident
  content_submission
  link_submission
}

enum WorkItemStatus {
  unclaimed
  claimed
  in_review        // claimed AND active heartbeat received in last 5 min
  resolved
  abandoned        // claim expired AND nobody picked it up after 7 days
}

enum WorkItemPriority {
  low
  normal
  high
  urgent
}

enum WorkItemResolution {
  approved
  rejected
  edited
  escalated
  dismissed
  duplicate
  other
}

model WorkItem {
  id                  String              @id @default(uuid())
  type                WorkItemType
  status              WorkItemStatus      @default(unclaimed)
  priority            WorkItemPriority    @default(normal)
  
  // Type-specific payload — references to underlying entities + summary
  context             Json
  
  // Region tag (informational only in MVP — not used for access control per D041)
  regionSlug          String?
  
  // Lifecycle
  createdAt           DateTime            @default(now())
  createdByUserId     String?             // nullable — some work items system-generated
  createdBy           User?               @relation("workItemsCreated", fields: [createdByUserId], references: [id], onDelete: SetNull)
  
  // Claim fields (all nullable until claim happens)
  claimedByUserId     String?
  claimedBy           User?               @relation("workItemsClaimed", fields: [claimedByUserId], references: [id], onDelete: SetNull)
  claimedAt           DateTime?
  claimExpiresAt      DateTime?
  lastHeartbeatAt     DateTime?
  
  // Resolution fields (populated on resolution)
  resolvedAt          DateTime?
  resolvedByUserId    String?
  resolvedBy          User?               @relation("workItemsResolved", fields: [resolvedByUserId], references: [id], onDelete: SetNull)
  resolution          WorkItemResolution?
  resolutionNotes     String?
  
  // Soft delete (per admin-surface convention)
  deletedAt           DateTime?
  
  updatedAt           DateTime            @updatedAt
  
  @@index([status, priority, createdAt])
  @@index([claimedByUserId, status])
  @@index([type, status])
  @@index([regionSlug, status])  // still indexed for informational queries
}
```

### `User` table additions

```prisma
model User {
  // ... existing fields ...
  
  workItemsCreated    WorkItem[]   @relation("workItemsCreated")
  workItemsClaimed    WorkItem[]   @relation("workItemsClaimed")
  workItemsResolved   WorkItem[]   @relation("workItemsResolved")
  
  // Role grants (per admin-surface.md — separate model)
  roleGrants          RoleGrant[]  @relation("roleGrants")
  
  // Coordinator profile (per admin-surface.md — optional, separate model)
  coordinatorProfile  CoordinatorProfile? @relation("coordinatorProfile")
  
  // ... existing fields ...
}
```

### `context` JSONB shape per type

The `context` payload references the underlying entity and includes a
`summary` field for the queue list display. Example shapes:

```typescript
// type = "flag"
{
  flagId: "flag-123",
  postId: "post-456",
  flaggerId: "user-789",
  reasonCategory: "harassment",
  reasonText: "...",
  summary: "Flag on Sharon's post about BDS"
}

// type = "vetting"
{
  applicationId: "app-101",
  applicantId: "user-202",
  vouchedByIds: ["user-303", "user-404"],
  summary: "Vetting: Abby Cohen (vouched by Sharon, Grant)"
}

// type = "content_submission"
{
  submissionId: "sub-505",
  submitterId: "user-606",
  assetType: "graphic",
  assetUrl: "...",
  summary: "Content submission: Yom HaShoah graphic"
}
```

The `summary` field is what the queue list shows. Keeps the UI generic; the
data layer carries the human-readable label.

---

## tRPC procedures

The work-item router exposes these procedures:

| Procedure | Purpose | Auth |
|---|---|---|
| `workItem.list` | List work items with filters (status, type, claimed-by-me) | queue_manager |
| `workItem.get` | Get one work item by ID | queue_manager |
| `workItem.claim` | Claim an unclaimed work item | queue_manager |
| `workItem.heartbeat` | Extend the lease while page is open | queue_manager (must be claimant) |
| `workItem.release` | Release own claim | queue_manager (must be claimant) |
| `workItem.forceRelease` | Force-release someone else's claim | admin |
| `workItem.resolve` | Resolve the work item (per type-specific resolution flow) | queue_manager (must be claimant) |
| `workItem.escalate` | Escalate to admin (creates a follow-on work item) | queue_manager (must be claimant) |

All procedures follow api-contract-discipline.md rules. All actions emit
audit-log entries. All resolutions emit analytics events.

---

## Audit events

Every claim lifecycle transition writes an audit-log entry:

| Action | When |
|---|---|
| `claim_created` | Successful claim |
| `claim_renewed` | Heartbeat received (logged at low frequency — once per claim, not per heartbeat) |
| `claim_self_released` | Claimant released own claim |
| `claim_force_released` | Admin force-released, with reason |
| `claim_ttl_expired` | Auto-released by sweeper (TTL) |
| `claim_max_duration_expired` | Auto-released by sweeper (4-hour cap) |
| `claim_released_on_role_revoke` | Auto-released because claimant's role was revoked |
| `work_item_resolved` | Final resolution (approved/rejected/etc.) |
| `work_item_escalated` | Escalated, follow-on work item created |

---

## Analytics events

For pilot visibility:

| Event | Properties |
|---|---|
| `work_item_claimed` | `type`, `priority`, `time_in_queue_seconds` |
| `work_item_resolved` | `type`, `resolution`, `time_to_resolve_minutes`, `was_escalated` |
| `work_item_released_unfinished` | `type`, `time_held_minutes` (signals abandonment patterns) |
| `claim_force_released` | `type`, `reason_category` (admin override behaviour) |

These feed a "Queue manager activity" dashboard in PostHog.

---

## What members see

Members never see the queue or admin surfaces. But the *state* of their
related work items affects what members see:

- A member who filed a flag sees: "Your flag is being reviewed" (not
  "claimed by Paul" — they don't need that detail)
- An applicant in vetting sees: "Your application is being reviewed.
  Usually takes 24 hours" — no claim details exposed
- When the work item resolves, the member gets the appropriate notification
  ("Your flag was actioned" / "Your application was approved")

Honest copy throughout. No claim mechanics surfaced to members. State
changes are summarised, not detailed.

---

## What this doc does NOT cover

1. **Type-specific resolution forms.** Each work-item type has its own
   resolution UI (vetting needs different fields than flag review). These
   are per-type concerns specified when the related Build Units are briefed.
2. **Queue manager workload balancing.** "Sharon has 12 active claims; route
   new vetting cases to Paul" — Phase 2 feature; needs more pilot data
   first. With no region scoping in MVP, workload self-balances naturally.
3. **Notification preferences for queue managers.** "Don't notify me when
   urgent work appears after 9pm" — Phase 2.
4. **Bulk operations on work items.** "Release all my claims" — admin can do
   this via the admin surface; no specific bulk UI.
5. **Work-item dependencies.** Item B can't be resolved until item A is —
   not in MVP. Add when needed.
6. **Recurring work items.** "Every Monday, create a 'check pending vetting'
   work item" — out of MVP scope.
7. **Conflict of interest detection.** "Sharon is about to review someone
   she knows" — informal norm in MVP; formal detection deferred.

---

## Implementation order

1. **ERD lands** with `work_items` table per this spec → unblocks everything
   below
2. **BU-001** (admin scaffolding) builds the generic queue UI on top of
   `work_items`, plus role-grants and coordinator-profile scaffolding
3. **First Build Unit that creates work items** (probably BU-002 vetting or
   BU-012 flagging) populates the queue with real data
4. **Auto-release sweeper** runs as a Vercel cron job — half-day to set up,
   sits in scope of BU-001
5. **Heartbeat endpoint** ships in BU-001
6. **Claim avatar component** ships in BU-001 as part of generic queue UI
7. **Admin force-release flow** ships in BU-001

The work-items model is foundational. Get the schema right first; everything
else is mechanics on top.
