# `server/admin/entity-metadata.ts` — operating notes

The metadata map declares per-entity configuration that the generic admin
scaffolding (BU-001) reads to render list views, detail views, forms, search,
sorting, bulk actions, and role gating — without per-entity code.

It is **convention 6** from `docs/architecture/admin-surface.md`. Adding an
entry here is mandatory for every model in `prisma/schema.prisma`.

For visual context, read [`docs/architecture/erd.md`](../../docs/architecture/erd.md).

---

## What's in scope

```typescript
interface EntityMetadataEntry {
  displayField: string; // Field shown as the row's identifier
  displayTemplate?: string; // Composed identifier for join-tables / audit rows
  listColumns: string[]; // Columns in admin list view (in order)
  searchableFields?: string[]; // Fields searched by the list view's search box
  defaultSort?: SortSpec; // Default sort
  bulkActions?: string[]; // Bulk-action procedure names
  requiresRole: { view; edit }; // Role gating
  workflow: 'queue' | null; // 'queue' renders under /queue, null under /admin
  softDelete: boolean; // Whether the model has deletedAt
  notes?: string; // Free-text note shown in the admin header
}
```

The full type lives in [`entity-metadata.ts`](./entity-metadata.ts).

---

## Slice convention

The map extends one slice at a time, mirroring `prisma/schema.prisma`:

| Slice | Status    | Entries                                                                                                    |
| ----- | --------- | ---------------------------------------------------------------------------------------------------------- |
| **1** | ✅ landed | user, region, userRegion, workItem, roleGrant, coordinatorProfile, coordinatorGroup, auditLog, featureFlag |
| 1.5   | planned   | group, groupMembership                                                                                     |
| 2     | planned   | post, comment, reaction, attachment                                                                        |
| 3     | planned   | application, flag, outcomeReview, editRequest, contentSubmission, vouch                                    |
| 4     | planned   | contact, resource, route, dispatchEvent, partnerOrg                                                        |

Rules:

1. **One entry per Prisma model.** No more, no fewer. **Enforced by**
   `tests/unit/schema-metadata-coverage.test.ts` (B14): the test reads
   Prisma's DMMF model list and diffs against `Object.keys(entityMetadata)`
   in both directions. Models in flight (schema landed, metadata not yet)
   sit on an explicit allow-list at the top of that test file; each line
   names the BU that added the schema and is a TODO until metadata lands.
2. **Keys are URL segments.** `entityMetadata.user` becomes `/admin/user`.
   Renaming a key breaks the admin URL — treat as a breaking change with
   redirect handling.
3. **Append, don't reorder.** The file is read top-to-bottom; reordering keys
   doesn't change behaviour, but new entries should land at the bottom of
   their slice section so diffs stay legible.

---

## How a future slice extends this map

When a future Build Unit adds entities:

1. **Add the model to `prisma/schema.prisma`** (under the new slice's
   divider).
2. **Add an entry here** with all required fields. The `EntityMetadataEntry`
   type guides the shape — TypeScript will fail the build if a required
   field is missing.
3. **Pick the right `requiresRole`.** Default to the most restrictive that
   makes sense:
   - `queue_manager` for entities that queue managers act on (work items,
     posts, comments, reports)
   - `admin` for entities only admins should touch (role grants, feature
     flags, system config)
4. **Choose `workflow`:** `'queue'` only for entities that render under
   `/queue` (currently just `workItem`). Everything else is `null` (renders
   under `/admin`).
5. **Use `displayTemplate` for join tables and audit rows.** When the entity
   has no single human-readable field, compose one from related fields. The
   template syntax is brace-substitution: `{user.displayName} — {region.slug}`.
6. **Use `notes` to surface code-level invariants.** Anything that lives in
   router middleware and isn't visible from the schema (e.g. "immutable —
   no update procedures") belongs here so the admin user sees it.

---

## What the generic admin does with this

`<EntityListPage entity="user" />`:

- Fetches `user` rows via `trpc.admin.list({ entity: 'user', ... })` — the
  router uses the metadata to build the query.
- Renders columns specified in `listColumns`. Dotted paths (`user.displayName`)
  resolve to relations via the metadata.
- Adds a search input over `searchableFields`.
- Defaults sort per `defaultSort`.
- Shows the bulk-action menu populated from `bulkActions`.
- Gates the page on `requiresRole.view`.

`<EntityDetailPage entity="user" id={id} />`:

- Fetches the row.
- Renders fields with type-aware components (`<EnumField>`, `<RelationField>`,
  `<JsonField>`, etc.).
- Edit button gated on `requiresRole.edit`.

`<EntityForm entity="user" />`:

- Reads the same Zod schema the create/update tRPC procedures declare (per
  `docs/process/api-contract-discipline.md` rule 6).
- Validates client-side before submission, server validates again on
  arrival.

None of this is implemented yet — that's BU-001. Slice 1's job is to provide
the schema and metadata so BU-001 has something to read.

---

## What this file does NOT do

- **Define columns.** That's the schema (`prisma/schema.prisma`).
- **Define validation rules.** That's the Zod schemas in `server/routers/`.
- **Define authorisation logic.** That's tRPC middleware (`requireRole`); the
  metadata only declares the _required role_.
- **Define UI components.** That's `components/admin/*` (BU-001).
- **Define audit-log behaviour.** That's the audit middleware that wraps all
  admin mutations.
