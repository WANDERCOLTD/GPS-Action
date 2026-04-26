# `prisma/schema.prisma` — operating notes

The Prisma schema is the authoritative model of every entity in GPS Action.
Code, types, queries, and the admin UI all derive from it. Treat it like a
contract.

For the visual ERD and rationale, read [`docs/architecture/erd.md`](../docs/architecture/erd.md).

---

## Slice convention

The schema is built up **one slice at a time**. Each slice is its own Build
Unit (or Build-Unit-prep), with a session brief, an ADR if it makes a non-
obvious choice, and an extension to the Mermaid diagram in `erd.md`.

| Slice | Status    | Entities                                                                                                   |
| ----- | --------- | ---------------------------------------------------------------------------------------------------------- |
| **1** | ✅ landed | User, Region, UserRegion, WorkItem, RoleGrant, CoordinatorProfile, CoordinatorGroup, AuditLog, FeatureFlag |
| 1.5   | planned   | Group, GroupMembership                                                                                     |
| 2     | planned   | Post, Comment, Reaction, Attachment + dedup fields                                                         |
| 3     | planned   | Application, Flag, OutcomeReview, EditRequest, ContentSubmission, Vouch                                    |
| 4     | planned   | Contact, Resource, Route, DispatchEvent, PartnerOrg                                                        |

Rules:

1. **Add, never refactor.** A slice extends previous slices. Renaming a model
   or removing a column from an earlier slice requires an ADR and a two-phase
   migration (per `docs/process/migration-discipline.md` once that lands).
2. **Existing relations are stable.** When a new slice introduces an entity
   that links to an existing one (e.g. Slice 2 adds `Post.authorId → User`),
   the existing model gains a back-reference relation but keeps its existing
   relations untouched.
3. **Indexes are additive.** New slices may add indexes; they do not remove
   existing ones without an ADR.
4. **Enums grow forwards.** New enum values are appended; reordering or
   removal requires an ADR.

---

## Six conventions enforced (per `admin-surface.md`)

The schema header repeats these — they are the contract the admin scaffolding
relies on.

1. **Display field on every entity.** A `name`, `displayName`, `title`, or an
   admin-metadata `displayTemplate` composing one from related fields.
2. **Soft delete by default.** `deletedAt DateTime?` on entities that should
   be recoverable. Exceptions: `RoleGrant` (revocation is a status change,
   not a delete), `AuditLog` (immutable), `UserRegion` (lightweight join
   table — recreate if needed).
3. **Enums for status / category fields.** No free-text "status" strings.
4. **`createdAt` and `updatedAt` everywhere.** Even `AuditLog` has
   `createdAt` (no `updatedAt` because it's immutable).
5. **Explicit `onDelete` on every relation.** No defaults. See
   [`erd.md` § "On Cascade vs Restrict vs SetNull"](../docs/architecture/erd.md#on-cascade-vs-restrict-vs-setnull)
   for the choice tree.
6. **Per-entity admin metadata.** Every model gets one entry in
   [`server/admin/entity-metadata.ts`](../server/admin/entity-metadata.ts).

---

## How to extend the schema (next-slice playbook)

When a future session adds entities (Slice 1.5 onwards):

1. **Read the relevant architecture doc.** Don't add an entity that doesn't
   appear in `docs/architecture/*.md` — if it's not specified, write the
   spec first.
2. **Append to `schema.prisma`** under a new `// ── SLICE N — ...` divider.
   Keep enums grouped at the top of the file's Slice N section.
3. **Add an entry to `server/admin/entity-metadata.ts`** for every new
   entity. The `EntityMetadataEntry` type guides the shape.
4. **Extend the Mermaid diagram in `erd.md`** with the new entities and
   their relations. Old entities never disappear from the diagram.
5. **File header annotations (D038):** `@build-unit`, `@spec` lines on every
   touched file.
6. **Validate before committing:**
   ```bash
   DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
     npx prisma validate
   DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
     npx prisma format
   npx tsc --noEmit
   npx eslint .
   ```
7. **Generate the migration in a follow-up session.** Schema definition and
   migration generation are separate concerns (per Slice 1's brief).

---

## Local development

This file does not generate a database on its own. After cloning:

```bash
# 1. Set DATABASE_URL in .env (see .env.example)
# 2. Generate the Prisma client
npm run db:generate

# 3. Apply migrations
npm run db:migrate

# 4a. Curated demo seed (5 named users + 18 narrative posts, for
#     demos / screenshots — see scripts/seed.ts)
npm run db:seed

# 4b. F10 fixture seed (~50 users, ~200 posts, hundreds of comments
#     and reactions — for previews, manual QA, future Storybook).
#     Also runs automatically on `prisma migrate reset`.
npx prisma db seed
```

The seed scripts are **not** the source of truth for entity shapes — the
schema is. They populate fixtures for Storybook, previews, and tests.

| Seed             | File              | Invoked by           | Purpose                                   |
| ---------------- | ----------------- | -------------------- | ----------------------------------------- |
| Demo seed        | `scripts/seed.ts` | `npm run db:seed`    | Hand-curated narrative for demos & design |
| F10 fixture seed | `prisma/seed.ts`  | `npx prisma db seed` | Bulk realistic fixtures (deterministic)   |

Both are idempotent. They write disjoint datasets (separate email
domains, separate group slugs) so a developer can run both back to
back and get the union of the two without collisions. See
`docs/build/session-briefs/f10-seed-data.md` for the full F10 contract.

---

## What this file does NOT do

- **Migrations.** SQL migrations live in `prisma/migrations/`. Generate with
  `npm run db:migrate`. Never hand-edit committed migrations.
- **Encryption.** Tier-1 personal data (per `docs/process/security-baseline.md`)
  uses application-layer encryption via a Prisma Client Extension. The schema
  marks the columns; the extension does the work. Slice 1 has no Tier-1
  fields beyond `User.email` and `User.phoneNumber` — encryption strategy is
  decided when the auth Build Unit chooses a provider.
- **Row-level security.** Authorisation lives in tRPC middleware
  (`requireRole(...)`), not in DB-level RLS policies, for MVP.
- **Validation rules.** Zod schemas in routers handle input validation. Per
  `docs/process/api-contract-discipline.md` rule 6, schemas live alongside
  procedures.
