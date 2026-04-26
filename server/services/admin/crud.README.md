# `server/services/admin/` — generic admin CRUD engine

The engine that lights up `/data/[entity]` for every Prisma model declared in
`server/admin/entity-metadata.ts` — without any per-entity UI code.

**Build Unit:** BU-admin-crud
**Spec:** `docs/architecture/admin-surface.md`,
`docs/build/session-briefs/bu-admin-crud.md`

---

## Files

| File          | Role                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| `types.ts`    | Shared types: `FormFieldDescriptor`, `AdminRow`, `AdminListResult`, etc.                 |
| `include.ts`  | Helpers: dotted-path → Prisma `include` plan; row flattening to `AdminRow`               |
| `registry.ts` | Per-entity handlers — list / get / create / update / softDelete / restore (typed prisma) |
| `crud.ts`     | Thin facade the router calls; dispatches to the registry                                 |
| `auth.ts`     | `requireRoleForEntity(ctx, entity, action)` — metadata-driven role gate                  |

The router (`server/routers/admin.ts`) only knows about `crud.ts`. Layer
boundaries: services may import from `db`, `lib`, `shared`, and other
services — never from routers or app.

---

## Slice 1 entities

Per Q1 (locked 2026-04-26):

- `user` — soft-delete, full CRUD
- `post` — soft-delete, full CRUD
- `region` — soft-delete, full CRUD
- `group` — soft-delete, full CRUD
- `roleGrant` — list/get/create only (revocation is a future BU-admin-roles flow)
- `featureFlag` — soft-delete, full CRUD
- `auditLog` — list/get only (immutable per B07; "immutable" expressed by absence)

Future slices add `userRegion`, `coordinatorProfile`, `coordinatorGroup`,
`groupMembership`, and any new entities. The `request` entity has
`workflow: 'queue'` and never lands here — `/data/request` redirects to
`/requests` (per Q4).

---

## Adding a new entity

1. Add the model to `prisma/schema.prisma`.
2. Add an entry to `server/admin/entity-metadata.ts`.
3. Add an entry to `registry.ts`:
   - Declare per-entity `zodCreate` / `zodUpdate` schemas (or omit to
     mark immutable).
   - Declare `formFields` for the create + update forms.
   - Wire `list` / `get` / `create` / `update` / `softDelete` / `restore`
     to the typed `prisma.<model>` delegate.
4. Add the entity key to `ADMIN_ENTITY_KEYS` in
   `shared/validation/admin.ts`. The registry test asserts both lists agree.

---

## Auth model

Per Q3 (locked): flat role check via `requireRoleForEntity`. No D055
scope filtering. The `/data` surface honours `requiresRole.view` for
`list`/`get` and `requiresRole.edit` for `create`/`update`/`delete`.

Future scope-aware filtering tracked as **B13** in
`docs/build/engineering-roadmap.md`. Triggered when a second entity
gains type-scoped grants.

---

## What this engine does NOT do

- **Bulk operations.** `bulkActions` from metadata renders no UI yet.
  Follow-up: BU-admin-bulk-ops.
- **CSV import / export.** Follow-up.
- **Audit-log integration.** Mutations don't currently write
  `AuditLog` entries. Follow-up: BU-admin-audit-integration.
- **Concurrent-edit detection.** Last write wins.
- **Many-to-many relation editing.** Only scalar FKs.
- **Per-column filtering / faceted search.** Search box only.
- **Pagination.** Default `take: 50`. Cursor pagination lands when row
  counts grow.
- **JSON field editing.** `Request.context` (and similar) is read-only.
- **Custom per-entity field renderers.** Not yet needed.

See the brief's "Out of scope" section for the full deferred list.
