# `comment` service

Flat discussion thread on a post. Create, list, bulk-count. Per
SCN-20 + D052.

**Build Unit:** BU-comments
**Spec:** `docs/architecture/decision-log.md` (D052)

## What it exposes

- `createComment({ postId, body, authorId })` — verifies the
  parent post is visible to the author, creates the row, writes
  an audit entry. Returns `{ id }`.
- `listCommentsForPost({ postId, callerId })` — oldest-first
  (chronological reading order per SCN-20). Soft-deleted excluded.
  Visibility-respecting at the parent post level: unauthed callers
  only see comments on `public` posts.
- `listCommentCountsForPosts({ postIds })` — bulk count for the
  feed. Single `groupBy postId` query — used by `post.listPosts`
  to populate the `commentCount` field per card without N+1.

## What it does NOT do

- **Threading** — flat thread only. `parentCommentId` is parking-lot.
- **Edit / delete** — no UI. The `deletedAt` column exists for
  future use; manual DB / admin patch is the escape hatch.
- **Reactions on comments** — schema-ready (per D050 + D052), no UI.
- **Notifications** — out of scope (design-philosophy principle 3).
- **System / auto-comments** — those will be added by future BUs
  (BU-dispatch, BU-flag, BU-outcome-review). The schema accepts
  them; no producer exists yet.
- **Pagination** — load all for MVP. Cursor pagination is a future
  polish item.

## Layer rules

- Imports: `@/server/db/client`, `@/server/services/audit` only
- Imported by: `server/routers/comment.ts`, `server/services/post.ts`
  (the bulk count for feed render)
- Boundaries plugin allows `services → db, lib, shared, services`
