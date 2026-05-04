# ADR-0010 · `Request.type` becomes nullable (kanban tickets carry `null`)

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** Paul (product), Claude Code (this session)

## Context

The `bu-coordination-board` brief originally said "drop
`Request.requestType` (every ticket is just a ticket)". On
inspection during the build, this turned out to be ambiguous:
the actual schema field is `Request.type`, of enum
`RequestType` with 9 values — and **all 9 values are still in
active use** by non-kanban surfaces:

- `vetting` — member admission flow
- `flag` — content moderation flow
- `kind_review` — post-kind moderation (D071)
- `outcome_review`, `dedup_merge`, `edit_request`, `incident`,
  `content_submission`, `link_submission` — various reviewer
  flows

Dropping the column or the enum would break every one of those
surfaces. The brief's "every ticket is just a ticket" line
referred to the **kanban view**, not the data model.

## Decision

We make `Request.type` **nullable** (Option B). Three readings
were considered during session 4 and Paul chose B:

| Reading | Means                                  | Consequence                                                                     |
| ------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| A       | Drop the column entirely               | Vetting / flag / kind_review etc. break — non-trivial migration                 |
| B       | Keep column, make it nullable          | Kanban tickets have `type = null`; legacy flows keep their type. Additive, safe |
| C       | Keep column, drop only specific values | Doesn't make sense — values are still in use                                    |

Schema:

```prisma
model Request {
  // …existing fields
  type RequestType?  // nullable; kanban tickets write null, legacy flows write a value
}
```

Migration: `ALTER TABLE "Request" ALTER COLUMN "type" DROP NOT NULL;`

No data migration: existing rows keep their non-null values.
Future rows authored from the kanban surface will carry `null`.

## Reasoning

- **Additive, no behavior break.** Existing code that reads
  `Request.type` continues to work for legacy rows. The kanban
  surface (which produces `type = null` rows) doesn't render
  through `/requests` — it has its own routes.
- **Reviewer queue filter still works.** The reviewer-queue
  filter (`server/services/request.ts::listRequestsForReviewer`)
  already filters by `{ type: { in: scopedTypes } }` — kanban
  tickets with `type = null` naturally fall out, which is the
  desired behavior (kanban tickets aren't reviewer queue items).
- **Discovery scope masking is a non-issue.** Pages under
  `/requests` (`page.tsx`, `[id]/page.tsx`) only render rows
  that pass the queue filter; kanban tickets never reach them.
- **No ADR for the original drop.** The brief had this as a
  bullet but no ADR formalized the change. This ADR fills the
  gap and locks Option B.

## Consequences

- **Easier:**
  - Kanban surface writes `Request` rows with `type = null` and
    relies on `RequestGroup.origin = originating` (per ADR-0009)
    for "which group does this belong to."
  - The 9-value enum stays in active use; no migration of
    existing rows.

- **Harder:**
  - TypeScript: every `Request.type` reader now sees
    `RequestType | null`. Consumers that statically index a
    label/tone map (`TYPE_LABELS[row.type]`) need a null guard
    or a caller-side filter.
  - Service-level `RequestListItem.type` becomes
    `RequestType | null`.

- **Forward-only.** Pure additive nullability change. Reversible
  by filling all rows with a default and re-applying NOT NULL,
  but no plan to do so.

## Notes

- This ADR supersedes the brief's earlier "drop
  `Request.requestType`" line, which was applied to v0.4 of the
  brief on 2026-05-04 alongside this ADR.
- The build-sequence tracker (PR #2g) calls this chunk **2g.1**;
  follow-up chunks are 2g.2 (drop `claimedByUserId`) and 2g.3
  (`RequestStatus` reframe).

## Related

- ADR-0005 — `RequestStatus` redesign (2g.3 will reframe).
- ADR-0009 — `RequestGroup`. Kanban tickets carry their group
  context in `RequestGroup` rows, not in `Request.type`.
- D058 — `Request.urgency` (urgent flag survives this change
  unchanged; it's an orthogonal flag).
- bu-coordination-board v0.4 — the brief's section
  "Field changes — Request" already records this resolution.
