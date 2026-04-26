# SESSION BRIEF · BU-admin-crud — Generic CRUD UI for `/data/[entity]`

_Brief version: 1.0 · Author: Paul + Claude · Date: 2026-04-26_
_Priority: post-foundation. Direct successor to BU-requests-foundation
(PR #74) which shipped `/data` + `/data/[entity]` as metadata-only
stubs. This BU lights up real CRUD against those routes._
_Pairs with: `server/admin/entity-metadata.ts` (the contract this BU
consumes), D051 (BU naming), D040/D054 (Request entity), D045 (Post
visibility), D055 (per-type scopes — see Open Question 3)._

---

## Objective

Render list / detail / create / edit / delete screens for every Prisma
entity declared in `server/admin/entity-metadata.ts` — without any
per-entity code. One generic component family
(`<EntityListPage>` / `<EntityDetailPage>` / `<EntityForm>`) backed by
five generic tRPC procedures (`admin.list` / `admin.get` /
`admin.create` / `admin.update` / `admin.delete`) reads the metadata
contract and produces a working data-management surface for queue
managers and admins. Success: an admin lands on `/data/user`, sees the
ten seeded users, opens one, edits the display name, saves, and the
change is reflected on the list — and the same flow round-trips on
`/data/post` without a single line of post-specific code.

---

## Scope

### Build in this session

**Generic admin tRPC router (the engine):**

- `server/routers/admin.ts` (new) — five procedures: `list`, `get`,
  `create`, `update`, `delete`. All five accept `{ entity: EntityKey,
  ... }` and dispatch to a shared service.
- `server/routers/_app.ts` (MODIFY — register `admin` router beneath
  the existing `post` / `reaction` / `comment` entries; preserve order
  of existing entries.)

**Generic admin service:**

- `server/services/admin/crud.ts` (new) — `listEntity`,
  `getEntity`, `createEntity`, `updateEntity`, `softDeleteEntity` (and
  for entities with `softDelete: false`, `hardDeleteEntity`). Routes
  the entity key to the right `prisma.<model>` delegate via a runtime
  registry.
- `server/services/admin/registry.ts` (new) — the runtime registry
  that maps `EntityKey` → `{ delegate, zodInputCreate,
  zodInputUpdate, includes }`. The shape is type-driven (not the
  metadata file). One entry per entity. Forms read the same Zod
  schemas declared here.
- `server/services/admin/crud.README.md` (new) — explains the
  contract, the registry pattern, how to add an entity.

**Validation:**

- `shared/validation/admin.ts` (new) — Zod schemas for each of the
  five generic procedure inputs. The entity-specific create/update
  schemas live in the registry (above), not here, so this file stays
  small.

**Generic UI components:**

- `components/admin/EntityListPage.tsx` (new) — server component;
  reads `listColumns` / `defaultSort` / `searchableFields` /
  `bulkActions` from metadata; renders table; resolves dotted-path
  columns (e.g. `author.displayName`) at the service include layer.
- `components/admin/EntityDetailPage.tsx` (new) — server component;
  renders all fields with type-aware sub-components; "Edit" button
  gated on `requiresRole.edit`; "Delete" / "Restore" button when
  `softDelete` is true.
- `components/admin/EntityForm.tsx` (new) — client component; reads
  the Zod create / update schema from a thin client-safe registry
  shim and generates fields. Server validates again on submit.
- `components/admin/fields/EnumField.tsx` (new) — dropdown from
  Prisma enums (read via the Zod schema, not Prisma DMMF — keeps
  client bundle slim).
- `components/admin/fields/RelationField.tsx` (new) — searchable
  dropdown for FK fields. Calls `admin.list({ entity: 'user', ... })`
  for the relation target. MVP supports up to 50 results; no
  pagination on the dropdown.
- `components/admin/fields/JsonField.tsx` (new) — read-only
  pretty-printed JSON viewer for `context`-style payloads. Editing
  JSON is out of scope (see Deferred).
- `components/admin/fields/TextField.tsx` (new) — string input;
  textarea when the Zod schema declares `.max(N)` with N > 200.
- `components/admin/fields/BooleanField.tsx` (new) — checkbox.
- `components/admin/fields/DateField.tsx` (new) — read-only display
  on detail; not editable in MVP (see Open Question 7).

**Routes (the new pages — `/data/[entity]/...`):**

- `app/data/[entity]/page.tsx` (REWRITE — replace today's
  metadata-display stub with `<EntityListPage entity={...} />`. The
  metadata-display affordance moves into a small "schema" disclosure
  panel inside the list page header; do NOT delete it.)
- `app/data/[entity]/new/page.tsx` (new) — server component;
  `<EntityForm mode="create" entity={...} />`.
- `app/data/[entity]/[id]/page.tsx` (new) — server component;
  `<EntityDetailPage entity={...} id={id} />`.
- `app/data/[entity]/[id]/edit/page.tsx` (new) — server component;
  `<EntityForm mode="update" entity={...} id={id} />`.

**Tests:**

- `tests/integration/admin-crud-user.test.ts` (new, 6+ cases) —
  round-trip CRUD on User: list, get, create, update, soft-delete,
  restore. Visibility / role gating asserted.
- `tests/integration/admin-crud-post.test.ts` (new, 6+ cases) —
  round-trip CRUD on Post (with the visibility enum). Confirms the
  generic engine handles a second entity end-to-end.
- `tests/integration/admin-auth.test.ts` (new, 5+ cases) —
  `UNAUTHORIZED` for unauthed; `FORBIDDEN` for plain members on
  `requiresRole.view: 'queue_manager'` entities; `FORBIDDEN` for
  queue_managers on `requiresRole.edit: 'admin'` entities;
  `auditLog` is admin-only.
- `tests/unit/admin-registry.test.ts` (new, 4+ cases) — every
  `EntityKey` in metadata has a registry entry; immutable entities
  (auditLog) reject create / update / delete; soft-delete-only
  entities reject `hardDelete`; dotted-path includes resolve.

**READMEs:**

- `app/data/README.md` (MODIFY) — extend with the new sub-routes;
  preserve existing content.
- `components/admin/README.md` (new) — purpose, contract, how to
  extend.
- `server/services/admin/crud.README.md` (new — already listed)
- `server/routers/README.md` (MODIFY if it exists; otherwise skip) —
  one-line note about the `admin` router.

**F14 / testid taxonomy:**

- `eslint-rules/canonical-areas.json` already contains `admin` —
  no change needed. All new testids use the `admin-` prefix per
  F14.
- `docs/process/testid-convention.md` — no change (the `admin`
  area row is already present).

### Do NOT touch

- `server/admin/entity-metadata.ts` — the contract is read,
  not written. If an entity is missing a field this BU needs (e.g.
  per-field form metadata), surface in Open Questions; do NOT
  silently extend the contract.
- `prisma/schema.prisma` — no schema changes. If any entity needs a
  schema tweak to be CRUD-friendly, surface it; don't quietly add
  columns.
- Member-facing code: `app/feed/`, `app/compose/`, `app/post/`,
  `app/share/`, `app/requests/`, `app/settings/`, `components/`
  outside `components/admin/`, the existing post / reaction /
  comment / request routers.
- The existing F-rules and ESLint config — no new rules, no waiver
  edits.
- `prisma/migrations/` — no migrations.
- `docs/feature-spec/v0.5.docx` — frozen.
- `docs/architecture/admin-surface.md` — the architectural doc
  this BU implements; no edits required (it already describes
  exactly this design).
- The BU-requests-foundation `/data/[entity]/page.tsx` content
  beyond the list-page rewrite — keep the "Back to data" link, the
  `<AppNav active="data" />` placement, and the metadata disclosure.

### Out of scope for this session (deferred to follow-ups)

- **Bulk operations.** `bulkActions` declared in metadata
  (`softDelete`, `restore`, `forceRelease`) render no UI; bulk
  procedures are a follow-up. Reason: row checkboxes + selection
  state + per-action confirmation flow is its own ~half-session.
- **CSV import / CSV export.** Useful for ops but a separate
  feature surface (file upload, schema mapping, dry-run preview).
- **Audit-log integration.** Mutations from the generic procedures
  will eventually write `AuditLog` rows with
  `action: 'admin.<entity>.<verb>'`. The audit writer exists
  (`server/services/audit.ts`); wiring it into the generic engine
  is a follow-up so we can land the CRUD round-trip first and add
  audit in a focused PR. Document in PR description.
- **Soft-delete restoration UI.** A "Restore" button on the detail
  page is in scope (single-row). A bulk restore queue and a
  "deleted rows" list filter are deferred.
- **JSON field editing.** `Request.context` is read-only in MVP.
- **Relation field write semantics for collections.** Many-to-many
  edits (e.g. `User.regions`) are deferred; only scalar FK fields
  are editable.
- **Realtime / cross-tab updates.** A change made in one tab
  doesn't appear in another until refresh.
- **Pagination on list pages.** Take 50, no cursor. Reason: the
  Slice 1 entity row counts are tiny; pagination lands when it
  matters (probably alongside `request` having more rows).
- **Filtering UI beyond search.** No per-column filter chips, no
  date-range pickers, no enum facets — search box only.
- **Concurrent-edit detection.** No `If-Match` / `updatedAt`
  optimistic-concurrency check. Last write wins. Surface in PR
  description.
- **Custom per-entity overrides.** No "this entity needs a special
  field renderer" escape hatch yet. If we need one, it's a
  follow-up that extends the registry. The BU is "everything
  generic, nothing special" by design.
- **`/queue` workflow surface.** `entityMetadata.request.workflow
  === 'queue'` means it doesn't render under `/data/[entity]` —
  that's the queue tab's territory (BU-requests-urgent). This BU
  skips entities where `workflow === 'queue'`.

---

## Contracts

### Inputs consumed

- `entityMetadata` from `server/admin/entity-metadata.ts` — read
  at the boundary of every generic procedure to resolve
  `displayField`, `listColumns`, `searchableFields`,
  `defaultSort`, `requiresRole`, `softDelete`. Treated as a
  read-only contract.
- `prisma` client — every Prisma model delegate is reached through
  a runtime registry that exposes a typed handle.
- `requireRole` from `server/lib/trpc.ts` — gates each procedure
  per the metadata's `requiresRole.view` (for `list` / `get`) or
  `requiresRole.edit` (for `create` / `update` / `delete`).
- `ctx.activeRoles` and `ctx.activeScopes` from
  `server/routers/context.ts`.
- `auditLog` (existing) — NOT called in MVP; deferred.

### Outputs produced

**tRPC procedures (the contract — note: `admin.*` namespace is
new; existing `post.*`, `reaction.*`, `comment.*` unchanged):**

```ts
admin.list:
  authedProcedure
    .input(z.object({
      entity: z.enum([...EntityKeys]),
      search: z.string().optional(),
      sort: z.string().optional(),
      take: z.number().min(1).max(100).default(50),
    }))
    .query: returns { rows: AdminRow[]; total: number }

admin.get:
  authedProcedure
    .input(z.object({
      entity: z.enum([...EntityKeys]),
      id: z.string().uuid(),
    }))
    .query: returns AdminRow

admin.create:
  authedProcedure
    .input(z.object({
      entity: z.enum([...EntityKeys]),
      data: z.record(z.string(), z.unknown()),
    }))
    .mutation: returns { id: string }
    // server narrows `data` against the per-entity Zod create schema
    // declared in the registry; rejects on shape mismatch.

admin.update:
  authedProcedure
    .input(z.object({
      entity: z.enum([...EntityKeys]),
      id: z.string().uuid(),
      data: z.record(z.string(), z.unknown()),
    }))
    .mutation: returns { id: string }

admin.delete:
  authedProcedure
    .input(z.object({
      entity: z.enum([...EntityKeys]),
      id: z.string().uuid(),
      mode: z.enum(['soft', 'restore', 'hard']).default('soft'),
    }))
    .mutation: returns { id: string }
    // 'soft' / 'restore' allowed only when metadata.softDelete=true
    // 'hard' allowed only on entities with softDelete=false
```

`AdminRow` is `{ id: string; [columnPath: string]: unknown }` — a
flat shape where dotted-path columns from `listColumns` are
pre-resolved at the service layer. Detail pages get the full Prisma
row shape.

**Component contract:**

```ts
<EntityListPage entity="user" />
<EntityDetailPage entity="user" id="..." />
<EntityForm mode="create" entity="user" />
<EntityForm mode="update" entity="user" id="..." />
```

All four read metadata + registry; no entity-specific props.

---

## Acceptance criteria

### Functional (round-trip CRUD on User and Post)

- [ ] Visiting `/data/user` as an admin renders a table with the
      columns declared in `entityMetadata.user.listColumns`
      (`displayName`, `email`, `verifiedAt`, `lastSeenAt`,
      `createdAt`).
- [ ] Sort defaults to `createdAt: 'desc'` per metadata.
- [ ] Search box filters rows by `displayName` or `email`
      (case-insensitive `contains`).
- [ ] Tapping a row opens `/data/user/[id]` showing every column
      on the User model.
- [ ] Tapping "Edit" opens `/data/user/[id]/edit`; submitting a
      changed `displayName` saves, redirects back to detail, the
      new value renders.
- [ ] Tapping "New" on the list page opens `/data/user/new`;
      submitting a valid form creates a row, redirects to the new
      detail page.
- [ ] Tapping "Delete" on the detail page soft-deletes (sets
      `deletedAt`); the row no longer appears on the default list;
      the detail page renders a "Restore" button instead.
- [ ] Tapping "Restore" clears `deletedAt`; the row reappears on
      the list.
- [ ] Same flows round-trip on `/data/post` without any
      post-specific code (the only change is metadata + registry
      entries).

### Auth (gating)

- [ ] Unauthed → redirected to `/dev/login?returnTo=/data/...`
      (existing behaviour preserved).
- [ ] Plain member visiting `/data/user` → not-found (per
      `requiresRole.view: 'queue_manager'`).
- [ ] Queue-manager visiting `/data/featureFlag` → not-found
      (per `requiresRole.view: 'admin'`).
- [ ] Queue-manager visiting `/data/user` (view) succeeds; tapping
      "Edit" → 403 / disabled (per
      `requiresRole.edit: 'admin'`).
- [ ] All gates enforced server-side in the procedure middleware,
      not just at the route level.

### Honest empty / error states

- [ ] Empty list (no rows) renders "No rows yet" with a "Create
      one" link gated on `requiresRole.edit`.
- [ ] Detail page on a not-found id → 404 (not 500).
- [ ] Detail page on a soft-deleted id → renders the row with a
      "Deleted on YYYY-MM-DD" banner and "Restore" button (per the
      existing soft-delete-respecting pattern); does not 404.
- [ ] Form submission with invalid data → inline field errors
      (Zod messages); no toast, no redirect.
- [ ] Server error during mutation → inline banner above the
      form, "Could not save — try again." Form state preserved.

### F14 (testid) and F15 (design tokens)

- [ ] Every interactive element has a `data-testid` starting with
      `admin-`. Examples: `admin-list-table`, `admin-list-search`,
      `admin-list-row`, `admin-detail-edit-button`,
      `admin-form-field-{fieldName}`, `admin-form-submit`,
      `admin-form-cancel`, `admin-detail-delete-button`,
      `admin-detail-restore-button`.
- [ ] No hardcoded colours. All colour values via
      `var(--colour-...)` tokens. No hex, no `rgb(...)`, no
      `#hex` literals (per F15).
- [ ] No hardcoded spacing. Use `var(--space-N)`.

### Mechanical

- [ ] `npm run typecheck` clean — zero `any`, zero `@ts-ignore`.
- [ ] `npm run lint` clean.
- [ ] `npm test` all passing.
- [ ] `npx prettier --check .` clean.
- [ ] `npm run trace:check` clean (D038).
- [ ] Every new file carries `@build-unit BU-admin-crud` AND a
      meaningful `@spec` (per D038, D051, F06 rule 1, F13).
- [ ] Layer boundaries respected (services don't import from app;
      components don't import from server/services).

### Communication

- [ ] PR description summarises what's now possible
      (admin / queue-manager round-trip CRUD on every metadata
      entity), links this brief, lists the open questions Paul
      surfaced.
- [ ] Commit message: `feat(admin-crud): BU-admin-crud — generic
      CRUD UI for admin /data routes`.
- [ ] Branch: `feat/bu-admin-crud` (per the `feat/<bu-name>`
      convention).

---

## Permission matrix

| Action               | Public | Member | Queue-manager (any scope) | Admin |
| -------------------- | ------ | ------ | ------------------------- | ----- |
| List / detail (view) | —      | —      | ✓ where `requiresRole.view` ≤ queue_manager | ✓ all |
| Create / edit        | —      | —      | ✓ where `requiresRole.edit` ≤ queue_manager (see Open Q3) | ✓ all |
| Soft-delete / restore| —      | —      | ✓ same gate as edit       | ✓ all |
| Hard-delete          | —      | —      | —                         | ✓ when `softDelete: false` only |
| AuditLog write       | —      | —      | —                         | —     |
| AuditLog view        | —      | —      | —                         | ✓     |

`requiresRole` lookups happen in the procedure middleware via
`requireRole(metadata[entity].requiresRole.view | .edit)`. No
inline `ctx.user.role` checks (F06 rule 4).

---

## UI states

### List page (`/data/[entity]`)

| State             | Trigger                  | What user sees                                                              |
| ----------------- | ------------------------ | --------------------------------------------------------------------------- |
| Loading           | First render             | Skeleton table with column headers from metadata                            |
| Populated         | Rows present             | Table; "New" button (gated); search box; metadata disclosure panel collapsed |
| Empty             | No rows                  | "No rows yet" + "Create one" link (gated)                                   |
| No view permission| Caller fails view gate   | 404 (existing pattern from the foundation route)                            |
| Server error      | Procedure threw          | "Could not load" banner + retry link                                        |

### Detail page (`/data/[entity]/[id]`)

| State             | Trigger                  | What user sees                                                              |
| ----------------- | ------------------------ | --------------------------------------------------------------------------- |
| Standard          | Row exists, not deleted  | Field list + Edit (gated) + Delete (gated)                                  |
| Soft-deleted      | `deletedAt != null`      | Field list + "Deleted YYYY-MM-DD" banner + Restore (gated)                  |
| Not found         | Bad id                   | 404                                                                         |
| Hard-delete only  | `softDelete: false`      | Field list + Delete (with extra-destructive confirmation dialog)            |

### Form page (`/data/[entity]/new` or `/data/[entity]/[id]/edit`)

| State             | Trigger                  | What user sees                                                              |
| ----------------- | ------------------------ | --------------------------------------------------------------------------- |
| Empty / pre-filled| First render             | Form with fields per Zod schema; create-mode empty, edit-mode pre-filled    |
| Validating        | Submit tapped            | Submit button shows "Saving…"; inputs disabled                              |
| Field-level error | Zod rejected one+ fields | Per-field message; first invalid input gets focus                           |
| Form-level error  | Server threw non-Zod     | Inline banner above the form; field state preserved                         |
| Saved             | Mutation succeeded       | Redirect to detail page with a one-shot "Saved" toast                       |

---

## Tests required

**Integration (round-trip CRUD on User):**

1. `admin.list({ entity: 'user' })` returns seeded users; sort
   defaults to `createdAt desc`.
2. `admin.list({ entity: 'user', search: 'eddie' })` returns the
   matching row.
3. `admin.get({ entity: 'user', id })` returns the full row.
4. `admin.create({ entity: 'user', data })` creates a row;
   returns `{ id }`.
5. `admin.update({ entity: 'user', id, data })` updates; the
   subsequent `get` reflects the change.
6. `admin.delete({ entity: 'user', id, mode: 'soft' })` sets
   `deletedAt`; subsequent default `list` excludes it.
7. `admin.delete({ entity: 'user', id, mode: 'restore' })`
   clears `deletedAt`.

**Integration (round-trip CRUD on Post):**

8–13. The same six flows on `/data/post` to prove genericity.

**Auth:**

14. Unauthed `admin.list` → `UNAUTHORIZED`.
15. Member `admin.list({ entity: 'user' })` → `FORBIDDEN`.
16. Queue-manager `admin.update({ entity: 'user', ... })` →
    `FORBIDDEN`.
17. Queue-manager `admin.list({ entity: 'auditLog' })` →
    `FORBIDDEN`.
18. Admin `admin.delete({ entity: 'auditLog', ... })` →
    `FORBIDDEN` (immutable per `notes`).

**Registry:**

19. Every `EntityKey` in `entityMetadata` has a registry entry
    (CI guard).
20. Hard-delete on `softDelete: true` entity → `BAD_REQUEST`.
21. Soft-delete on `softDelete: false` entity → `BAD_REQUEST`.
22. Dotted-path column `author.displayName` resolves on Post
    list.

**Manual click-through:**

23. Log in as Bette (admin) → `/data/user` → edit Eddie's
    `displayName` → save → list reflects.
24. Log in as Bette → `/data/post/[id]` → soft-delete a seeded
    post → confirm it leaves the default list and the seeded feed
    no longer shows it.
25. Log in as a queue-manager → `/data/featureFlag` → 404.

**Not required:**

- E2E with Playwright (not in stack).
- Performance benchmarks.
- Visual-regression.
- Bulk operations (deferred).

---

## Scenarios to verify against

There are no canonical SCN-N scenarios for the admin surface — the
admin surface is a power-user tool, not a member journey. Verify
against the architectural doc instead:

- `docs/architecture/admin-surface.md` — every section in "The
  generic admin scaffolding" must be honoured. Routes match, six
  conventions respected, role gates at all three layers.
- `docs/build/session-briefs/bu-comments.md` and `bu-feed.md` —
  read for pattern: how a generic surface is briefed, how
  acceptance criteria are written.

---

## Known gotchas

- **Member-facing route at `/data`, not `/admin`.** The admin
  surface canonically lives at `/data` per the
  BU-requests-foundation rename. The architectural doc
  (`admin-surface.md`) still says `/admin/[entity]`; treat that as
  legacy phrasing and use `/data/[entity]`. If this feels wrong,
  surface in Open Questions — don't quietly rename routes.
- **`workflow: 'queue'` entities skip `/data`.** The
  `request` entity has `workflow: 'queue'`. The list page for
  `request` should redirect to `/requests` (or 404, depending on
  Open Question 4) rather than render a generic table — Requests
  have their own queue UI under BU-requests-urgent.
- **`auditLog` is read-only.** Metadata `notes` says "Immutable
  — routers must not expose update or delete procedures." The
  generic engine must check this and reject create / update /
  delete with `BAD_REQUEST`. Discoverable via a `notes` substring
  match is brittle — a better signal is needed (Open Question 6).
- **Dotted-path includes.** `listColumns: ['user.displayName']`
  means the service must add `include: { user: { select: {
  displayName: true } } }`. The registry declares the include
  shape per entity to avoid runtime path parsing.
- **Form generation.** Three plausible approaches; pick one
  (Open Question 2). Whichever is chosen, the same Zod schema
  validates client-side before submit AND server-side at the
  procedure boundary — never duplicate validation rules.
- **`createdAt` / `updatedAt` are read-only.** Forms must omit
  these from create/update. Detail pages render them.
- **Relation fields in create.** Picking an `authorId` for a new
  Post means searching the User entity. Only support scalar FKs
  in MVP — not relation arrays. Many-to-many editing is deferred.
- **Soft-delete UX.** "Delete" copy is intentionally honest
  ("Soft-delete — recoverable") for entities with
  `softDelete: true`. Hard-delete entities use a stronger
  confirmation ("Cannot be undone").
- **`displayTemplate` rendering.** Entities like `userRegion`,
  `auditLog`, `roleGrant`, `groupMembership` have a
  `displayTemplate` (e.g. `{user.displayName} — {region.slug}`).
  The list/detail pages render this as the row's identifier;
  `displayField` becomes the fallback when template substitution
  fails.
- **Concurrent edits.** Last write wins. No `If-Match`. Surface
  in PR notes; don't try to solve this BU.
- **The metadata file must not be modified.** If something in
  metadata is wrong (e.g. a missing field for
  `groupMembership`), surface as an Open Question — don't quietly
  edit the contract. Future BU: extend metadata once we know what
  the engine needs.
- **F15 token coverage.** Forms need form-control colours
  (border, focus, error). If `styles/tokens.css` is missing a
  needed token, surface — don't hardcode. (This is the most
  likely place to hit F15 friction.)

---

## Definition of done (per `working-rhythm.md` §3)

### Functional

- [ ] Every acceptance criterion ticks (round-trip CRUD on User
      AND Post; gating; honest states).
- [ ] Manual click-through completed: User CRUD; Post CRUD;
      one negative gate (queue-manager → featureFlag → 404).
- [ ] Open questions either resolved or surfaced explicitly in
      the PR description.

### Mechanical

- [ ] `npm run typecheck` clean — zero errors, zero `any`,
      zero `@ts-ignore`.
- [ ] `npm run lint` clean.
- [ ] `npm run test` all passing.
- [ ] `npx prettier --check .` clean.
- [ ] `npm run trace:check` clean.

### Discipline

- [ ] Every new file has `@build-unit BU-admin-crud` AND a
      meaningful `@spec` (D038 / D051 / F06 rule 1 / F13).
- [ ] Every interactive UI element has a
      `data-testid` (F14) starting with `admin-`.
- [ ] No design-token violations (F15).
- [ ] No PII in any log line touched by this BU (F06 rule 3).
- [ ] Layer boundaries respected: services hold all Prisma
      access; routers orchestrate; components import from
      `/components` or `/shared` only.
- [ ] No schema changes (no migrations committed).

### Communication

- [ ] PR description: summary, links this brief, lists open
      questions surfaced, names what's deferred.
- [ ] Commit message follows convention.
- [ ] Branch follows convention.
- [ ] Any new directories carry a `README.md` explaining
      purpose, contracts, and known issues.

---

## File-header convention (D038 / D051)

Every new file starts with the JSDoc block:

```ts
/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * <one-paragraph description of what this file does>
 */
```

Per D051, the `@build-unit` value is the semantic name
`BU-admin-crud` — not a number. F06 rule 1 enforces presence; F13
enforces a non-trivial `@spec`.

---

## Decisions confirmed before build (Paul, 2026-04-26)

These lock the eight Open Questions below. The build session executes
against them.

1. **Slice 1 entities — option (c).** Ship CRUD for the
   seven-entity operational set: `user`, `post`, `region`,
   `group`, `roleGrant`, `featureFlag`, `auditLog` (read-only).
   The remaining metadata entities (`userRegion`,
   `coordinatorProfile`, `coordinatorGroup`, `groupMembership`,
   `request`) are **not in scope** this BU; their registry
   entries land in follow-ups. (`request` redirects per #4.)
2. **Form-generation approach — registry-Zod.** Per-entity Zod
   create/update schemas live in
   `server/services/admin/registry.ts`. The same schema validates
   both client-side (in `<EntityForm>`) and server-side (at the
   procedure boundary). No DMMF introspection. No metadata-file
   edits.
3. **Auth on `/data` — flat for this BU.** `requireRole(role)`
   only; no D055 scope filtering. Logged as **B13** in
   `docs/build/engineering-roadmap.md` for follow-up. The privacy
   concern is mitigated by #4 (only `request` has scopes today,
   and `/data/request` redirects to `/requests`).
4. **`/data/request` redirects to `/requests`** (the queue
   workflow surface). Queue entities — anything with
   `workflow: 'queue'` in metadata — never render a generic
   list. Server-side redirect, not a 404, so the discovery flow
   from the `/data` index still works.
5. **Hard-delete UI — typed-confirmation modal.** "Type DELETE
   to confirm" pattern. Soft-delete uses a standard
   "Are you sure?" dialog with the honest "Soft-delete —
   recoverable" copy.
6. **"Immutable" lives in the registry, not the metadata.**
   Encoded by absence: an entity registered without
   `zodInputCreate` / `zodInputUpdate` / delete-mode rejects
   those procedures with `BAD_REQUEST`. Logged as a future
   metadata addition once a second immutable entity exists.
7. **Datetime fields — read-only by default.** Forms omit them.
   The registry's update Zod schema can opt in case-by-case
   (e.g. `RoleGrant.revokedAt` for the revocation flow when
   that BU lands).
8. **List-page take limit — 50, no pagination.** Cursor
   pagination lands when `request` count grows; not this BU.

---

## Open questions to surface to Paul

(Originally pinned for review. All resolved above; preserved here
as the trail of recommendations + rationale.)

### 1. Which entities ship in slice 1?

`entityMetadata` declares **twelve** entities today:

`user`, `region`, `userRegion`, `request` (workflow: queue),
`roleGrant`, `coordinatorProfile`, `coordinatorGroup`,
`auditLog` (immutable), `featureFlag`, `group`, `groupMembership`,
`post`.

Three plausible cuts:

- **(a) Everything except `request`.** Eleven entities. Forces
  the engine to handle every shape we know about (immutable
  entity, soft-delete, hard-delete, dotted-path joins, enums,
  display templates). Highest confidence the contract is correct.
- **(b) User + Post only.** Two entities. Smallest possible
  slice; proves the engine works; metadata-driven so adding the
  rest is "register the entity in the registry, no UI work."
  Risk: the rest may surface a contract gap that we don't see.
- **(c) Plus the foundation set: User, Post, Region, Group,
  RoleGrant, FeatureFlag, AuditLog (read-only).** Seven
  entities. Covers the operational set Bette would actually
  touch this month.

Recommend (c). Confirm.

### 2. Form-generation approach

Three approaches, each with trade-offs:

| Approach | Pros | Cons |
| --- | --- | --- |
| **Prisma DMMF introspection** (read `Prisma.dmmf.datamodel`) | Zero per-entity work; types stay in sync with schema automatically | DMMF leaks into client bundle if not careful; less control over field order; can't express custom validation |
| **Metadata enrichment** (add `formFields` to `entity-metadata.ts`) | Explicit; designer-friendly; per-field control | Out of scope for this BU per "don't touch entity-metadata.ts"; couples form to metadata |
| **Reuse existing tRPC mutation Zod schemas** (admin-surface.md §"The generic scaffolding" calls for this) | One source of truth; create/update validation already exists where we have feature routers; matches the architectural doc | We don't have create/update procedures for most entities yet; the registry would have to declare them anew, which is what this BU does anyway |

Recommend the third — declare per-entity Zod create/update
schemas in the new `server/services/admin/registry.ts`. Future
feature BUs (e.g. BU-admin user-management) will collapse the
registry's schemas into shared schemas reused by feature
routers. Confirm.

### 3. Auth boundary — admin only, or queue_manager scoped per D055?

Per D055, `queue_manager` grants carry a `scope` (e.g.
`queue_manager:vetting`). The `entityMetadata.request` row has
`requiresRole.view: 'queue_manager'` — should `/data/request`
filter to the caller's scoped types only, or stay flat?

Two options:

- **(a) Flat.** `requireRole('queue_manager')` — any
  queue_manager sees every Request. Matches today's foundation
  route behaviour.
- **(b) Scoped.** Apply scope filtering at the list query
  (caller with `queue_manager:vetting` sees only
  `request.type === 'vetting'` rows). Matches D055.

Note: `/data/request` is moot if Open Question 4 resolves to
"redirect queue entities to `/requests`" — but the question
generalises: should _any_ entity surface honour scopes? In
practice, only `request` has scoped types today; everything
else with `requiresRole.view: 'queue_manager'` is global.

Recommend (a) for this BU + a follow-up to layer scoping in
once BU-requests-urgent ships and we have a real scope model in
production. Confirm.

### 4. What does `/data/request` do, given `workflow: 'queue'`?

- **(a) Redirect to `/requests`.** Cleanest; queue entities
  never render a generic list.
- **(b) 404.** Cleaner from a routing standpoint; user knows
  to use `/requests`.
- **(c) Render generic list.** Lets admins inspect raw rows
  without queue UX. Useful for debugging but creates two
  surfaces.

Recommend (a). Confirm.

### 5. Hard-delete UI — admin-only, with double-confirmation?

Entities with `softDelete: false` (today: `userRegion`,
`roleGrant`, `auditLog`) need a delete affordance. AuditLog is
immutable so it has none. UserRegion and RoleGrant are
admin-only and operationally rare. Should hard-delete require:

- (a) A typed-confirmation modal ("type DELETE to confirm")?
- (b) Just a standard "Are you sure?" dialog?
- (c) A two-step "armed → confirm" inline button?

Recommend (a) for hard-delete on any entity. Confirm.

### 6. Where does "immutable" live?

`auditLog`'s `notes` field says "Immutable — routers must not
expose update or delete procedures." String-matching `notes` is
brittle. Two ways to express it cleanly:

- (a) Add an `immutable: boolean` field to
  `EntityMetadataEntry`. Out of scope per "don't touch
  entity-metadata.ts" — would require a follow-up to amend the
  contract.
- (b) Encode it in the registry instead (e.g. registry entry
  has no `update` or `delete` schema, and the generic
  procedures reject by absence).

Recommend (b) for this BU; surface a follow-up to land
`immutable` on the metadata entry once we've shipped one or two
more such entities and the pattern is clear.

### 7. Datetime fields on forms

Most date fields in the schema are timestamps managed by
Prisma (`createdAt`, `updatedAt`, `deletedAt`, etc.) — read-only.
A handful (`User.verifiedAt`, `User.lastSeenAt`,
`RoleGrant.revokedAt`) are operationally set by feature
routers. Should the generic form expose them as editable?

Recommend: read-only on detail; editable only when the
registry's update Zod schema explicitly opts them in.

### 8. List-page take limit

Default 50, max 100. Slice 1 entity counts are tiny; this
won't bite for the demo. Should we ship a "load more" or wait
for cursor pagination? Recommend wait — pagination lands when
`request` count grows.

---

## Context

**Specs (read first):**

- `docs/architecture/admin-surface.md` — the architectural
  doc this BU implements. Read every section.
- `docs/architecture/decision-log.md` —
  - D040 (work_items / queue primitive)
  - D045 (Post visibility)
  - D051 (BU naming — semantic, not numbered)
  - D054 (Request entity)
  - D055 (per-type scopes — Open Question 3)
- `docs/process/working-rhythm.md` — DoD checklist below
  derives from §3.
- `docs/process/api-contract-discipline.md` — the 10 rules; the
  generic procedures must honour them (declared inputs,
  declared outputs, typed errors, no `z.any()`, etc.).
- `docs/process/testid-convention.md` — `admin-` area prefix.
- `docs/process/design-tokens-convention.md` — F15 standard.
- `docs/process/security-baseline.md` — no PII in logs.

**Existing code to read first:**

- `server/admin/entity-metadata.ts` AND `entity-metadata.README.md`
  — the contract.
- `app/data/page.tsx` AND `app/data/[entity]/page.tsx` — the
  foundation stub this BU lights up.
- `server/lib/trpc.ts` — `requireRole` middleware, scope
  semantics, `authedProcedure`.
- `server/routers/_app.ts` — where to register `admin`.
- `server/routers/post.ts` AND `server/services/post.ts` — the
  closest precedent for service / router shape.
- `server/services/request.ts` — the foundation BU's read-only
  pattern; the generic engine generalises this.
- `prisma/schema.prisma` — for the model shapes the engine has
  to handle (enum types, FK `onDelete` policies, soft-delete
  columns, dotted-path joins).
- `styles/tokens.css` — the F15 token surface; surface a
  follow-up if a needed token is missing.

**Process:**

- `docs/process/session-brief-template.md` — this brief
  follows it.
- `docs/process/session-hygiene.md` — context-budget discipline.
- `CLAUDE.md` — operating context.

---

## What this brief does NOT cover

(Naming gaps explicitly, per the discipline.)

1. Bulk operations (checkbox row selection, bulk softDelete /
   restore / forceRelease).
2. CSV import / export.
3. Audit-log integration on mutations.
4. Bulk soft-delete restoration UI.
5. JSON field editing.
6. Many-to-many relation editing.
7. Realtime / cross-tab updates.
8. Pagination beyond `take: 50`.
9. Per-column filtering.
10. Concurrent-edit detection.
11. Custom per-entity field-renderer overrides.
12. The `/queue` workflow surface (BU-requests-urgent).
13. Member-facing changes — none. This is power-user UI only.
14. Schema changes — none. The metadata is the contract.
15. Feature-flag gating of the surface — none. The surface is
    role-gated; no `ff_admin_crud` flag.

---

## Slice convention

BU-admin-crud is a **feat** session. Commit type
`feat(admin-crud)`. Establishes:

- The generic CRUD engine (one router family + one component
  family) that every future entity uses.
- The "metadata + registry" pattern for how admin surfaces
  pick up new entities.
- The admin-surface UX feel (table → detail → form, honest
  empty/error states, role-gated actions).
- The pattern future BUs (BU-admin, BU-admin-bulk-ops,
  BU-admin-audit-integration) extend rather than reimplement.

Future related BUs:

- **BU-admin-bulk-ops** — checkbox selection + bulk procedures.
- **BU-admin-audit-integration** — wire the audit writer into
  every generic mutation.
- **BU-admin-relations** — many-to-many relation editing.
- **BU-admin-csv** — import / export.
- **BU-admin** (umbrella) — coordinator-management UI, feature
  flag flips with reason capture, the higher-touch admin
  surfaces. Builds on top of this BU's engine.

---

## What lands after this session

- Admins (and queue-managers, where gated) can round-trip CRUD
  on every Slice 1+ entity in the metadata file — without any
  new per-entity code.
- The `/data/[entity]` foundation route is now functional, not
  a stub.
- Operational recovery is unblocked: a stuck flag, a wrong-typed
  user, a misconfigured feature-flag value can be fixed via the
  admin surface instead of `psql`.
- The pattern is in place for future BUs to add bulk ops,
  audit integration, CSV, etc. — all incremental, all generic.
- The architectural promise of `admin-surface.md` ("every entity
  is usable through admin scaffolding before member-facing UI
  exists") is met.
