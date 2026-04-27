---
slug: erd-slice-1-5
status: shipped
shipped_in: "#4"
phase: 1
---
# SESSION BRIEF · ERD Slice 1.5 — Groups entities

*Brief version: 1.0 · Author: Paul · Date: April 2026*

---

## Objective

Extend the Prisma schema, entity metadata map, and ERD narrative with
the two Groups entities (`Group`, `GroupMembership`) plus a small field
addition to existing tables. Honours all six schema conventions from
Slice 1. Success looks like: schema validates, `groupTags` field works
on WorkItem and (future) Post, seed regions now include an optional
set of starter groups, and the admin surface's metadata has entries
for both new entities. No feature code — this is schema-only, per the
slice convention.

---

## Scope

### Build in this session

- `/prisma/schema.prisma` (modify — add Group + GroupMembership models, enums;
  add `groupTags String[]` to WorkItem; extend User with group-related relations)
- `/server/admin/entity-metadata.ts` (modify — add entries for Group
  and GroupMembership)
- `/docs/architecture/erd.md` (modify — extend Mermaid diagram, add
  Slice 1.5 narrative section)
- `/tests/unit/schema.smoke.test.ts` (modify — add a smoke test
  that references the new models)

### Do NOT touch

- Any existing entity's fields except those explicitly listed (WorkItem.groupTags, User relations for group memberships)
- Any file under `/docs/product/` or `/docs/process/` — decisions are made
- Any file under `/app/`, `/server/routers/`, `/server/services/`, `/components/` — feature code is not in scope
- The `Post` entity — doesn't exist yet; `Post.groupTags` lands in Slice 2
- `eslint.config.js`, `package.json`, `CLAUDE.md` — unchanged
- ADRs (decision log) — D043 is already written; this session implements it, doesn't change it
- Any existing Slice 1 entity's core fields, relations, indexes, or comments — only the additions listed

### Out of scope for this session

- **Feature code** — no routers, services, UI. This is schema-only.
- **Seed data** — F10 is the seed session; this brief produces no seed rows
- **Migrations** — the `prisma migrate dev` run happens separately; this session produces the schema definition only
- **Request-to-join workflow** — described in groups.md but belongs to a later Build Unit (new WorkItemType `group_join_request` enum value may need adding later)
- **Group logo upload UI** — schema has `logoUrl String?`; the upload flow is Phase 1.5+ per `image-handling.md`
- **Group lead role permissions** — per groups.md, "lead" is a soft role with no tech permissions in MVP; schema supports it, features don't use it yet
- **Group analytics** — member counts, posts-per-group stats are Phase 1.5+ concerns

---

## Contracts

### Inputs consumed

- `/docs/product/groups.md` — the authoritative spec for Groups. Schema must implement its "Schema for ERD Slice 1.5" section exactly.
- `/docs/architecture/decision-log.md` D043 — the decision rationale
- `/docs/architecture/admin-surface.md` — the 6 schema conventions that both new entities must satisfy
- `/docs/architecture/claim-and-lease.md` — WorkItem.groupTags addition referenced in §"No region scope in MVP" extension
- `/prisma/schema.prisma` — read it in full first; the session EXTENDS this file
- `/server/admin/entity-metadata.ts` — read it in full first; the session EXTENDS this file  
- `/docs/architecture/erd.md` — read it in full first; the session EXTENDS it

### Outputs produced

- **`Group` Prisma model** — fields per groups.md §"Schema for ERD Slice 1.5"
- **`GroupMembership` Prisma model** — same reference
- **New enums:** `GroupJoinPolicy`, `GroupMembershipRole`, `JoinSource`
- **`WorkItem.groupTags`** — `String[]` column with GIN index
- **`User` extensions** — three new relations (groupMemberships, groupsCreated, groupApprovals)
- **`entityMetadata`** — two new entries (`group`, `groupMembership`)
- **`erd.md` additions** — Mermaid diagram updated; narrative section "Slice 1.5 — Groups"
- **Smoke test assertion** — that Group and GroupMembership types exist on the Prisma client

---

## Acceptance criteria

- [ ] `npx prisma validate` succeeds with zero errors
- [ ] `npx prisma format` produces no changes (schema is already formatted)
- [ ] `Group` model has: `id`, `slug` (unique), `displayName`, `description?`, `logoUrl?`, `joinPolicy` (enum, default `open`), `isOfficial` (Boolean, default false), `createdAt`, `updatedAt`, `deletedAt?`, `createdByUserId`, `createdBy` relation to User
- [ ] `GroupMembership` model has: `id`, `userId`, `user`, `groupId`, `group`, `role` (enum, default `member`), `joinedAt`, `joinedVia` (enum, default `self_join`), `leftAt?`, `leftReason?`, `approvedByUserId?`, `approvedBy?` relation
- [ ] `GroupMembership` has `@@unique([userId, groupId])` to enforce one active membership per pair
- [ ] New enums: `GroupJoinPolicy` (open, request_to_join, admin_only), `GroupMembershipRole` (member, lead), `JoinSource` (self_join, request_approved, admin_added, admin_invited)
- [ ] `WorkItem.groupTags` is `String[] @default([])`
- [ ] `WorkItem` has `@@index([groupTags], type: Gin)` for array search
- [ ] User has three new relations: `groupMemberships`, `groupsCreated`, `groupApprovals` — all properly disambiguated with `@relation("...")` names
- [ ] Every new entity has `createdAt` and `updatedAt`
- [ ] Group and GroupMembership have `deletedAt` (soft delete eligible)
- [ ] GroupMembership relations use `Cascade` on delete (covered in groups.md)
- [ ] Group.createdBy uses `Restrict` (preserves the "who created this group" audit chain)
- [ ] `entityMetadata` has entries for `group` and `groupMembership` with appropriate `listColumns`, `searchableFields`, `defaultSort`, `requiresRole`
- [ ] All file headers include `@build-unit BU-001-prep` or `@build-unit Slice-1-5`, `@spec product/groups.md`, `@spec architecture/decision-log.md D043` (per D038)
- [ ] Mermaid diagram in `erd.md` extended to show Group, GroupMembership, their relations to User and WorkItem
- [ ] Narrative section "Slice 1.5 — Groups" added to `erd.md` explaining what was added and why
- [ ] Smoke test assertion added that Prisma client exposes Group and GroupMembership types
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes (previous tests + updated smoke test)
- [ ] `npm run lint` passes with zero new violations
- [ ] `npx prettier --check .` passes on all modified files

---

## Permission matrix

*(Adapted from template — this is a schema session; the "matrix" is how Group visibility relates to existing roles.)*

| Action | Member | Queue manager | Admin |
|---|---|---|---|
| List all groups | ✓ | ✓ | ✓ |
| View group page | ✓ | ✓ | ✓ |
| View group members | ✓ (subject to future hide-my-groups setting) | ✓ | ✓ |
| Join open group | ✓ | ✓ | ✓ |
| Request to join `request_to_join` group | ✓ | ✓ | ✓ |
| Self-leave a group | ✓ (own membership only) | ✓ | ✓ |
| Filter queue by group | ✗ | ✓ | ✓ |
| Create group | ✗ | ✗ | ✓ |
| Edit group | ✗ | ✗ | ✓ |
| Archive group | ✗ | ✗ | ✓ |
| Add/remove member (admin-managed) | ✗ | ✗ | ✓ |
| Set group lead role | ✗ | ✗ | ✓ |
| Approve pending join request | ✗ | ✗ | ✓ |

Schema must support these access patterns via foreign-key relationships
and scoping fields. Actual middleware/router enforcement is built in BU-admin.

---

## Entity invariants

| Invariant | How enforced |
|---|---|
| A user has at most one active membership per group | `@@unique([userId, groupId])` — active = leftAt IS NULL; if a user re-joins after leaving, app-level logic creates a new membership row (leftAt history preserved) |
| Group slug is globally unique | `@@unique` on slug |
| Soft-deleted groups don't appear in default queries | App-level WHERE clause; documented as convention |
| A group's `createdBy` user cannot be hard-deleted while the group exists | `onDelete: Restrict` on the relation |
| A membership's user and group cascade: if either is hard-deleted, the membership row is removed | `onDelete: Cascade` on both FKs |
| Approving a pending request creates a `GroupMembership` with `joinedVia=request_approved` and populates `approvedByUserId` | App-level enforcement in future `group.approveRequest` procedure |
| `request_to_join` groups use a `work_item` of a new type to surface join requests in the queue | Future work; WorkItem enum extension deferred |

---

## Tests required

- **Smoke test addition:** update `tests/unit/schema.smoke.test.ts` to import the Prisma client and assert that `Group` and `GroupMembership` types exist (similar to how Slice 1 tested its entities)
- **Prisma validate + format:** via `npx prisma validate` and `npx prisma format`
- **Typecheck:** `npm run typecheck` — ensures no regressions from the new types

**Not required:**
- Integration tests against a real database
- Router/service tests (feature code is out of scope)
- UI tests

---

## Scenarios to verify against

*(Adapted from template — schema supports future scenarios; no direct user-facing flow yet.)*

Verify the schema supports these scenarios when groups land as a feature:
- A member joins "Writers" (open group) — single row in GroupMembership, joinedVia=self_join
- A member requests to join "Vetting Team" (request_to_join) — a WorkItem of type `group_join_request` is created; on approval, GroupMembership is created with joinedVia=request_approved
- Admin adds a member to "Founding Members" (admin_only) — GroupMembership created with joinedVia=admin_added, approvedBy populated
- A member leaves a group — leftAt and optionally leftReason populated; the row stays for history
- A queue manager filters the queue by "Writers" — query uses `WHERE 'writers' = ANY(groupTags)` against WorkItem, benefitting from the GIN index
- Admin archives a defunct group — `deletedAt` set; memberships remain but don't appear in default queries

---

## Known gotchas

- **Prisma array indexes.** `@@index([field], type: Gin)` syntax is specific to Prisma's Postgres support. Verify the Prisma version supports this syntax; fall back to `@@index([field])` if not (GIN is the default for array types in Postgres anyway).
- **Self-relations on User.** Group.createdBy and GroupMembership.approvedBy both reference User. Prisma requires disambiguating `@relation` names.
- **Array default syntax.** `@default([])` works for Postgres String[] fields; confirm against Prisma 5 syntax.
- **WorkItem existing data.** Adding `groupTags String[] @default([])` to an existing entity requires a migration. For MVP, the migration is auto-generated; for production, be explicit.
- **Do not modify claim-and-lease.md.** That doc already mentions Slice 1.5 will add `groupTags` to WorkItem. No doc changes needed; just schema changes.
- **The `User.createdGroups` relation.** One-to-many from User (as creator) to Group. Do not create a `User.groups` relation directly; go through GroupMembership.
- **The JoinSource enum mirrors admin-surface.md's audit pattern.** `admin_invited` is for a future "invite a member to join" flow; it's valid now but no code path populates it yet.

---

## Definition of done

- [ ] All 4 files in "Build" list modified as specified
- [ ] No files in "Don't touch" list modified
- [ ] `npx prisma validate` passes
- [ ] `npx prisma format` produces no changes
- [ ] `npm run test` passes (all existing + updated smoke test)
- [ ] `npm run lint` passes with zero violations
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npx prettier --check .` passes
- [ ] File headers include appropriate `@build-unit` and `@spec` annotations
- [ ] Mermaid diagram updated and renders correctly (test with mermaid.live if unsure)
- [ ] Commit message: `feat(schema): ERD Slice 1.5 — Groups (Group, GroupMembership, WorkItem.groupTags)`
- [ ] Branch pushed; PR opened against `main`
- [ ] Open questions list (below) populated with any judgement calls made

---

## Open questions to surface

Pre-identified. Claude Code, do not make assumptions silently.

1. **GIN index syntax for Prisma 5.** `@@index([groupTags], type: Gin)` — does your Prisma version accept the `type: Gin` parameter? If not, use `@@index([groupTags])` and note that Postgres defaults to GIN for array types.

2. **`JoinSource` enum completeness.** Four values proposed: `self_join`, `request_approved`, `admin_added`, `admin_invited`. Any concern these are insufficient for future flows? (e.g., `imported`, `migrated`.) Surface or add.

3. **Seed data for starter groups.** Per `docs/product/groups.md`, ~10 starter groups are specified (Writers, Newsletter Editors, Vetting Team, etc.). This session does NOT seed them (per out-of-scope). But: if you prefer, the schema README can document the starter list for F10's reference. Surface a recommendation.

4. **WorkItem enum extension for `group_join_request`.** Groups.md mentions this as a new WorkItemType for request_to_join groups. The enum currently doesn't include it. Options: (a) add now, alongside Group entity; (b) add in the Build Unit that actually implements the join flow. Surface a recommendation.

5. **File-header `@build-unit` value.** Slice 1 used `BU-001-prep`. This slice extends the same schema; same build-unit tag, or a new one like `Slice-1-5`? Suggest: continue `BU-001-prep` since both slices feed into BU-admin scaffolding.

6. **`coordinatorGroup` vs `group` naming conflict.** `CoordinatorGroup` already exists in Slice 1 (external communities coordinators run). Now adding `Group` (internal affiliation markers). The two are different concepts but the naming proximity could confuse. Per D042 and D043, this is the agreed-upon language. No action unless you spot a tangible problem.

---

## Context

Read these before starting. Listed in priority order.

**Specs (authoritative):**
- `/docs/product/groups.md` — the full Groups spec; schema implements §"Schema for ERD Slice 1.5" exactly
- `/docs/architecture/decision-log.md` D043 — the decision rationale

**Existing files to extend (read first):**
- `/prisma/schema.prisma` — extend, don't replace
- `/server/admin/entity-metadata.ts` — extend the `entityMetadata` constant
- `/docs/architecture/erd.md` — extend the Mermaid diagram and narrative
- `/tests/unit/schema.smoke.test.ts` — extend the existing smoke assertions

**Process / convention:**
- `/docs/architecture/admin-surface.md` — six schema conventions that apply to every new entity
- `/docs/process/session-brief-template.md` — this brief follows that template
- `/docs/process/session-hygiene.md` — if context runs tight, checkpoint + handoff
- `/CLAUDE.md` — operating context

---

## Slice convention

This session extends the ERD in the established way:
- `prisma/schema.prisma` grows; no refactor of existing entities
- `entity-metadata.ts` grows; no refactor of existing entries
- `erd.md` grows; the Mermaid diagram extends
- No existing entity's fields change except the one explicitly-listed `WorkItem.groupTags` addition

Future slices (2, 3, 4) follow the same pattern.

---

## What this brief does NOT cover

1. **The request-to-join workflow.** Work item type addition deferred.
2. **The group-join UI.** BU-admin or a later session.
3. **Group analytics.** Phase 1.5+.
4. **Group logos upload.** Phase 1.5+ per image-handling.md.
5. **Group lead permissions.** Soft role in MVP; no middleware.
6. **Hide-my-groups privacy.** Parking lot.
7. **Algorithmic group suggestions.** Phase 2.
8. **Group-private feeds or chat.** Explicitly rejected (D041, D043).

---

## What lands in MVP after this slice

- Group and GroupMembership tables exist
- WorkItem can carry group tags (filter-ready)
- Admin surface's generic scaffolding will automatically pick up the new entities when BU-admin lands (no per-entity code needed)
- The schema is ready for the actual group-feature Build Units to wire up
