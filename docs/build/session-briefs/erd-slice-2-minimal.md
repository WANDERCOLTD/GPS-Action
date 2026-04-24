# SESSION BRIEF · ERD Slice 2 (minimal) — Post schema

*Brief version: 1.0 · Author: Paul · Date: April 2026*

---

## Objective

Extend the Prisma schema with the `Post` model and its supporting
enums. Minimum scope to unblock the demo path — no Comment, no
Reaction, no Attachment. Success looks like: Post model exists, has an
`activistMailerUrl` field, validates cleanly, is reflected in the ERD
narrative, and the admin entity metadata has a sensible entry so the
future admin UI renders Post correctly.

**Scope is deliberately narrow.** The original "Slice 2 full" —
Comments, Reactions, Attachments, dedup fields, etc. — becomes a later
session after the demo lands. This brief is the minimum viable Post
schema for feed-rendering and simple composing.

---

## Scope

### Build in this session

- `prisma/schema.prisma` (modify — add Post model, enums; add
  relation to User)
- `server/admin/entity-metadata.ts` (modify — add entry for `post`)
- `docs/architecture/erd.md` (modify — extend Mermaid diagram, add
  Slice 2 minimal narrative)
- `tests/unit/schema.smoke.test.ts` (modify — add smoke assertion
  referencing Post type)

### Do NOT touch

- Any existing entity's core fields — no changes to User, Region,
  Group, WorkItem, RoleGrant, CoordinatorProfile, CoordinatorGroup,
  AuditLog, FeatureFlag, UserRegion, GroupMembership
- `/app/**`, `/server/routers/**`, `/server/services/**`,
  `/components/**` — feature code is not in scope
- `eslint.config.js`, `package.json`, `CLAUDE.md` — unchanged
- ADRs (decision log) — no new ADRs needed; D045 covers visibility
- `docs/product/**` — specs are not changing

### Out of scope for this session

- **Comment model** — part of full Slice 2 later
- **Reaction model** — part of full Slice 2 later
- **Attachment model** — part of full Slice 2 later per image-handling.md
- **Dedup / cosurfacing fields** (e.g., `canonicalUrl`, `dedupGroupId`)
  — part of full Slice 2 later
- **Boost/remove verdict tracking** — part of full Slice 2 later
- **Share events, dispatch events** — ERD Slice 4 territory
- **PostView model for read receipts** — future Slice 2 extension
- **Partner organisation tagging** — per parking-lot "v0.6 absorbing",
  schema extension later
- **Draft state** — no Post-as-draft; compose-and-publish is the only
  flow for MVP
- **Post editing** — no edit history or EditRequest relation yet
- **Regional or group scoping of Posts** — use existing
  `User.regionsOfInterest` and `Group.slug` in tags; no new FKs from
  Post
- **Feature code** — routers, services, UI all deferred to BU-feed
  and BU-composer

---

## Contracts

### Inputs consumed

- `/prisma/schema.prisma` — read fully; this session EXTENDS it
- `/server/admin/entity-metadata.ts` — read fully; this session
  EXTENDS it
- `/docs/architecture/erd.md` — read fully; extend the narrative
- `/docs/architecture/admin-surface.md` — the 6 schema conventions
  every new entity must satisfy
- `/docs/architecture/decision-log.md` — D045 (visibility),
  D038 (traceability), D044 (composer — context for types)
- `/docs/product/post-creation-flow.md` — the intended Post fields
  from the product side
- `/docs/product/scenarios.md` — scenarios involving Posts
- `/docs/build/session-briefs/erd-slice-1-5.md` — the format to mirror

### Outputs produced

- **`Post` Prisma model** — fields defined below
- **`PostType` enum** — the allowed kinds
- **`PostVisibility` enum** — per D045
- **User relation** — `User.posts Post[]` back-reference
- **`entityMetadata.post`** — admin metadata entry
- **ERD diagram extension** — Post added to the Mermaid diagram
- **ERD narrative section** — "Slice 2 minimal" explaining what's
  here and what's deferred
- **Smoke test assertion** — Post type is importable

---

## Post model — specification

### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | Standard UUID |
| `authorId` | `String` | FK to User |
| `author` | `User @relation(...)` | back-reference; see relations |
| `type` | `PostType` | enum, required |
| `title` | `String` | required, no default length cap at DB level |
| `body` | `String` | required; the main content, Markdown-rendered in UI |
| `activistMailerUrl` | `String?` | optional; the campaign URL if any |
| `visibility` | `PostVisibility @default(public)` | per D045 |
| `groupTags` | `String[] @default([])` | slugs of groups this post belongs to (mirrors WorkItem pattern; informational only in MVP) |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |
| `deletedAt` | `DateTime?` | soft delete |

**Display field:** `title` (satisfies convention 1).
**Soft-delete marker:** `deletedAt` (satisfies convention 2).
**Enums used for type/visibility:** satisfies convention 3.
**Timestamps:** satisfies convention 4.
**Explicit onDelete on relations:** satisfies convention 5.

### Enums

```prisma
enum PostType {
  dispatch          // "here's a thing to do" — action call, boost/remove, etc.
  cultural_moment   // Shabbat, remembrance, celebration — quieter tone
  action_call       // explicit "please do this" — letter to MP, petition link
  news_share        // article + commentary
  question          // open question to the community
}

enum PostVisibility {
  public              // visible to anyone who can see the feed (including unauthed if we allow)
  authenticated_only  // author chose to require login (D045 override)
}
```

### Relations

- `authorId` → `User.id`, `onDelete: SetNull` if `authorId` were
  nullable, else `Cascade` — author deletion hard-deletes their posts.
  **Recommendation: `onDelete: Restrict`** — a user with posts cannot
  be hard-deleted; instead soft-delete the user (their posts remain
  visible but author shows as "deleted user" in the UI layer). This
  preserves community history. Surface as open question if this feels
  wrong.

- Add to `User` model:
  ```prisma
  posts Post[] @relation("authorPosts")
  ```

### Indexes

- `@@index([visibility, createdAt(sort: Desc)])` — the feed query
  (`WHERE visibility IN ('public', 'authenticated_only') ORDER BY createdAt DESC`)
- `@@index([authorId, createdAt(sort: Desc)])` — "posts by X" queries
- `@@index([type, createdAt(sort: Desc)])` — future per-type filtering
- `@@index([groupTags], type: Gin)` — array search, mirror WorkItem pattern
- `@@index([deletedAt])` — soft delete exclusion

### Field headers / comments

Every model block must explain its role, app-level invariants, and
onDelete reasoning in JSDoc-style Prisma comments (per the convention
established in Slice 1). Template:

```prisma
// ─── Post ────────────────────────────────────────────────────────────────────
//
// Core content entity. A member writes a Post and it enters the feed.
// Types distinguish tone (cultural moments vs. urgent action calls).
// Minimum viable for the demo (ERD Slice 2 minimal). Full Slice 2
// (Comment, Reaction, Attachment, dedup) lands post-demo.
//
// App-level invariants:
//   - Posts with visibility='authenticated_only' must be filtered out
//     of any unauthenticated feed render
//   - activistMailerUrl must pass URL validation + domain allowlist
//     at the router layer (not enforced at DB)
//   - groupTags are slugs, not IDs — matches WorkItem convention
//
// onDelete choices:
//   - author: Restrict (cannot hard-delete a user with posts; soft-
//     delete them instead to preserve community history)
model Post { ... }
```

---

## Acceptance criteria

- [ ] `Post` model has all 11 fields specified above, with the right
  types and defaults
- [ ] `PostType` enum has exactly 5 values: dispatch, cultural_moment,
  action_call, news_share, question
- [ ] `PostVisibility` enum has exactly 2 values: public,
  authenticated_only
- [ ] `User` model gets the `posts Post[]` back-reference
- [ ] All 5 indexes on Post as specified
- [ ] Post model has a multi-line comment explaining role, invariants,
  onDelete choices
- [ ] `entityMetadata.post` entry with:
  - `listColumns`: [`title`, `author.displayName`, `type`,
    `visibility`, `createdAt`]
  - `searchableFields`: [`title`, `body`]
  - `defaultSort`: `{ field: 'createdAt', direction: 'desc' }`
  - `requiresRole`: `'admin'` for edit/delete; read-for-all-admins
- [ ] ERD Mermaid diagram updated — Post with its relation to User
- [ ] ERD narrative section "Slice 2 (minimal)" added
- [ ] Smoke test imports Prisma client and asserts Post + PostType +
  PostVisibility types exist
- [ ] `npx prisma validate` passes
- [ ] `npx prisma format` produces no changes
- [ ] `npm run test` passes (existing + new smoke assertion)
- [ ] `npm run lint` passes with zero violations
- [ ] `npm run typecheck` passes
- [ ] `npx prettier --check .` passes
- [ ] File headers include `@build-unit BU-001-prep` (or
  `@build-unit Slice-2-minimal`) and relevant `@spec` annotations

---

## Permission matrix

*(Schema session — matrix is how access will work when features land.)*

| Action | Any visitor | Authenticated member | Post author | Admin |
|---|---|---|---|---|
| View public post | ✓ | ✓ | ✓ | ✓ |
| View authenticated-only post | ✗ | ✓ | ✓ | ✓ |
| Create post | ✗ | ✓ | (N/A) | ✓ |
| Edit post | ✗ | ✗ | (future) | ✓ |
| Soft-delete post | ✗ | ✗ | (future) | ✓ |
| Hard-delete post | ✗ | ✗ | ✗ | ✓ (via admin surface) |
| Restore soft-deleted post | ✗ | ✗ | ✗ | ✓ |

**Note:** edit-own-post and delete-own-post are deferred past the
demo. MVP demo has create + view only.

---

## Entity invariants

| Invariant | How enforced |
|---|---|
| Every post has an author | NOT NULL on `authorId` |
| Author's existence preserved as long as their posts exist | `onDelete: Restrict` on author relation |
| Post visibility defaults to public per D045 | `@default(public)` |
| activistMailerUrl, if present, must be a valid URL from allowlist | Application-level validation in post.create procedure (not DB-level) |
| Soft-deleted posts don't appear in default feed queries | App-level WHERE clause; documented in router when built |
| groupTags are stable slugs, not IDs | Documented; validation that slugs exist is app-level |

---

## Tests required

- **Smoke test assertion** added to `tests/unit/schema.smoke.test.ts`
  — imports `Post, PostType, PostVisibility` from generated Prisma
  client; a simple test that these types exist
- **Prisma validate** — passes
- **Prisma format** — idempotent (no changes produced)

**Not required:**
- Router/service tests — feature code is out of scope
- Integration tests against a real database — no features yet
- UI tests — no UI

---

## Scenarios to verify against

Schema should support these future flows without further changes:

- **Eddie writes a new post** — Post row created with Eddie as author,
  public visibility by default, maybe an AM URL
- **Eddie writes a private cultural moment** — visibility set to
  authenticated_only, type cultural_moment
- **Admin soft-deletes an offensive post** — deletedAt set, post
  disappears from default feed query
- **Eddie adds the "Writers" group tag to a post** — groupTags =
  `['writers']`, future queue filter by group will pick it up
- **Feed query:** `WHERE visibility IN (...) AND deletedAt IS NULL
  ORDER BY createdAt DESC LIMIT 20` — uses the first index
- **Posts by Eddie query:** `WHERE authorId = 'eddie_id' AND
  deletedAt IS NULL ORDER BY createdAt DESC` — uses the second index

---

## Known gotchas

- **GIN index syntax.** Prisma 5.22 supports `@@index([field], type: Gin)`
  — Slice 1.5 confirmed this works. Use it for `groupTags`.
- **Array default syntax.** `@default([])` works for Postgres String[].
- **Visibility enum value names.** `authenticated_only` is more precise
  than `members_only` (avoids ambiguity with group members vs. vetted
  members). Matches D045's language.
- **Do not add Comment/Reaction/Attachment models.** They're in the
  future Slice 2 full brief. Keeping this slice small is a feature.
- **Do not add a draft state.** Compose-and-publish is MVP; drafts are
  a parking-lot item.
- **`body` field is just a string.** No rich-text model, no
  content-type field. Frontend treats it as Markdown in MVP. Different
  formats (rich text, JSON doc, etc.) are a parking-lot concern.
- **Title length.** No DB-level cap. Application-level Zod validation
  will limit it sensibly (e.g., 200 chars). Don't enforce at schema level.
- **`activistMailerUrl` is a raw string.** Not parsed, not validated at
  DB level. Router validates with Zod.

---

## Definition of done

- [ ] All 4 files in "Build" list modified as specified
- [ ] No files in "Don't touch" list modified
- [ ] `npx prisma validate` passes
- [ ] `npx prisma format` produces no changes
- [ ] `npm run test` passes (all previous + new smoke assertion)
- [ ] `npm run lint` passes with zero violations
- [ ] `npm run typecheck` passes
- [ ] `npx prettier --check .` passes (or run `--write` and commit the
  result)
- [ ] File headers include appropriate annotations
- [ ] Mermaid diagram updated and renders correctly
- [ ] Commit message:
  `feat(schema): ERD Slice 2 (minimal) — Post schema for demo path`
- [ ] Branch pushed; PR opened against `main`
- [ ] Open questions populated with any judgement calls

---

## Open questions to surface

Pre-identified. Claude Code, do not make assumptions silently.

1. **`onDelete` for Post.author.** Brief recommends `Restrict`
   (preserves history). Alternatives: `SetNull` (requires nullable
   authorId — rejected), `Cascade` (hard-delete user wipes their
   posts — destroys community history, also rejected). Confirm
   `Restrict` or surface a different view.

2. **`PostType` enum completeness.** Five values proposed:
   dispatch, cultural_moment, action_call, news_share, question.
   Sufficient for the demo? Surface if you spot missing types.

3. **`PostVisibility` enum naming.**
   `public` / `authenticated_only` — feels verbose but unambiguous.
   Alternatives: `public` / `members` (shorter but `members` overloads
   with group members). Stick with `authenticated_only`? Confirm.

4. **Title length enforcement.** Brief says no DB cap; app-level
   Zod limits. Some schemas prefer `@db.VarChar(200)` for explicit
   enforcement. Recommend no DB cap, validated at router. Confirm.

5. **`body` as plain `String` vs. `String @db.Text`.** In Postgres,
   `String` maps to `text` by default in Prisma — same unlimited
   length. No action needed; just note that for reviewer clarity.

6. **File header `@build-unit` value.** `BU-001-prep` (continuing
   Slice 1's tag), `Slice-2-minimal`, or something else? Recommend
   `BU-001-prep` for consistency; Slice 2 minimal still feeds the
   BU sequence. Confirm or revise.

7. **Indexing on activistMailerUrl.** No index proposed. Expected
   queries: none that filter by this field. Confirm no index needed.

8. **Should `groupTags` on Post also apply the "informational only
   in MVP" caveat like WorkItem?** Yes — per D041, groups are tags
   not permission gates. Document this in the model comment.

(Claude Code: add any further judgement calls.)

---

## Context

**Architectural specs:**
- `/docs/architecture/admin-surface.md` — six conventions
- `/docs/architecture/decision-log.md` — D045 (visibility), D041
  (regions/groups as tags), D038 (traceability)
- `/docs/architecture/erd.md` — extend narrative

**Product specs:**
- `/docs/product/post-creation-flow.md` — intended Post structure
- `/docs/product/design-philosophy.md` — honest, quiet, etc.
- `/docs/product/groups.md` — groupTags pattern

**Existing code to extend:**
- `/prisma/schema.prisma` — extend
- `/server/admin/entity-metadata.ts` — extend
- `/tests/unit/schema.smoke.test.ts` — extend

**Process:**
- `/docs/process/session-brief-template.md` — this brief follows it
- `/docs/process/session-hygiene.md` — discipline
- `/CLAUDE.md` — operating context

---

## What this brief does NOT cover

1. **Comment, Reaction, Attachment models** — deferred to Slice 2
   full after demo lands
2. **Dedup fields** (canonicalUrl, dedupGroupId) — Slice 2 full
3. **Post-to-WorkItem relation** for moderation — Slice 3
4. **Boost/remove verdict tracking** — Slice 2 full
5. **Share events, dispatch events** — Slice 4
6. **Partner organisation tagging** — parking-lot "v0.6 absorbing"
7. **PostView model** — post-MVP
8. **Edit history, EditRequest relation** — Slice 3
9. **Draft state** — parking-lot
10. **Feature code** (routers, services, UI) — BU-feed, BU-composer

---

## Slice convention

This session extends the schema, metadata, ERD, and smoke test — same
pattern as Slice 1 and Slice 1.5. No refactor of existing entities;
purely additive. One new model, two new enums, one new relation.

After this slice lands, BU-001-lite can start (it doesn't depend on
Post — but having the schema there means seed data can be written).

BU-feed can follow with Post schema ready.

---

## What lands after this slice

- Post exists in the database
- Admin metadata describes how to render Post in the future admin UI
- ERD is up to date
- Demo path is 1/5 complete — next is BU-001-lite (dev auth stub)
