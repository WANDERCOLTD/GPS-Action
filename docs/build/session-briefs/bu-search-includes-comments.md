---
slug: bu-search-includes-comments
status: shipped
shipped_in: '#283'
phase: 3
priority: medium
---

# SESSION BRIEF · bu-search-includes-comments — Search includes public-thread comments

_Author: Paul + Claude · Created: 2026-05-07 · Type: incremental extension of BU-search-surface (#189) + BU-search-result-cards (#190) + BU-search-includes-kanban (#279)._

---

## Why

`/search` covers Posts, People, Regions, and Tickets. It still doesn't surface **comments**, the texture of the conversation. Sharon types "Hendon" and finds the post about Hendon, but not the thread comment under a different post that crisply summarised what worked. That's where her real institutional memory often lives.

D078 §2 explicitly parked comments behind a privacy review because comment audience is heterogeneous — public thread vs. team-only notes vs. system events. This BU ships **only the public-thread case** (`Comment.kind = 'comment'` AND `Comment.source = 'human'`), gated by the parent post or ticket's existing visibility rules. Notes and system events stay parked.

---

## Build in this session

**Migration**

- `prisma/migrations/<timestamp>_comment_search_indexes/migration.sql` — `gin_trgm_ops` GIN index on `Comment.body`. `IF NOT EXISTS` for idempotency. Mirrors the pattern in `20260503100000_search_trgm_indexes` (Post / User / Region) and `20260507120000_request_search_indexes` (Request).

**Validation**

- `shared/validation/search.ts`: append `'comments'` to `SEARCH_ENTITY_TYPES`.
- `app/api/analytics/search/route.ts`: append `'comments'` to `VALID_ENTITY_TYPES`.

**Service**

- `server/services/search.ts`: new `searchComments(q, callerId, limit)` mirrors `searchPosts` / `searchTickets`. Returns `CommentSearchHit { id, parentKind: 'post' | 'ticket', parentId, parentTitle, parentHref, authorDisplayName, excerpt, createdAt }`.
- **Filter scope:** `Comment.deletedAt: null` + `kind: 'comment'` + `source: 'human'`. `audience` field (if present) clamped to public/network — no internal notes, no system events.
- **Visibility gate:**
  - For comments under **Posts** — the parent post must pass the existing `getPostVisibilityFilter(callerId)` predicate. Reuse the helper, don't duplicate it.
  - For comments under **Tickets** — the parent ticket must be linked via a non-deleted `RequestGroup` to a `Group` the caller has an active `GroupMembership` in. Sysadmins (`RoleGrant.role === 'admin' AND revokedAt IS NULL`) bypass the membership filter, mirroring `searchTickets`.
  - Anonymous callers (`callerId === null`) only get comments under public-visibility posts; never ticket comments.
- `searchAll`: extend `Promise.all` and the result object; `emptyResults` carries `comments: []`.

**Router**

- `server/routers/search.ts`: re-export `CommentSearchHit` for `/app` + `/components`.

**UI**

- `components/SearchHitRows.tsx`: new `SearchCommentHitRow` — `lucide-react` `MessageSquare` glyph + `<post|ticket title>` parent breadcrumb + author byline + body excerpt (clamped ~120 chars) + relative timestamp via `<RelativeTime>`.
- `components/SearchShell.tsx`: append `comments` to `GROUPS` (after `tickets`), wire the row into `ResultList`, extend `EMPTY_RESULTS` and the `totalHits` sum, update placeholder copy.
- `docs/product/design-philosophy.md`: register `message-square` glyph for comment search rows (one-glyph-one-concept rule — already used elsewhere; verify it's in the register, add if missing).

**Tests**

- `tests/unit/search-service.test.ts`: extend prisma mock with `comment.findMany`. New blocks cover: anon → only post-comments under public posts, no ticket comments; member → public posts + their tickets only; sysadmin → all public posts + all tickets; visibility filter applied (delete a post → its comments vanish from search); kind filter (notes excluded); source filter (system events excluded); type filter (`type=comments` runs only the comment query).
- `tests/unit/search-hit-rows.test.tsx`: new `SearchCommentHitRow` block — href to parent + comment anchor, breadcrumb shows parent title, excerpt is clamped, entity_type analytics field.
- `tests/unit/search-shell.test.tsx`: existing tests carry through (added `comments: []` to `emptyResults`).

## Out of scope (park)

- **Internal notes** (`Comment.kind = 'note'`) — separate BU. The visibility model is per-Request originating-team-only and warrants its own brief.
- **System events** (`Comment.source = 'system'`) — parked. Verbose, low search value.
- **Reactions on comments** — separate concern; not a search target.
- **Comment threading depth indicator** in result rows — keep the row flat; clicking jumps to the comment in the parent thread.
- **Cross-comment grouping** ("3 comments on this post mention Hendon") — UI nicety, defer.

---

## Acceptance

- [ ] Migration adds GIN trigram index on `Comment.body` (idempotent).
- [ ] Search caller for "hendon" with a non-member returns post-comments under public Posts only; no ticket-comments.
- [ ] Same query for a member of the ticket's group returns the ticket-comments too.
- [ ] Sysadmin sees comments across every visible parent (still respecting `Post.visibility` and `Comment.kind/source` filters).
- [ ] Comment under a soft-deleted Post is not returned (the Post visibility filter handles this implicitly).
- [ ] Internal notes (`kind: 'note'`) and system events (`source: 'system'`) are NEVER returned, regardless of caller role.
- [ ] `/search?q=hendon&type=comments` full-mode renders the comments group only.
- [ ] Result row click lands on the parent's URL with a comment anchor — feed comment threading already supports `#comment-<id>` (verify; if not, the row links to the parent and surfaces the comment via natural scroll).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] `package.json` PATCH bumped.

## Status

Ready.
