# `components/admin/` — generic admin scaffolding components

UI for the generic admin CRUD engine (BU-admin-crud). One component
family handles every entity declared in `server/admin/entity-metadata.ts`
and registered in `server/services/admin/registry.ts`.

**Build Unit:** BU-admin-crud
**Spec:** `docs/architecture/admin-surface.md`,
`docs/build/session-briefs/bu-admin-crud.md`

---

## Files

| File                       | Type   | Role                                                              |
| -------------------------- | ------ | ----------------------------------------------------------------- |
| `EntityListPage.tsx`       | server | Table view of all rows for an entity, with search + "New" button  |
| `EntityDetailPage.tsx`     | server | Field-list view of a single row, with Edit / Delete / Restore     |
| `EntityForm.tsx`           | client | Create / update form; renders fields from `FormFieldDescriptor[]` |
| `RowMutationButton.tsx`    | client | Confirmation-protected button for soft / restore / hard delete    |
| `fields/TextField.tsx`     | client | Text input or textarea (multiline flag)                           |
| `fields/EnumField.tsx`     | client | Select dropdown                                                   |
| `fields/BooleanField.tsx`  | client | Checkbox                                                          |
| `fields/RelationField.tsx` | client | FK as UUID input (searchable variant is a follow-up)              |
| `fields/NumberField.tsx`   | client | Numeric input                                                     |

---

## Conventions

- Every interactive element carries a `data-testid` starting with
  `admin-` (per F14).
- All colour, spacing, radius, font values come from
  `styles/tokens.css` (per F15).
- The components are entity-agnostic — entity-specific logic lives
  in `server/services/admin/registry.ts` and is reached via the
  `admin.*` tRPC procedures.
- Server-side role gating happens in the procedure middleware
  (`requireRoleForEntity`); the components additionally hide
  mutation affordances client-side based on `ctx.activeRoles` so the
  UI stays honest for users who can't edit.

---

## What this layer does NOT do

- **Bulk operations** — checkboxes per row + bulk action menu are
  follow-ups (BU-admin-bulk-ops).
- **Filtering beyond search** — no per-column filters, date ranges,
  or facets in MVP.
- **Pagination** — list page renders up to 50 rows and stops; cursor
  pagination lands when needed.
- **Inline editing** — every edit goes through `/data/[entity]/[id]/edit`.
- **Custom per-entity field renderers** — when one is genuinely
  needed, extend the registry with a custom render shape; do not
  fork EntityForm.
