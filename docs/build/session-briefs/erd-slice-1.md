# SESSION BRIEF · ERD Slice 1 — Foundation entities

*Brief version: 1.0 · Author: Paul · Date: April 2026*

---

## Objective

Generate the Prisma schema, entity metadata map, and human-readable ERD
narrative for the eight foundation entities of GPS Action: `User`, `Region`,
`UserRegion`, `WorkItem`, `RoleGrant`, `CoordinatorProfile`,
`CoordinatorGroup`, `AuditLog`, and `FeatureFlag`. Success looks like a
schema that satisfies every constraint in `admin-surface.md`,
`claim-and-lease.md`, and the foundational ADRs (D003, D036, D038, D040,
D041, D042, B07), with no feature-specific entities yet (Posts, Comments,
Flags, etc. arrive in later slices).

---

## Scope

### Build in this session

- `/prisma/schema.prisma` (new — establish the file with Slice 1 entities)
- `/server/admin/entity-metadata.ts` (new — metadata map for the 9 Slice 1 entities)
- `/docs/architecture/erd.md` (new — human-readable narrative + Mermaid diagram of Slice 1)
- `/prisma/schema.README.md` (new — explains the schema file's structure, slice convention, how to extend)
- `/server/admin/entity-metadata.README.md` (new — explains the metadata map pattern)

### Do NOT touch

- Any existing file under `/docs/` (decisions are made; schema follows them, doesn't change them)
- Any file under `/server/routers/`, `/server/services/`, `/app/`, `/components/` — feature code is not in scope
- `CLAUDE.md` — update separately if needed
- `package.json` — Prisma should already be installed; if not, surface this as an open question
- Any existing `/tests/` files — feature tests are not in scope
- `.github/`, `.husky/`, ESLint config — Phase 0 foundations are separate
- The `seed.ts` script (per Phase 0 F10) — that's a separate session

### Out of scope for this session

Things this brief is aware of but explicitly not building:

- **Feature entities** (Post, Comment, Reaction, Flag, Application, OutcomeReview, EditRequest, ContentSubmission, LinkSubmission, Vouch, Group, Contact, Resource, Route, DispatchEvent, PartnerOrg) — these arrive in Slices 2-4
- **Migration files** — running `prisma migrate dev` to generate the migration is a separate concern; this session produces the schema definition only
- **Seed data** — F10 in Phase 0 foundations covers seed; not this session
- **The actual admin UI components** — BU-admin (next Build Unit) builds those; this session provides the schema they'll consume
- **PostGIS extension** — explicitly NOT enabled (per D041, no geospatial queries in MVP)
- **The eight work-item types' context schemas** — defined per-Build-Unit when each feature ships; this session only commits to the JSONB column
- **Login / authentication flow** — `User` table exists but auth implementation is a separate Build Unit
- **Feature flag evaluation function** — table exists; the `isFeatureEnabled()` function is a separate Build Unit

---

## Contracts

### Inputs consumed

Documents the session must read before generating anything. These are the
source of truth — schema must align with them. If the schema and these docs
conflict, the docs win.

- `/docs/architecture/admin-surface.md` (the role model, six schema conventions, role-grants schema, coordinator-profile schema)
- `/docs/architecture/claim-and-lease.md` (the WorkItem schema spec — the entire "Schema for ERD" section is canonical)
- `/docs/architecture/decision-log.md` — specifically:
  - **D003** (TypeScript / Next.js / Prisma / tRPC stack)
  - **D022** (repo structure — layer-first directories)
  - **D036** (feature flags — homegrown, DB-driven schema)
  - **D038** (traceability infrastructure — file headers and YAML frontmatter)
  - **D040** (work_items as unified queue primitive)
  - **D041** (region as optional tag only)
  - **D042** (coordinator vs queue_manager split)
- `/docs/process/api-contract-discipline.md` (informs how Zod schemas relate to entities — specifically rule 6 about colocated schemas)
- `/docs/product/region-and-proximity-decision.md` (the decided Position 2D + 3D)
- `/docs/build/engineering-roadmap.md` § B07 (audit log spec, defines AuditLog table requirements)

### Outputs produced

These are commitments to other sessions. Their shape becomes a contract.

- **Prisma models** for the 9 entities — exported from `prisma/schema.prisma`. Future sessions will reference these models by name.
- **`entityMetadata` constant** — exported from `server/admin/entity-metadata.ts`. Generic admin scaffolding (BU-admin) will read this. Shape:
  ```typescript
  export const entityMetadata: Record<string, EntityMetadataEntry> = { ... }
  ```
- **`EntityMetadataEntry` TypeScript type** — exported from the same file. Defines the shape of each metadata entry. Other sessions extending the metadata map will conform to this type.
- **Mermaid ERD diagram** — embedded in `docs/architecture/erd.md`. Future slice-N sessions extend the diagram, not replace it.

---

## Acceptance criteria

Each criterion is testable by reading the schema or running `pnpm prisma validate`.

- [ ] `pnpm prisma validate` succeeds with zero errors
- [ ] `pnpm prisma format` produces no changes (file is already formatted)
- [ ] All 9 entities present: User, Region, UserRegion, WorkItem, RoleGrant, CoordinatorProfile, CoordinatorGroup, AuditLog, FeatureFlag
- [ ] Every entity has a `displayName`, `title`, `name`, or equivalent (admin-surface.md convention 1)
- [ ] Every soft-delete-eligible entity has `deletedAt DateTime?` (convention 2)
- [ ] All status / category / type fields use Prisma enums, not strings (convention 3)
- [ ] Every entity has `createdAt` and `updatedAt` (convention 4)
- [ ] Every foreign key declares an explicit `onDelete` policy (convention 5)
- [ ] `entity-metadata.ts` has one entry per entity (convention 6)
- [ ] `WorkItem` schema matches the spec in claim-and-lease.md "Schema for ERD" section EXACTLY (field names, types, nullability, indexes)
- [ ] `RoleGrant` schema matches the spec in admin-surface.md "Dynamic role management" section EXACTLY
- [ ] `CoordinatorProfile` and `CoordinatorGroup` schemas match admin-surface.md "Coordinator identity" section EXACTLY
- [ ] No PostGIS extension declared (per D041)
- [ ] No location fields on `User` (no homePostcode, homeLat, homeLng — per D041)
- [ ] `Region` table is hierarchy-only (parent + slug + name + type), no centroids or boundaries (per D041)
- [ ] `WorkItem.regionSlug` is present but documented as informational-only (per D041)
- [ ] All file headers include `@build-unit BU-001-prep`, `@spec architecture/admin-surface.md`, `@spec architecture/claim-and-lease.md` (per D038)
- [ ] `erd.md` includes a Mermaid diagram showing all 9 entities and their relationships
- [ ] `erd.md` includes a "Slice convention" section explaining that future slices extend this file
- [ ] `entity-metadata.ts` exports both the `entityMetadata` constant AND the `EntityMetadataEntry` type
- [ ] No TypeScript errors when running `pnpm tsc --noEmit` (if applicable to the metadata file)
- [ ] Both README files complete: explain the file's purpose, the slice convention, and how future slices extend it

---

## Permission matrix

*(Adapted from template — the schema doesn't enforce permissions directly, but it must support the role model defined in admin-surface.md.)*

The schema must enable these access patterns (BU-admin will implement the actual middleware):

| Entity | Member access | queue_manager access | admin access |
|---|---|---|---|
| User | View own profile, edit own basics | View any profile | Edit any profile, manage roles |
| Region | View list (for tagging dropdowns) | View list | Create/edit/delete regions |
| UserRegion | View own | View any | Edit any |
| WorkItem | NONE — members never see queue | View all, claim, resolve | Force-release, delete |
| RoleGrant | View own grants in profile | View own grants | Grant, revoke any (per admin rules) |
| CoordinatorProfile | View own, edit own | View any | Edit any (admin notes), delete |
| CoordinatorGroup | View own, edit own | View any | Edit any, delete |
| AuditLog | View entries about themselves | View entries about own actions | View all |
| FeatureFlag | NONE | NONE | View, edit, toggle |

The schema's job: ensure the data model **can support** these access patterns
(via FK relationships, scoping fields, etc.). The actual `WHERE` clauses live
in the routers built later.

---

## Entity invariants

*(Adapted from template's "UI states" — schema doesn't have UI states; it has data invariants. These are the rules the schema must enforce or make enforceable.)*

| Invariant | How enforced |
|---|---|
| A user has at most one active grant per role | Composite unique index on (userId, role) WHERE revokedAt IS NULL — or app-level check, surface as open question |
| The last admin role grant cannot be revoked | App-level check; document in schema comments |
| A user cannot revoke their own admin role | App-level check; document in schema comments |
| A WorkItem with status='claimed' must have claimedByUserId, claimedAt, claimExpiresAt populated | App-level validation; document as schema comment |
| A WorkItem with status='resolved' must have resolvedAt, resolvedByUserId, resolution populated | App-level validation; document as schema comment |
| A CoordinatorProfile is one-to-one with User | Unique constraint on userId |
| A CoordinatorGroup belongs to exactly one CoordinatorProfile | Required FK with cascade delete |
| Region hierarchy is acyclic | App-level check; document expectation |
| Region slugs are globally unique | Unique constraint on slug |
| AuditLog entries are immutable (no update, only insert) | Document as schema comment; enforced by routers (no update procedures) |
| FeatureFlag names are unique | Unique constraint on name |
| Soft-deleted entities should not appear in default queries | Document the convention; not enforced at DB level (router middleware adds WHERE deletedAt IS NULL) |

If any of these invariants cannot be enforced cleanly in Prisma, surface as
open question rather than silently dropping.

---

## Tests required

*(Adapted from template — for a schema-generation session, "tests" means schema validation rather than runtime tests.)*

Required:
- `pnpm prisma validate` passes (Prisma's built-in schema validation)
- `pnpm prisma format` produces no changes (idempotent format)
- TypeScript compilation of `entity-metadata.ts` succeeds (`pnpm tsc --noEmit` if a tsconfig exists; otherwise document the requirement)
- A simple smoke test in `prisma/schema.smoke-test.ts` (or equivalent) that imports the generated Prisma client and references each model — proves the schema produces a usable client

Not required:
- Integration tests against a real database — F08 (migration validation on CI) covers this in Phase 0
- Seed data — F10 covers seed in a separate session
- Test database harness — comes with the first router-building session

---

## Scenarios to verify against

*(Adapted from template — the ERD doesn't directly enable user-facing scenarios. Instead, verify that the schema supports the data shapes the scenarios require.)*

Read `docs/product/scenarios.md` and verify the schema can support these
scenarios when feature entities are added in later slices:

- **SCN-04** (Sharon flags a post) — schema must support `WorkItem` of type
  `flag` with claim/release/resolve lifecycle ✓ (in WorkItem)
- **SCN-08** (Vetting flow) — schema must support `WorkItem` of type
  `vetting`, with vouching references in context JSON ✓
- **Coordinator scenario** — schema must support a member having
  `CoordinatorProfile` with multiple groups, independent of any
  `RoleGrant` they may or may not have ✓ (per D042)
- **Region tagging** — schema must support a Region table that can be
  referenced by future Post.regionTagId, even though Post doesn't exist yet
  ✓ (Region table present)

If the scenarios suggest a data shape that this schema cannot support,
surface as open question.

---

## Known gotchas

- **Prisma enum syntax** — Prisma enums use lowercase by convention; some
  examples in the source docs use mixed case. Normalise to lowercase
  (snake_case if multi-word).
- **`deletedAt` indexes** — soft-delete columns need to be in indexes for
  the WHERE clauses to be efficient. Add `@@index([deletedAt])` to entities
  that will be soft-deleted.
- **Self-relations on User** — `RoleGrant.grantedByUserId` and
  `revokedByUserId` both reference `User`. Prisma requires explicit
  `@relation` names to disambiguate multiple relations to the same model.
  See claim-and-lease.md's User additions example for the pattern.
- **JSONB on Postgres** — Prisma calls this `Json`. Used for
  `WorkItem.context` and any other flexible payloads. Note that Postgres
  JSON queries are different from PostgreSQL JSONB; we want JSONB for
  performance. Prisma uses JSONB by default on Postgres — verify.
- **`onDelete: Restrict` semantics** — for `RoleGrant.grantedByUserId`,
  using Restrict prevents deleting an admin who has granted roles to
  others. Cascade would delete all the role grants they made. SetNull would
  orphan them. Choose deliberately and document the choice in a comment.
- **Audit log immutability** — Prisma can't enforce "INSERT only, no
  UPDATE." Document the expectation; the routers built later must respect
  it (no update procedures for AuditLog).

---

## Definition of done

All these must pass before declaring the session complete.

- [ ] All five files in "Build" list created; no files in "Don't touch" list modified
- [ ] `pnpm prisma validate` passes with zero errors
- [ ] `pnpm prisma format` produces no changes
- [ ] Every acceptance criterion ticked (re-verify each one explicitly)
- [ ] Both README files explain: purpose of the file, the slice convention, how future slices extend
- [ ] `erd.md` Mermaid diagram renders correctly (test with a Mermaid renderer like mermaid.live)
- [ ] `entity-metadata.ts` exports an entry for every entity in the schema (no orphans either way)
- [ ] No `TODO` comments left in committed files
- [ ] No `// FIXME` comments left in committed files
- [ ] All file headers include `@build-unit`, `@spec` annotations per D038
- [ ] Open questions list (next section) populated with any judgement calls made
- [ ] Commit message follows convention: `feat(schema): ERD Slice 1 — foundation entities (User, Region, WorkItem, RoleGrant, CoordinatorProfile, CoordinatorGroup, AuditLog, FeatureFlag)`

---

## Open questions to surface

Things this session cannot decide autonomously. Claude Code: list these at
the end of the session, do NOT make assumptions silently.

Pre-identified open questions (these are known going in):

1. **Composite unique on RoleGrant active state** — Postgres supports
   partial unique indexes (`UNIQUE (userId, role) WHERE revokedAt IS NULL`)
   but Prisma doesn't have first-class syntax for this. Three options:
   (a) Plain unique index on (userId, role) — too restrictive (can't re-grant after revoke)
   (b) Use `@@unique([userId, role, revokedAt])` and rely on NULL behaviour — Postgres treats each NULL as distinct, breaking the constraint
   (c) Document it as an app-level invariant only
   Surface and pick.

2. **Region.type enum values** — what are the legitimate region types?
   Proposal: `national`, `region` (London, North West, etc.), `council`
   (boroughs / unitary authorities). Confirm or expand.

3. **Whether to seed any Region data in this session** — F10 is the seed
   session, but Slice 1 might benefit from a few seed regions in the README
   for documentation purposes (~20 major UK places + national, per the
   M5 plan in the recent role decisions). Surface a recommendation but
   don't seed without confirmation.

4. **`User` baseline fields** — beyond identity (id, email, displayName,
   createdAt), what minimum fields does User need? Suggested:
   - `email` (unique, required)
   - `displayName` (required)
   - `phoneNumber` (optional — for future MFA)
   - `verifiedAt` (timestamp — when their vetting completed; null = unverified)
   - `lastSeenAt` (for activity stats)
   Surface and confirm before locking.

5. **`AuditLog` shape** — B07 spec gives high-level requirements but the
   exact column shape needs detail. Proposal:
   - `id`, `userId` (actor), `action` (string), `entityType` (string), `entityId` (string),
   - `targetUserId` (nullable), `changes` (JSONB), `context` (JSONB),
   - `ipAddress`, `userAgent`, `timestamp`
   Confirm or refine.

6. **Whether to enable the pgcrypto / uuid extension** — UUIDs are needed
   for `@default(uuid())`. Prisma handles this with the application-side
   generator by default. Document choice.

(Claude Code: add any further judgement calls you encounter.)

---

## Context

Read these before starting. Listed in priority order.

**Architectural specs (the schema must satisfy these):**
- `/docs/architecture/admin-surface.md` — six schema conventions, role model, role-grants schema, coordinator-profile schema, ERD constraints section
- `/docs/architecture/claim-and-lease.md` — full WorkItem spec (the "Schema for ERD" section is gospel; do not deviate)

**Decision log (the why behind the constraints):**
- `/docs/architecture/decision-log.md` — read D003, D022, D036, D038, D040, D041, D042 minimum

**Process (how to work):**
- `/docs/process/api-contract-discipline.md` — Zod schema patterns
- `/docs/process/session-brief-template.md` — this brief follows that template
- `/CLAUDE.md` — the operating context for any Claude Code session

**Product context:**
- `/docs/product/region-and-proximity-decision.md` — full reasoning behind D041
- `/docs/product/scenarios.md` — verify schema supports the scenarios
- `/docs/product/parking-lot.md` — parked items inform what's NOT in scope

**Engineering process:**
- `/docs/build/phase-0-foundations.md` — the Phase 0 items context
- `/docs/build/engineering-roadmap.md` — Tier B/C/D items context

---

## Slice convention

This session is **Slice 1 of the ERD**. Future slices will extend the same files:

- **Slice 1 (this session):** Foundation entities — User, Region, UserRegion, WorkItem, RoleGrant, CoordinatorProfile, CoordinatorGroup, AuditLog, FeatureFlag
- **Slice 2 (future session):** Content primitives — Post, Comment, Reaction, Attachment, plus dedup-related fields/tables (per dedup-and-cosurfacing.md)
- **Slice 3 (future session):** Workflow entities — Application (vetting), Flag, OutcomeReview, EditRequest, ContentSubmission, Vouch
- **Slice 4 (future session):** Network & dispatch — Group, Contact, Resource, Route, DispatchEvent, PartnerOrg

Each future slice **adds** to `prisma/schema.prisma` and to
`entity-metadata.ts`. The `erd.md` Mermaid diagram extends. No previous
slices' schema changes without an ADR.

The README files (this session creates them) document this convention so
future slices inherit it.

---

## What this brief does NOT cover

(Naming gaps explicitly, per the discipline.)

1. **Migration generation.** Running `prisma migrate dev` to produce the
   actual migration SQL is out of scope. The schema file is the deliverable;
   the migration is a follow-on.
2. **Database connection setup.** `DATABASE_URL` configuration, Vercel
   Postgres provisioning — not in this session.
3. **Test database harness.** Comes with first router-building session.
4. **Per-type WorkItem.context Zod schemas.** Defined per-Build-Unit when
   each feature ships (vetting context in BU-vetting, flag context in BU-flag,
   etc.).
5. **Generic admin UI.** That's BU-admin — separate session that consumes the
   metadata map this session produces.
6. **The `isFeatureEnabled()` evaluation function.** Comes with a separate
   session implementing the feature-flag service.
7. **Auth provider integration.** User table exists; choosing NextAuth /
   Auth.js / Clerk / Lucia is a separate decision and Build Unit.
