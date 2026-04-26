# `app/data/` — admin data surface

The admin surface for inspecting and editing every Prisma entity in
`server/admin/entity-metadata.ts`. Reached at `/data` when logged in
as an admin or queue-manager.

**Build Unit:** BU-admin-crud
**Spec:** `docs/architecture/admin-surface.md`,
`docs/build/session-briefs/bu-admin-crud.md`

---

## Routes

| Route                      | What it does                                             |
| -------------------------- | -------------------------------------------------------- |
| `/data`                    | Index of all entities the caller can view                |
| `/data/[entity]`           | List of rows for one entity (search, sort, "New" button) |
| `/data/[entity]/new`       | Create-row form                                          |
| `/data/[entity]/[id]`      | Single-row detail view (Edit / Delete / Restore)         |
| `/data/[entity]/[id]/edit` | Edit-row form (current values pre-filled)                |

`workflow: 'queue'` entities (currently just `request`) redirect from
`/data/[entity]` to `/requests` per Q4 (locked 2026-04-26). They never
render the generic CRUD surface.

---

## Auth

- Unauthed → redirected to `/dev/login?returnTo=/data/...`
- Authed but insufficient role → 404 (indistinguishable from "no such
  entity"). Server-side gate via `requireRoleForEntity`; the procedure
  middleware enforces the same check at the API boundary.
- Mutation actions (`adminCreateAction` / `adminUpdateAction` /
  `adminDeleteAction`) revalidate auth on each call.

---

## How it works

1. The page reads `params.entity` and `searchParams.search`.
2. It calls `entityMetadata[entity]` to confirm the entity exists and
   to get its display config (columns, sort, role, soft-delete flag).
3. The list page renders `<EntityListPage>` (server component) which
   internally calls `listEntity()` from the admin service.
4. The detail page renders `<EntityDetailPage>` which calls
   `getEntityRaw()` for the full row.
5. The new/edit pages render `<EntityForm>` (client) with descriptors
   pulled from `getRegistryEntry(entity).formFields`. Submission goes
   to a server action (`adminCreateAction` / `adminUpdateAction`)
   which calls the same tRPC procedures the test suite hits.

The components are entity-agnostic. Adding a new entity to the admin
surface is two file edits: `entityMetadata` + `registry`. No new
routes, no new components.

---

## What's NOT here

- **Bulk operations** — checkboxes per row + bulk actions are a
  follow-up (BU-admin-bulk-ops).
- **CSV import/export** — follow-up.
- **Audit-log integration on mutations** — follow-up
  (BU-admin-audit-integration).
- **Pagination beyond `take: 50`** — cursor pagination lands when
  needed.
- **Per-column filtering** — search box only.
- **Concurrent-edit detection** — last write wins.

See `docs/build/session-briefs/bu-admin-crud.md` for the full
deferred list.
