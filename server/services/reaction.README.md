# `reaction` service

Quiet, multi-select reactions on posts. Toggle add / toggle remove /
aggregate read. Polymorphic `targetType + targetId` so the same
primitive will cover comments when BU-007 lands.

**Build Unit:** BU-reactions
**Spec:** `docs/architecture/decision-log.md` (D050)
**Scenario:** SCN-3 (David / Shabbat post) in
`docs/product/scenarios.md`

## What it exposes

- `addReaction({ postId, emoji, userId })` — idempotent on
  unique-constraint collision (re-react with same emoji is a no-op).
  Writes an audit entry.
- `removeReaction({ postId, emoji, userId })` — idempotent (removing
  a row that isn't there is also success). Writes an audit entry
  only when something was actually deleted.
- `listReactionsForPost({ postId, callerId })` — aggregate counts
  per emoji, sorted by count desc with enum-order tiebreak.
  `mine: true` only for emoji the caller has reacted with;
  callerId=null returns mine: false everywhere.
- `listReactionsForPosts({ postIds, callerId })` — bulk variant
  used by the feed to avoid N+1 — single `groupBy` query, joined
  per-post in service code.

## What it does NOT do

- Notify on receiving a reaction (per design-philosophy.md
  principle 3 — no anxiety amplification)
- Expose a "who reacted" per-user list (privacy default)
- Support comment targets yet (`comment` value in
  `ReactionTargetType` lands with BU-007)
- Fire analytics — the brief notes the `reaction_added` event lives
  in this service, but no analytics writer exists yet codebase-wide;
  add when the analytics infrastructure lands

## Layer rules

- Imports: `@/server/db/client`, `@/server/services/audit` only
- Imported by: `server/routers/reaction.ts`, `server/services/post.ts`
  (the bulk variant for feed render)
- Boundary plugin allows `services → db, lib, shared, services`
