# Admin surface

**Purpose:** The application must be usable at the data layer before — and
without — bespoke member UI for every feature. This document defines how
that's achieved: the principles, the schema conventions that enable it, the
generic admin scaffolding pattern, and the role model.

**Status:** Architectural. ERD must honour the conventions here.
**Build Unit:** BU-001 (Admin scaffolding) — first Build Unit after ERD lands.
**Related:** D003 (stack), D040 (work_items), D041 (region as tag only),
D042 (coordinator vs queue-manager split), claim-and-lease.md,
security-baseline.md, B07 (audit log).

---

## The principle

**Every entity in the system is usable through admin scaffolding before the
member-facing UI exists.** Queue managers and admins can do real work —
approving vetting cases, resolving flags, editing posts, adjusting feature
flags — through a generic admin interface that's auto-generated from the
schema.

This isn't "we'll build admin later." It's the *default operating mode during
build*. The polished member UI is a layer that arrives later. The admin
surface is what makes the product real on day one.

---

## Why this matters

Three concrete benefits:

**1. Pilot before polish.** Sharon and Jeremy can use real workflows on plain
admin pages while the lovely member UI is still being built. The pilot doesn't
wait for the feed to be perfect.

**2. Operational recovery.** When something breaks in production — a flag
stuck in a weird state, a member needing manual approval, a post needing
edit — the admin surface fixes it without shipping code.

**3. Schema validation.** Building the admin first forces honest schema
design. If a row can't be displayed and edited usefully, the schema is wrong.
If admin actions can't be cleanly audited, the audit pattern is wrong. The
admin surface is a stress-test of the model.

---

## The non-negotiable rule

**Admin actions go through the same backend as member actions.** Same tRPC
procedures. Same auth middleware. Same Zod validation. Same audit logging.
Same analytics events.

What an admin "edit a post" page does is call `trpc.post.edit.mutate(...)`
exactly as a member-facing edit UI would. The form is generic; the backend
is the same.

**This rules out:**
- Direct database edits via Prisma Studio in production (Studio stays
  dev-only)
- External admin tools (Retool, Forest) that connect directly to the database
- Any code path that mutates data without going through tRPC + middleware

If you find yourself wanting to do something in admin that the API doesn't
support, the answer is to add the API procedure (with proper auth, validation,
audit), not to bypass it.

---

## Six schema conventions that make this work

ERD must follow all six. They're cheap if adopted from day one and expensive
to retrofit.

### 1. Every entity has a human-readable display field

Every table has a `displayName`, `title`, `name`, or equivalent — *something*
the admin list view can render to identify rows beyond UUIDs.

```prisma
// ✅ GOOD
model Post {
  id          String @id @default(uuid())
  title       String  // ← admin list shows this
  body        String
  // ...
}

// ❌ BAD
model SystemFlag {
  id          String @id @default(uuid())
  enabled     Boolean
  config      Json   // ← admin can't tell one row from another
}
```

For entities without a natural name (like join tables, audit entries), the
admin metadata map provides a `displayTemplate` that composes one from
related fields.

### 2. Soft deletes by default

`deleted_at TIMESTAMP NULL` instead of `DELETE FROM ...`.

Reasons:
- Admins occasionally need to recover deleted rows
- Audit trail is preserved
- Foreign-key cascades don't surprise you
- "Deleted" can mean different things (hidden vs purged); a timestamp is more
  honest than a boolean

Hard deletes are reserved for compliance scenarios (DSAR, GDPR right to
erasure) and run through dedicated procedures, not the generic admin.

### 3. Rich enum types, not free-text status fields

```prisma
// ✅ GOOD
enum FlagStatus {
  unclaimed
  claimed
  in_review
  resolved_dismissed
  resolved_actioned
  resolved_escalated
}

// ❌ BAD
status String  // "pending"? "Pending"? "PENDING"? Drift accumulates.
```

Prisma enums become dropdowns in the admin UI automatically. Free-text status
fields become typo soup.

### 4. Timestamps on everything

Every table has at minimum `created_at`, `updated_at`. Domain-relevant
timestamps too: `published_at`, `resolved_at`, `claimed_at`, etc.

Admin lists default-sort by `created_at DESC`. Filters use timestamps for
"created in last 7 days." Timestamps are the spine of admin UX.

### 5. Foreign keys with explicit `onDelete` policies

Every relation declares what happens when the parent goes away:

```prisma
model Comment {
  id      String @id
  postId  String
  post    Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  // ↑ explicit. Not relying on default.
}
```

Options Prisma gives us: `Cascade`, `Restrict`, `SetNull`, `NoAction`.
Each relation chooses one deliberately. The admin UI uses this metadata to
warn before destructive operations: "Deleting this post will also delete 12
comments. Continue?"

### 6. Entity metadata as a structured map

Alongside the Prisma schema, a TypeScript metadata map declares per-entity
configuration the admin needs:

```typescript
// server/admin/entity-metadata.ts
export const entityMetadata = {
  post: {
    displayField: "title",
    listColumns: ["title", "author.displayName", "regionTag", "status", "createdAt"],
    searchableFields: ["title", "body"],
    defaultSort: { createdAt: "desc" },
    bulkActions: ["delete", "verify", "unverify"],
    requiresRole: { view: "queue_manager", edit: "admin" },
    workflow: null,
  },
  workItem: {
    displayField: "id",
    displayTemplate: "{type} — {context.summary}",
    listColumns: ["type", "status", "priority", "claimedBy.displayName", "createdAt"],
    searchableFields: ["type", "context"],
    defaultSort: [{ priority: "desc" }, { createdAt: "asc" }],
    bulkActions: ["release_claim"],
    requiresRole: { view: "queue_manager", edit: "queue_manager" },
    workflow: "queue",  // → renders in /queue, not generic /admin
  },
  coordinatorProfile: {
    displayField: "user.displayName",
    listColumns: ["user.displayName", "groupsCount", "createdAt"],
    searchableFields: ["user.displayName", "groups.name"],
    defaultSort: { createdAt: "desc" },
    requiresRole: { view: "admin", edit: "admin" },
    workflow: null,
  },
  roleGrant: {
    displayField: "user.displayName",
    displayTemplate: "{role} for {user.displayName}",
    listColumns: ["user.displayName", "role", "grantedBy.displayName", "grantedAt", "revokedAt"],
    searchableFields: ["user.displayName"],
    defaultSort: { grantedAt: "desc" },
    requiresRole: { view: "admin", edit: "admin" },
    workflow: null,
  },
  // ... one entry per entity
}
```

This metadata file is the single source of truth for what the admin UI does
with each entity. Adding a new entity means: add to schema, add to metadata,
admin UI picks it up automatically. No new pages, no new components.

---

## The generic admin scaffolding

**One implementation, all entities.**

### Routes

- `/admin` — entity list (which entities exist, counts, last-updated times)
- `/admin/[entity]` — list view for a given entity (table with filters,
  search, pagination)
- `/admin/[entity]/[id]` — detail view (read-only by default; edit button
  opens form)
- `/admin/[entity]/new` — create form
- `/admin/[entity]/[id]/edit` — edit form
- `/admin/coordinators` — list of coordinator profiles (see below)
- `/admin/roles` — role-grant management (see below)
- `/queue` — work items list (uses the same scaffolding but specialised; see
  claim-and-lease.md)

### Components

A small library of generic components:

- `<EntityListPage>` — reads the metadata, renders the table with the right
  columns, filters, search, pagination
- `<EntityDetailPage>` — reads the metadata, renders fields with the right
  types
- `<EntityForm>` — generates form fields from the Zod schema (same Zod
  schemas defined for tRPC procedures)
- `<RelationField>` — handles foreign-key fields with searchable dropdowns
- `<EnumField>` — dropdowns from Prisma enums
- `<JsonField>` — for context payloads, with syntax highlighting

The `<EntityForm>` is the cleverest piece — it reads the same Zod input
schemas that tRPC mutations declare (per api-contract-discipline.md), so
admin form validation is automatically identical to API validation. Change
the Zod schema once, both forms and API stay in sync.

### Bulk actions

The metadata declares which bulk actions are available per entity. The
generic list page renders checkboxes per row + a bulk action menu. Each bulk
action is its own tRPC procedure with the same auth/audit/validation
patterns.

---

## The role model

Three roles, with two of them managed dynamically:

| Role | What they can do | How it's granted |
|---|---|---|
| **member** | Baseline: post, comment, react, view feed. Everyone has this. | Automatic on signup + vetting approval |
| **queue_manager** | Everything a member can do, PLUS: claim and resolve work items, view the queue, use admin-scaffolded views for entities they moderate. Cannot edit config, feature flags, or manage roles. | Admin-granted; revocable at will |
| **admin** | Full access. Everything a queue manager can do, PLUS: grant/revoke queue_manager role, manage feature flags, edit system config, force-release claims, delete/restore any entity. | Admin-granted; revocable at will (by another admin) |

### Coordinator — NOT a role

**"Coordinator" is a separate concept** — it identifies a member who runs
other groups outside GPS Action (a WhatsApp group, a newsletter, a shul
network, etc.). It is **data about the member**, not a permission.

- A coordinator has no special powers in GPS Action
- A coordinator may also be a queue_manager (two independent properties)
- A coordinator may also be an admin (two independent properties)
- A plain member can be a coordinator (most common case)

See §"Coordinator identity" below for schema details.

### Role checks at three layers (defence in depth)

1. **Route middleware** — `/admin/*` and `/queue` require `queue_manager` or
   `admin`. Rejected at the edge.
2. **tRPC procedure middleware** — every admin-relevant procedure declares
   its required role via the `requireRole` middleware (per
   api-contract-discipline rule 7).
3. **Database-level row scoping** — admin-only data (role grants, audit log,
   feature flags) is filtered at the query level based on role. Queue
   managers see work items (not region-scoped, per D041); admins see
   everything.

**Note on region scoping:** per D041, neither members nor queue managers are
scoped by region in MVP. Every queue manager sees every work item in the
single global queue. Region is a tag on posts and work items, visible in the
UI but not a filter.

---

## Dynamic role management

Per D042, queue_manager and admin roles are **dynamic** — admins can grant
and revoke them at will. This is more sophisticated than a static roles
column: we want full provenance.

### The `role_grants` table

Separate from the `users` table. Captures every grant and revocation
historically:

```prisma
enum SystemRole {
  queue_manager
  admin
}

model RoleGrant {
  id               String     @id @default(uuid())
  userId           String
  user             User       @relation("roleGrants", fields: [userId], references: [id], onDelete: Cascade)
  role             SystemRole
  
  grantedAt        DateTime   @default(now())
  grantedByUserId  String
  grantedBy        User       @relation("roleGrantsMade", fields: [grantedByUserId], references: [id], onDelete: Restrict)
  grantedReason    String     // required — why was this granted?
  
  revokedAt        DateTime?
  revokedByUserId  String?
  revokedBy        User?      @relation("roleGrantsRevoked", fields: [revokedByUserId], references: [id], onDelete: Restrict)
  revokedReason    String?    // required on revocation — why was this revoked?
  
  createdAt        DateTime   @default(now())
  
  @@index([userId, role, revokedAt])
  @@index([grantedAt])
}
```

**Active role test:** a user has a role if there exists a `RoleGrant` where
`user_id = X AND role = Y AND revoked_at IS NULL`.

### Grant workflow

1. Admin navigates to `/admin/roles`
2. Admin selects a user and a role (queue_manager or admin)
3. Admin enters a reason (required — e.g. "Running our WhatsApp group
   moderation team; volunteered to help with vetting")
4. System creates a `RoleGrant` row
5. Audit log entry written: `role_granted` with role, target, reason, granter
6. Target user's active role is now elevated on their next session refresh
   (or immediately, via session invalidation — see below)

**MVP: single-admin grant.** One admin's action is sufficient. Audit trail
provides accountability. Revisit two-admin approval if admin team grows
beyond ~5 people.

**MVP: admin-initiated only.** No self-nomination flow. If a member wants
to volunteer, they talk to an admin. Admin grants if appropriate. Self-
nomination via a form could be added in Phase 2 (as its own work-item type
with an approval queue).

### Revoke workflow

1. Admin navigates to `/admin/roles`
2. Admin finds an active grant and clicks "Revoke"
3. Admin enters a reason (required)
4. System updates the `RoleGrant` row: `revoked_at`, `revoked_by_user_id`,
   `revoked_reason`
5. Any work items currently claimed by the revoked user are auto-released
   (returned to queue with audit entry)
6. The user's session is invalidated — they're logged out within 60 seconds
   and must log in again; on re-login they'll have whatever roles remain
7. Audit log entry: `role_revoked` with reason

**Revocation takes effect fast** — no "wait for their session to expire"
semantics. If we revoke, we mean it.

### Self-revoke

A user can revoke their own role at any time ("I no longer want to be a
queue manager"). No admin approval needed for self-revoke. Same claim
auto-release and session-invalidation applies.

### Audit visibility

- `/admin/roles` shows currently-active roles + recent grant/revoke activity
- `/admin/roles/history` shows the full historical log (all grants and
  revocations ever), filterable by user, role, and date range
- Users can see their own grant history in their profile settings
  ("You were granted queue_manager by Sharon on 2026-05-12 because 'X'")

### Special rules for admin role

Admin-role grants and revocations are **even more carefully logged** than
queue-manager grants:

- You cannot revoke your own admin role (prevents accidental self-lockout)
- The last remaining admin cannot be revoked — system prevents the
  "no admins exist" state
- Admin grant requires an existing admin to perform it (cannot bootstrap
  without seed data — first admin is created by database seed)

---

## Coordinator identity

Per D042, "coordinator" identifies a member who runs communities/groups
outside GPS Action. **It's not a permission** — it's data attached to a
member that future features can use (reach analytics, amplification
visibility, etc.).

### Schema — two tables

```prisma
model CoordinatorProfile {
  id         String              @id @default(uuid())
  userId     String              @unique
  user       User                @relation("coordinatorProfile", fields: [userId], references: [id], onDelete: Cascade)
  
  notes      String?             // admin-only notes about this coordinator
  
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt
  deletedAt  DateTime?
  
  groups     CoordinatorGroup[]
  
  @@index([deletedAt])
}

model CoordinatorGroup {
  id                     String              @id @default(uuid())
  coordinatorProfileId   String
  coordinatorProfile     CoordinatorProfile  @relation(fields: [coordinatorProfileId], references: [id], onDelete: Cascade)
  
  name                   String              // "AJ6 North London WhatsApp"
  description            String?             // optional longer description
  logoUrl                String?             // uploaded image
  reachEstimate          Int?                // points the way to future 2-way sync
  reachVerifiedAt        DateTime?           // populated by future analytics integration
  
  createdAt              DateTime            @default(now())
  updatedAt              DateTime            @updatedAt
  deletedAt              DateTime?
  
  @@index([coordinatorProfileId, deletedAt])
}
```

### Capture workflow (MVP — self-claim, no verification)

Per M3 (self-claim, no verification), members can declare themselves
coordinators and add their groups without admin approval. The data is
treated as self-reported.

**Where it's captured:**
1. **Onboarding (optional):** during signup, after vetting approval, an
   optional question: *"Do you run a WhatsApp group, newsletter, or other
   community?"* Skippable. If they say yes, collect group details.
2. **Profile settings (anytime):** members can add/edit/remove groups at
   any time via their profile settings page.

Both entry points create/update the same `CoordinatorProfile` + `CoordinatorGroup`
records.

**What's captured per group:**
- `name` — free text, required
- `description` — free text, optional
- `logoUrl` — image upload, optional
- `reachEstimate` — integer, optional (member's own estimate of audience size)

**No verification state.** The data is displayed as-is. A "verified" marker
can be added in a future migration when analytics reliability matters.

### Display of coordinator status

- **On a member's public profile (if any):** a small list of groups they run
  ("Runs AJ6 North London WhatsApp, Northwood Shul Newsletter")
- **In admin surface:** `/admin/coordinators` lists all members who have a
  coordinator profile, with their groups and totals

### What coordinators can do

Exactly what any member can do. Coordinator status unlocks:
- Their groups appearing on their profile
- Being counted in future "amplification reach" analytics
- Identification by admins for outreach ("we'd like to coordinate a push
  through our coordinators")

Coordinator status does **not** grant queue-manager or admin privileges.
Those are separate roles under `role_grants`.

---

## Audit log integration

Every admin action and every role/permission change emits an audit entry
(per B07 spec):

```
audit_log entry on role grant:
  user_id:          <admin who granted>
  action:           "role_granted"
  entity_type:      "RoleGrant"
  entity_id:        <grant id>
  target_user_id:   <user receiving role>
  changes:          { role: "queue_manager", reason: "..." }
  ip_address:       "..."
  user_agent:       "..."
  timestamp:        ISO8601
```

Similar entries for: `role_revoked`, `role_self_revoked`,
`coordinator_profile_created`, `coordinator_profile_updated`,
`coordinator_group_added`, `coordinator_group_removed`, and the standard
entity CRUD actions.

Audit entries are visible at:
- `/admin/audit` — full audit log (admin role only)
- `/admin/[entity]/[id]/history` — audit entries for a specific entity
  (any queue_manager with view rights)
- Users see their own role grant history in profile settings

---

## What this is NOT

- **Not a CMS.** This is operational tooling for queue managers and admins,
  not a content authoring system for marketing pages.
- **Not a member experience.** Members never see admin surfaces. The
  polished member UI is its own thing, built later.
- **Not a workflow builder.** Complex multi-step approval workflows are
  out-of-scope. Use the work-items pattern (claim-and-lease.md) for
  human-in-the-loop work; the admin surface is for entity CRUD.
- **Not analytics dashboards.** Looking at trends and metrics is PostHog's
  job (D037), not the admin surface.

---

## Phase 0 vs Phase 1

**Phase 0 (foundations):** ✗ admin scaffold not yet — it depends on schema.

**Phase 1, Build Unit BU-001:** ✓ generic admin scaffolding lands as the
first Build Unit after ERD. Approximately:

- Schema-derived list/detail/form components (~3 sessions)
- Entity metadata map for the Phase 1 entities (~1 session)
- Role middleware + role_grants system (~1 session)
- Audit integration (~1 session)
- Role grant/revoke flow (~1 session)
- Storybook stories for each generic component (~1 session)

Estimated total: 8 Claude Code sessions, roughly 2 weeks.

**Why this is BU-001 specifically:**
- Every other Build Unit benefits from "I can edit this entity in admin"
- It's a forcing function on schema quality
- It enables queue-manager workflows immediately, not after every feature ships
- It's the single highest-leverage Build Unit in the entire build

---

## Constraints on the ERD session

The ERD session must produce a schema that:

1. ✅ Has a `displayName` (or equivalent) on every entity
2. ✅ Has `deleted_at TIMESTAMP NULL` on every soft-delete-eligible entity
3. ✅ Uses Prisma enums for all status/category fields
4. ✅ Has `created_at` and `updated_at` on every entity
5. ✅ Declares explicit `onDelete` on every foreign-key relation
6. ✅ Includes the `work_items` table per claim-and-lease.md
7. ✅ Includes the `role_grants` table per this doc
8. ✅ Includes the `coordinator_profile` + `coordinator_group` tables per this doc
9. ✅ Is accompanied by an `entity-metadata.ts` map seed (one entry per entity)

The ERD session brief should reference this document as a constraint.

---

## What this doc does NOT cover

(The pattern — naming gaps explicitly.)

1. **The generic admin component implementations** — UI code lives in `/app/admin/*` and `/components/admin/*`, not specified here. Built in BU-001.
2. **Bulk action UX details** — checkbox patterns, confirmation dialogs, error
   recovery. Specified during BU-001 design.
3. **Search ranking** — admin search uses Postgres full-text per NFR; ranking
   strategies are an implementation concern.
4. **Coordinator-dashboard** — "what are our coordinators reaching this week"
   analytics dashboards are Phase 2 (use audit log + future reach data).
5. **Two-admin approval for grants** — not in MVP per M1; revisit if admin team grows past ~5.
6. **Self-nomination flow for queue_manager** — not in MVP per M2; Phase 2 as a new work-item type.
7. **Coordinator profile verification** — not in MVP per M3a; add if/when
   analytics reliability matters.
8. **Mobile admin** — admin is desktop-first. Mobile admin is Phase 2 if at
   all.
9. **Admin via API tokens** — for external automation. Out of MVP scope; would
   need a separate API key system.
