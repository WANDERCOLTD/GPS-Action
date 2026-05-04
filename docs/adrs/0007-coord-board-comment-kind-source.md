# ADR-0007 · `Comment.kind` and `Comment.source` for ticket-detail thread

**Status:** Accepted (additive; coexists with `audience` and `systemKind` until consolidation)
**Date:** 2026-05-04
**Deciders:** Paul (product), Claude Code Session A (schema PR)

## Context

Surface 2 (Ticket detail) interleaves three kinds of entries in
one thread:

1. **Comments** — visible to anyone who can view the ticket.
2. **Internal notes** — visible only to members of the working
   group; never shown to external sharers (other groups the
   ticket has been shared to).
3. **System events** — auto-generated transitions ("Sharon
   assigned herself", "Status moved to Implementation").

The current `Comment` model already carries two adjacent
discriminators:

- `audience: CommentAudience` (`all | reviewers`) — D056, used
  by the vetting flow's reviewer-only comments.
- `systemKind: CommentSystemKind?` — D071, used by the post-
  review attribution auto-comment.

Both come close to what the kanban needs but neither fits
exactly:

- `audience: reviewers` is a **vetting-flow** carve. The kanban's
  "internal note" is a **per-group** carve (visible to the
  owning group, hidden from cross-team sharers via
  `RequestGroup`). The semantics aren't identical even if the
  visibility outcome looks similar.
- `systemKind` is enum-typed with one value (`post_review_attribution`); kanban system events
  are heterogeneous (status transitions, assignment changes,
  urgent flips). Listing each as a `systemKind` value bloats
  the enum with kanban-specific concerns.

The brief proposes two new fields on `Comment`:

- `kind: CommentKind` (`comment | note`) — the comment-vs-note
  visibility carve.
- `source: CommentSource` (`human | system`) — author source.

This ADR records the additive shape and explains why we keep
the existing fields in place rather than collapse.

## Options considered

- **Option A — Add `kind` and `source` as new fields; keep
  `audience` and `systemKind` for their existing flows.** Both
  pairs run alongside; service code dispatches on the right
  field per surface. Long-term consolidation is parking-lot
  worthy but not urgent.
  - Pros: zero risk to vetting / post-review flows. Truly
    additive PR. Each surface reads the field that means what
    it needs.
  - Cons: two pairs of fields with overlapping semantics. New
    contributors must learn which to read in which context.

- **Option B — Reuse `audience` for `kind`.** Add a third value
  `audience: team` to mean "internal note." Drop the separate
  `kind` proposal.
  - Pros: one less field on `Comment`.
  - Cons: `team` is incoherent in the vetting flow context
    (whose team?). Code that switches on `audience` would have
    to handle `team` differently per parent type
    (Post.audience vs Request.audience). Conflates two
    visibility models.

- **Option C — Reuse `systemKind` as the source discriminator.**
  Treat `systemKind = null` as `source = human`, non-null as
  `source = system`. Add new `systemKind` enum values for each
  kanban event type.
  - Pros: no new field.
  - Cons: `systemKind` is meant to discriminate **the kind** of
    system comment (for special UI rendering). Kanban events
    are many and varied; bundling them into one enum couples
    UI rendering to a long enum that grows with every new
    event type. Source-vs-kind separation is the cleaner cut.

- **Option D — Collapse aggressively now: drop `audience` and
  `systemKind`, replace with `kind` and `source`.** Migrate
  existing `audience: reviewers` to `kind: note` and
  `systemKind: post_review_attribution` to `source: system` plus
  a new `eventKind` field.
  - Pros: clean schema after migration.
  - Cons: breaking change for vetting + post-review code paths;
    requires this PR to also rewrite those services. Defeats
    the additive-only PR-#1 plan.

## Decision

We adopt **Option A**: add `kind` and `source` as additive
fields. Keep `audience` and `systemKind` in place.

```prisma
enum CommentKind {
  comment
  note
}

enum CommentSource {
  human
  system
}

model Comment {
  // …existing fields (postId, requestId, authorId, body, audience, systemKind, …)
  kind   CommentKind   @default(comment)
  source CommentSource @default(human)
}
```

Defaults: `kind = comment`, `source = human`. Existing rows
take the defaults via the migration; existing system-authored
comments (i.e. `systemKind != null`) get `source = system` via
a one-line UPDATE in the same migration.

Service-layer dispatch (PR #2):

| Surface           | Reads           | Writes          |
| ----------------- | --------------- | --------------- |
| Vetting reviewers | `audience`      | `audience`      |
| Post-review attr. | `systemKind`    | `systemKind`    |
| Ticket detail     | `kind`+`source` | `kind`+`source` |

A future BU may consolidate (e.g. drop `audience` once vetting
migrates to `kind`); that's a separate ADR with its own data
migration.

## Reasoning

- **The new metaphor is genuinely different.** `kind` describes
  _what the comment is_ (a public comment vs a team-internal
  note). `audience` describes _who the comment is for in a
  workflow_ (submitter+reviewer vs reviewer-only). The kanban
  doesn't have "reviewers" as a concept — every group member
  is on equal footing. Forcing the kanban to read `audience`
  would import vetting's role model into a place that doesn't
  share it.
- **System-event variety.** Kanban events include assignment,
  unassignment, status transition, urgent flip, share-with-team.
  Cardinality is open. `source = system` plus a future
  `eventKind` (or just rendering on the body content) is
  cheaper than enumerating every event type into `systemKind`
  forever.
- **Additive is genuinely safe.** Adding two enum-typed fields
  with sane defaults can't break any existing reader. Vetting
  code that reads `audience` is unaffected by the new fields'
  existence. Post-review attribution code that reads
  `systemKind` is unaffected.
- **Document the overlap.** This ADR exists in part to make
  the "two pairs" choice explicit so future contributors don't
  mistake it for accidental. A consolidation ADR can come
  later if usage patterns warrant.

## Consequences

- **Easier:**
  - Ticket-detail thread can render and filter on `kind`
    without touching vetting code.
  - System events ride the existing `Comment` table with no
    new entity (interleaved render is a single ORDER BY).
  - PR #1 stays additive.

- **Harder:**
  - Two pairs of overlapping discriminators. New contributors
    need the dispatch table above (or this ADR) to know which
    to read.
  - If we eventually consolidate, we owe a migration.
    Documented as parking-lot.

- **Forward-only migration.** Two enums + two columns + a
  back-fill UPDATE for the system-comment defaulting. No data
  loss; no destructive change.

## Notes

- A future ADR (parking-lot candidate) may consolidate
  `audience` into `kind` and `systemKind` into a finer-grained
  `source` discriminator. Until then, the dispatch table above
  is the contract.
- `Comment.source = system` rows are written by service code
  only (kanban transition events). Members can author
  `source = human` rows of either `kind` (`comment` or `note`).
- "Note" rows are visible to members of the **owning** group
  (the originating `RequestGroup` or the group the assignee
  is in). Visibility in cross-team-shared scenarios is per
  ADR-0009's permission envelope. PR #2 implements the
  visibility filter at the service layer.

## Related

- D052 — `Comment` model (BU-comments).
- D056 — `Comment.audience` (vetting reviewer-only).
- D071 — `Comment.systemKind` (post-review attribution).
- ADR-0009 — `RequestGroup` per-group visibility envelope.
- bu-coordination-board v0.4 — Surface 2 spec.
