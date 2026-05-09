# ADR-0016 · Comment edit/delete scope — Request comments only, Posts stay immutable

**Status:** Accepted
**Date:** 2026-05-09
**Deciders:** Paul

## Context

D052 ("Comment schema + polymorphic reuse of ReactionTargetType",
2026-04-26) shipped the `Comment` primitive for BU-comments. Its
§3 — "No edit / delete UX in MVP" — said:

> Authors cannot edit or delete their own comments. Coordinators
> cannot remove or pin comments. These all land later (BU-flag /
> BU-admin / a dedicated edit-window BU). The `deletedAt` column
> exists for future use; manual DB / admin-patch is the escape
> hatch if a comment must be removed urgently.

That decision was scoped to BU-comments — the feed/post-detail
discussion thread, where the social contract is **broadcast +
discussion**: a comment is published into a public-ish room, and
silently rewriting it after the fact distorts the record everyone
already read.

Since then, BU-coordination-board layered a **second consumer** onto
the same `Comment` model: the kanban ticket-detail thread on
Requests. Schema is polymorphic — exactly one of `postId` /
`requestId` is non-null per row (see `prisma/schema.prisma` lines
1005–1053). That means D052's "no edit / no delete" applies, today,
to both surfaces by default.

Tester feedback on `bu-ticket-view-fixes` (2026-05-08):

> "I want to edit and at least delete my comments and notes."

User decision (2026-05-09): the tester is right for the **Request**
surface and wrong for the **Post** surface. The two surfaces have
different social contracts:

| Surface | Contract                              | Edit / delete? |
| ------- | ------------------------------------- | -------------- |
| Post    | broadcast + public discussion         | no (D052)      |
| Request | working coordination on a live ticket | yes            |

A coordinator typing a quick note onto a kanban ticket needs the
same affordances as a Trello / Notion comment: fix typos, retract
a wrong claim, delete the row entirely if it was misposted.
Immutability there is friction without upside — the audience is the
small set of teams linked to the ticket, not the network.

The `Comment` model is shared. Therefore the gate has to live in
code (router + service), not in schema separation.

## Options considered

- **A. Lift D052 entirely — allow edit/delete on all comments.**
  Simple. Breaks the post-discussion contract. Rejected.
- **B. Split `Comment` into `PostComment` and `RequestComment` models.**
  Cleanest separation but a multi-week migration that touches
  reactions (D050/D052 polymorphic shape), audit, notifications,
  search. Wildly out of proportion to the tester's ask. Rejected.
- **C. Keep one `Comment` model, gate edit/delete on `requestId !== null`
  in router + service.** Defence-in-depth, tiny surface change,
  reuses existing audit infra. Selected.

## Decision

### 1. Allow edit + hard-delete on Request comments only

- **Author-only.** Only `comment.authorId === ctx.user.id` may edit
  or delete. System admins are out of scope for v1 (admin moderation
  paths are a separate BU; not blocked by this ADR).
- **No time window.** A coordinator can edit or delete any of their
  own comments at any time. The "5 minute edit window" pattern was
  rejected — it adds UI complexity without a real harm story on a
  small private working surface.
- **Hard delete.** The row is removed from the DB. v1 does not write
  a soft-delete tombstone (`deletedAt`) for the user-initiated path.
  The `deletedAt` column on `Comment` stays — it is still used for
  cascade and admin paths — but `comment.deleteOwn` does a real
  `DELETE`.
  - If product evidence later demands "deleted by author" tombstones
    (e.g. for thread-coherence reasons in long-running tickets),
    soft-delete can be added behind a feature flag without a schema
    change.
- **`edited` marker.** When `updatedAt > createdAt + small epsilon`,
  the UI renders a subtle "(edited)" tag next to the timestamp.
  Schema already has `updatedAt` from D052; no new column needed.

### 2. Post comments remain immutable per D052

No edit, no delete on `postId`-targeted comments. Admin /
moderation removal paths are out of scope for this ADR — they
remain whatever D052 said (manual DB / admin-patch).

### 3. Implementation gate — defence in depth

Two new mutations land on the comment surface:

- `comment.editOwn` — body update on a Request comment the caller
  authored.
- `comment.deleteOwn` — hard delete on a Request comment the caller
  authored.

Both gates are enforced **twice**:

1. **Router** (`server/routers/comment-thread.ts` is the natural
   home — these are kanban-thread mutations even though they read
   the same model). Reject early if `comment.requestId === null`
   (i.e. it's a post comment) or if `comment.authorId !== ctx.user.id`.
2. **Service** (`server/services/comment-thread.ts`). Same checks,
   independent of router state. A future caller (admin tooling,
   batch script, second router) cannot bypass the gate by going
   round the router.

The author check is a strict equality on `authorId`. The Request
check is `comment.requestId !== null && comment.postId === null`.

`comment.audience === 'reviewers'` (D056) and `kind === 'note'`
(coord-board) inherit the same edit/delete rules as regular Request
comments — they're already gated to the originating-team viewer at
the read layer; allowing the author to edit/delete their own does
not change visibility scope.

System-authored rows (`source === 'system'`, e.g. kanban transition
events) are **never editable or deletable** via this surface,
regardless of `requestId`. The author check fails by construction
(system rows are authored by a synthetic system user; the live
caller will not match). The router rejects on `source !== 'human'`
as a belt-and-braces second check.

### 4. Audit trail

Edit and delete log to the existing `AuditLog` table (see
`prisma/schema.prisma` lines 548–574). New action codes:

- `kanban_comment.edit` (or `kanban_note.edit` when `kind = 'note'`)
- `kanban_comment.delete` (or `kanban_note.delete` when `kind = 'note'`)

Reuses the existing `auditLog(...)` helper already used by
`createCommentForKanbanTicket` in `server/services/comment-thread.ts`.
The audit captures `commentId`, `requestId`, `kind`, and (for
edits) the previous + new body lengths. **Audit content is
internal-only** — not user-visible in v1; not exposed to
coordinators or other ticket viewers. Investigators / sysadmins
read the audit table directly.

No new schema. The build session may surface a desire for a
dedicated `CommentAudit` table later if `AuditLog` becomes a hot
spot; out of scope here.

### 5. UI surface

Edit / delete affordances render **only on the Request comment view**
(coord-board ticket detail panel — the `<CommentItem>`-equivalent
for kanban tickets). The conditional is the parent target type:

```ts
const canMutate =
  comment.requestId !== null && comment.authorId === viewerUserId && comment.source === 'human';
```

`<CommentItem>` rendered on the post-detail page (`/post/[id]`) —
the BU-comments surface — does not render the affordances. There is
no UI path to call `comment.editOwn` / `comment.deleteOwn` from a
Post comment, and even if a caller crafted a tRPC request directly,
the router gate rejects it.

## Reasoning

- **The shared `Comment` model is correct and should not be split.**
  The polymorphism unlocked clean reuse of the Reaction primitive
  (D052 §2) and the kanban thread (ADR-0007). Splitting it now to
  serve a UX delta would be a giant footprint change for a tiny
  product change.
- **Author-only, no-window, hard-delete is the right tradeoff for
  Request comments.** This is a private working surface among a
  handful of coordinators. The cost of "I edited my note 20
  minutes ago" is zero; the cost of "I can't fix the typo" is real
  daily friction.
- **Defence-in-depth gating.** The `Comment` model is reachable from
  multiple routers (post discussion, kanban thread, future admin
  tooling). Putting the gate only in the router means a second
  router could bypass it. Putting it in the service too means the
  invariant survives router refactors.
- **Honest UI.** Showing "(edited)" — rather than silently mutating
  — preserves the small amount of social trust the surface needs.
- **Audit, not soft-delete.** Hard delete keeps the read path simple
  (no `deletedAt IS NULL` predicate to maintain across all kanban
  thread queries). The audit log preserves recoverability for the
  rare investigation case.

## Consequences

- **Different UX between Post comments and Request comments.** This
  is intentional: one surface is broadcast, the other is working
  coordination. The asymmetry is documented in this ADR + D052 +
  the brief that builds it.
- **D052 §3 is now narrower.** Its "no edit / delete UX in MVP"
  language applies to Post comments only; Request comments are
  addressed by this ADR. D052 stays in force for the Post surface.
- **New router mutations.** `comment.editOwn` and `comment.deleteOwn`,
  housed in `comment-thread.ts` (the kanban thread router) — not in
  `comment.ts` (the post-discussion router) — to make the surface
  scoping unambiguous.
- **No schema change.** `updatedAt` already exists; `AuditLog` already
  exists; no migration.
- **Future soft-delete is non-breaking.** If product evidence later
  asks for "deleted by author" tombstones, add a feature flag
  (`ff_request_comment_soft_delete`) that diverts `deleteOwn` to
  set `deletedAt` instead of hard-deleting. Read filters on
  `comment-thread` already exclude `deletedAt: { not: null }`.
- **Future system-comment editability stays closed.** The
  `source !== 'human'` check forecloses a class of bug where a
  refactored system-event writer could be re-targeted as a regular
  comment and become editable.

## Notes

Schema check performed for this ADR:

- The `Comment` model is **polymorphic via two nullable FKs**, not a
  `targetType` discriminator: `postId String?` + `requestId String?`,
  with the app-level invariant that exactly one is non-null
  (`prisma/schema.prisma:1005–1053`). The gate uses `requestId !== null`
  (or equivalently `postId === null`), not a string discriminator.
  This shape was set by BU-requests-vetting (predates ADR-0007).
- The polymorphism includes additional discriminators relevant to
  future moderation: `audience` (D056 — `all` vs `reviewers`),
  `kind` (ADR-0007 — `comment` vs `note`), `source` (ADR-0007 —
  `human` vs `system`), and `systemKind` (D071). The edit/delete
  gate intersects with `source` (system rows are not editable) but
  not with `kind` or `audience` (notes and reviewer-audience
  comments are author-editable like any Request comment).
- The two routers handling Comment today are
  `server/routers/comment.ts` (post-detail thread, BU-comments) and
  `server/routers/comment-thread.ts` (kanban ticket thread,
  BU-coordination-board). The new mutations live in the latter.

## Related

- **Clarifies (does not supersede)** D052 — Comment schema +
  polymorphic reuse of ReactionTargetType. D052's §3 immutability
  rationale is preserved for Post comments; this ADR scopes its
  applicability.
- ADR-0007 — Coord-board `Comment.kind` + `Comment.source`
  (the discriminators that disambiguate kanban rows; also defines
  the system-event hook that this ADR forecloses from edit).
- D056 — Comment audience (`all` / `reviewers`); inherits the gate.
- D071 — `Comment.systemKind`; system-authored rows are not
  edit/delete targets via this surface.
- Tester feedback driving this: `bu-ticket-view-fixes` —
  "I want to edit and at least delete my comments and notes."
