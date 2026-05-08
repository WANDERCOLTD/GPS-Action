---
slug: bu-admin-group-membership
status: ready
phase: 2
priority: high
---

# SESSION BRIEF · bu-admin-group-membership — `/data/group-membership` admin page

_Author: Paul + Claude · Created: 2026-05-08_
_Type: extension to the generic admin entity registry. Adds `GroupMembership` to `/data` so sysadmins can manage who belongs to which group, and who's an admin within it._

---

## 1 · Business Analyst — why this matters

### The problem in plain language

Today, sysadmins can create groups (Writers, Manchester, IT-team) at `/data/group`. They can also create users at `/data/user`. **What they can't do** is connect the two — there's no UI for "make Bette a member of Writers" or "promote Eddie to Writers admin."

The connection is stored in `GroupMembership` rows in the database. Those rows are written silently when a member self-joins (via the seed script's defaults today; via a join flow when bu-prod-auth ships) — but admins have no way to **add a member, promote a member, demote a member, or remove a member** without database access.

### Who's blocked, and how

The pilot launch (Writers + IT-team) needs admins set up before any real testing happens. Right now the only way to set that up is for me (Paul) to run a SQL script. That's fine for me, but:

- Group admins (Bette for Writers, whoever-it-is for IT) can't manage their own groups even after launch.
- Onboarding a new group is a multi-step manual ritual rather than a click-flow.
- "Sharon needs Hendon admin access" turns into a Paul-bottleneck instead of a Bette-can-do-it click.

This is the **#1 gap** in the admin surface flagged in today's audit. Filing it as high priority.

### User stories

| As a … | I want to … | So that … |
| --- | --- | --- |
| Sysadmin | List all members of a group | I can see who's in Writers at a glance |
| Sysadmin | Add a user to a group | I can populate Writers with Bette/Eddie/Ingrid before pilot launch |
| Sysadmin | Promote a member to group admin | Bette can run Writers without my involvement |
| Sysadmin | Remove a member from a group | Eddie leaves Writers cleanly when he moves on |
| Sysadmin | Filter membership list by group OR by user | Cross-cut both directions when investigating |
| Group admin (later phase) | Manage members of *their* group only | Self-serve admin within their domain |

The **group-admin scope** (last row) is out of scope for this BU — first pass is sysadmin-only via `/data`. Group admins get their own bespoke flow in a follow-up under the existing `/board/<slug>/settings` chrome.

### Success criteria

- Pilot launch unblocked: I can set up Writers and IT-team membership through a UI, no SQL.
- Bette can be promoted to Writers admin via the same UI.
- An admin who removes a member sees the membership disappear from group views immediately.
- The audit log records who added/removed/promoted whom.

### What this is NOT

- Not a bulk-import / CSV upload tool (members will be small N for the pilot).
- Not a way for non-admins to manage memberships (sysadmin-only).
- Not the same surface as the Members of My Group ergonomic flow that group admins will eventually want — that's its own BU under `/board/<slug>/settings`.
- Not touching the join-flow for new members (that's part of bu-prod-auth).

---

## 2 · Tech Lead — how to build it

### Surface

`/data/group-membership` — list / create / update / softDelete / restore. Mirrors the pattern of the existing 8 admin entities. Wired through `server/services/admin/registry.ts` and `server/admin/entity-metadata.ts`.

The entity already has a metadata stub at `entity-metadata.ts:204–222` (per today's audit). Promote it to the full registry pattern.

### Schema (no changes)

`GroupMembership` already exists in `prisma/schema.prisma`:

```
model GroupMembership {
  id, userId, groupId
  role: GroupMembershipRole  // 'member' | 'admin'
  joinedAt, joinedVia: JoinSource
  leftAt, leftReason
  approvedByUserId, approvedAt
  deletedAt
  @@unique([userId, groupId])
}
```

No migration. Just expose the model through the registry.

### Service layer

Add `groupMembership` handler in `server/services/admin/registry.ts` following the pattern of the existing 8 entities:

- `list(input)` — paginated, filterable by `groupId`, `userId`, `role`, `deletedAt: null|<set>`. Default order `joinedAt DESC`.
- `get(id)` — single row with user + group joins for display.
- `create({ userId, groupId, role })` — insert with `joinedVia: 'admin_added'`. Honour the `@@unique([userId, groupId])` — if a soft-deleted row exists for this pair, undelete it instead of failing.
- `update(id, { role })` — only `role` is editable post-create (joinedAt/joinedVia are append-only history).
- `softDelete(id)` — set `deletedAt = NOW()`. Different semantic from `leftAt`: `deletedAt` = admin removed; `leftAt` = member chose to leave. Don't conflate.
- `restore(id)` — clear `deletedAt`.

Permission gate: sysadmin-only (`activeRoles.includes('admin')`). Same gate the other registry entities use.

Audit log: every create/update/softDelete/restore writes a row via `auditLog()` with `entityType: 'GroupMembership'`, action prefixed `group_membership_`. Reasons captured: `added`, `role_changed_to_<role>`, `removed`, `restored`.

### Metadata

Update `server/admin/entity-metadata.ts` to expose this in the registry:

- Move `GroupMembership` from the read-only metadata section into `ADMIN_ENTITY_KEYS`.
- Field config:
  - `userId` — required, FK to User, render as user-picker (search by displayName).
  - `groupId` — required, FK to Group, render as group-picker (search by displayName).
  - `role` — required, enum select (`member` | `admin`), default `member`.
  - `joinedAt`, `joinedVia`, `leftAt`, `leftReason`, `approvedByUserId`, `approvedAt` — read-only, list view only.
- Filters on list view: by `groupId`, by `userId`, by `role`, by `deletedAt`.

### Validation

Update `shared/validation/admin.ts` enum `ADMIN_ENTITY_KEY` to include `'group-membership'`.

### Routes / UI

The generic admin pages at `app/data/[entity]/page.tsx` and `app/data/[entity]/[id]/page.tsx` should pick this up automatically once the registry/metadata are wired. Verify the FK pickers render — if they don't, that's a metadata-driver gap, not a new component.

The Group entity's detail page (`/data/group/<id>`) should gain a "Members" tab/section that renders the membership list scoped to that group. Cheap addition — uses the same list query with a fixed `groupId` filter. **Optional** for this BU; can land as a polish follow-up if the time pressure is on.

### Tests

- Unit (service): list filter by groupId; create with auto-undelete on (userId, groupId) collision; update role only; softDelete vs leftAt distinction; restore clears deletedAt; audit-log shape per action.
- Integration (router): non-sysadmin → forbidden; sysadmin → success.
- Component: the existing `/data/[entity]` shell renders the new entity without modification (smoke).

### Edge cases the implementer should handle

1. **Adding a user to a group they already belong to** — `@@unique([userId, groupId])` will reject. The create handler should detect the existing row, check `deletedAt`, and either undelete (if previously removed) or return an idempotent "already a member" success.
2. **Soft-deleted user or group** — admin shouldn't be able to add a member referring to a soft-deleted user or group. Validate FKs in the create path.
3. **Removing the last admin from a group** — leaves the group leaderless. Out of scope to *prevent* at this layer (sysadmin can re-add); but log a warning in the audit context for trail.
4. **The kanban surface uses GroupMembership for membership gating** (search-includes-kanban etc). Removing a member from Writers should make their search-tickets results from Writers vanish on next query. This is automatic via the existing `where leftAt IS NULL AND deletedAt IS NULL` filter — verify, don't fix.

### Out of scope (park)

- Group admin self-serve UI (will live at `/board/<slug>/settings` in a follow-up).
- Bulk operations (CSV import, bulk role change). Pilot N is small; defer.
- Approval workflow for request-to-join groups (`approvedByUserId`/`approvedAt` are display-only here; the join-flow will populate them in bu-prod-auth or a join-flow BU).
- Surfacing pending join requests (`joinedVia: 'request_approved'` workflow).

### Acceptance

- [ ] `/data/group-membership` lists rows, paginated, filterable by group/user/role.
- [ ] `/data/group-membership/new` creates a membership; idempotent on (user, group) collision.
- [ ] `/data/group-membership/<id>/edit` allows changing role; doesn't allow editing joinedAt or joinedVia.
- [ ] `/data/group-membership/<id>` shows the row plus the linked user and group.
- [ ] Soft-delete works; restore works.
- [ ] Audit log entries appear at `/data/audit-log` for each action.
- [ ] Non-sysadmin redirected away.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] `package.json` PATCH bumped.

### Estimate

Half a day. Low complexity — extends an existing registry pattern; no new components, no schema migration, no novel UX.

---

## Status

Ready.
