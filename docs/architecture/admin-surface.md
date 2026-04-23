# Admin surface

**Purpose:** The application must be usable at the data layer before — and
without — bespoke member UI for every feature. This document defines how
that's achieved: the principles, the schema conventions that enable it, the
generic admin scaffolding pattern, and the role model.

**Status:** Architectural. ERD must honour the conventions here.
**Build Unit:** BU-001 (Admin scaffolding) — first Build Unit after ERD lands.
**Related:** D003 (stack), claim-and-lease.md, security-baseline.md, B07 (audit
log).

---

## The principle

**Every entity in the system is usable through admin scaffolding before the
member-facing UI exists.** Coordinators can do real work — approving vetting
cases, resolving flags, editing posts, adjusting feature flags — through a
generic admin interface that's auto-generated from the schema.

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
    listColumns: ["title", "author.displayName", "regionSlug", "status", "createdAt"],
    searchableFields: ["title", "body"],
    defaultSort: { createdAt: "desc" },
    bulkActions: ["delete", "verify", "unverify"],
    requiresRole: { view: "coordinator", edit: "admin" },
    workflow: null,  // not a claimable work item
  },
  workItem: {
    displayField: "id",
    displayTemplate: "{type} — {context.summary}",
    listColumns: ["type", "status", "priority", "claimedBy.displayName", "createdAt"],
    searchableFields: ["type", "context"],
    defaultSort: [{ priority: "desc" }, { createdAt: "asc" }],
    bulkActions: ["release_claim", "reassign"],
    requiresRole: { view: "coordinator", edit: "coordinator" },
    workflow: "queue",  // → renders in /queue, not generic /admin
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

Three roles for admin surface access:

| Role | Can do |
|---|---|
| **member** | No admin access |
| **coordinator** | View admin lists for entities they're scoped to (their region's flags, their region's vetting cases). Can claim and resolve work items. Cannot edit configuration, feature flags, or other coordinators. |
| **admin** | Full access. Edit anything. Force-release claims. Toggle feature flags. Assign roles. |

Role checks are enforced at three layers (defence in depth):

1. **Route middleware** — `/admin/*` requires `coordinator` or `admin`. Rejected at the edge.
2. **tRPC procedure middleware** — every admin-relevant procedure declares its
   required role via the `requireRole` middleware (per api-contract-discipline
   rule 7).
3. **Database-level row scoping** — coordinators see their region's data only,
   enforced by SQL `WHERE region IN (user.regions)`. Not just "the UI hides
   it" — the data itself is scoped at query time.

Region scoping is critical for coordinator-level access. A North-West
coordinator must not be able to see South-West vetting cases by URL-tampering.
The query layer enforces this, not the UI.

---

## Audit log integration

Every admin action emits an audit entry (per B07 spec):

```
audit_log entry on admin edit:
  user_id:          "Paul"
  action:           "admin_edit_entity"
  entity_type:      "Post"
  entity_id:        "post-12345"
  changes:          { title: { from: "X", to: "Y" } }
  ip_address:       "..."
  user_agent:       "..."
  context:          { admin_route: "/admin/post/12345/edit" }
  timestamp:        ISO8601
```

The generic admin form computes the changes diff and includes it in the audit
entry automatically. No per-entity audit code needed.

Audit entries are visible at:
- `/admin/audit` — full audit log (admin role only)
- `/admin/[entity]/[id]/history` — audit entries for a specific entity (any
  coordinator with view rights)

---

## What this is NOT

- **Not a CMS.** This is operational tooling for coordinators and admins, not
  a content authoring system for marketing pages.
- **Not a member experience.** Members never see admin surfaces. The polished
  member UI is its own thing, built later.
- **Not a workflow builder.** Complex multi-step approval workflows are
  out-of-scope. Use the work-items pattern (claim-and-lease.md) for
  human-in-the-loop work; the admin surface is for entity CRUD.
- **Not analytics dashboards.** Looking at trends and metrics is PostHog's job
  (D037), not the admin surface.

---

## Phase 0 vs Phase 1

**Phase 0 (foundations):** ✗ admin scaffold not yet — it depends on schema.

**Phase 1, Build Unit BU-001:** ✓ generic admin scaffolding lands as the
first Build Unit after ERD. Approximately:

- Schema-derived list/detail/form components (~3 sessions)
- Entity metadata map for the Phase 1 entities (~1 session)
- Role middleware + region scoping (~1 session)
- Audit integration (~1 session)
- Storybook stories for each generic component (~1 session)

Estimated total: 7 Claude Code sessions, roughly 1.5–2 weeks.

**Why this is BU-001 specifically:**
- Every other Build Unit benefits from "I can edit this entity in admin"
- It's a forcing function on schema quality
- It enables coordinator workflows immediately, not after every feature ships
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
7. ✅ Is accompanied by an `entity-metadata.ts` map seed (one entry per entity)

The ERD session brief should reference this document as a constraint.

---

## What this doc does NOT cover

(The pattern — naming gaps explicitly.)

1. **The generic admin component implementations** — UI code lives in `/app/admin/*` and `/components/admin/*`, not specified here. Built in BU-001.
2. **Bulk action UX details** — checkbox patterns, confirmation dialogs, error
   recovery. Specified during BU-001 design.
3. **Search ranking** — admin search uses Postgres full-text per NFR; ranking
   strategies are an implementation concern.
4. **Coordinator dashboard** — "what work is my team doing this week"
   dashboards are Phase 2 (use audit log + work_items table).
5. **Mobile admin** — admin is desktop-first. Mobile admin is Phase 2 if at
   all.
6. **Admin via API tokens** — for external automation. Out of MVP scope; would
   need a separate API key system.
