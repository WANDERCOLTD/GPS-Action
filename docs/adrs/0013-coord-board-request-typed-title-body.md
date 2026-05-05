# ADR-0013 · `Request.title` + `Request.body` — typed first-class fields

**Status:** Accepted
**Date:** 2026-05-05
**Deciders:** Paul (product), Claude Code (this session)

## Context

Surface 1 of bu-coordination-board (PR #4d, v0.2.94) shipped a kanban
view that reads each card's display title from
`request.context.title` — an untyped JSON-blob key — with a
`'(Untitled)'` fallback when the key is missing or the wrong shape.
The handoff for that PR flagged the choice as a punt: editable
description and editable title are explicit Surface 2 scope per the
brief, and editing JSON-blob string keys is the wrong shape for an
audited write path.

Surface 2 (ticket detail, PR #5 in the brief) needs:

- An editable title (`Request.title`), audit-logged.
- An editable body (`Request.body`), audit-logged.
- A read query (`getTicketDetail`) that returns a stable typed shape
  to the page.

The two viable options:

- **Option A — typed columns.** Add `Request.title` and
  `Request.body` to the schema, with a forward-only migration that
  back-fills from `context.title` / `context.body`. Future writes
  go to the typed columns; `context` keeps any per-type payload
  that doesn't generalise.
- **Option B — keep the JSON blob.** Continue reading and writing
  `context.{title,body}` as untyped strings. No schema change.

## Decision

Go with **Option A**. Add typed `title` and `body` columns to
`Request`, back-fill from `context` keys in the same migration,
and swap the kanban read in PR #5a from `context.title` to
`request.title`.

```prisma
model Request {
  // …
  /// Display title for kanban tickets and any future first-class
  /// surfaces. Sentinel default keeps NOT NULL safe for any rows
  /// that slip past the migration's back-fill (legacy Request rows
  /// without context.title pre-existing this ADR). Surface 2's
  /// title-edit field writes here.
  title String @default("(Untitled)")
  /// Editable description body. Nullable: an empty body means the
  /// author has not yet written one. Surface 2's editable description
  /// field writes here.
  body  String?
}
```

### Migration shape

`prisma/migrations/20260505100000_request_typed_title_body/migration.sql`:

```sql
-- ADR-0013 — typed Request.title + Request.body
--
-- Adds the columns, back-fills from existing context JSON keys, and
-- enforces NOT NULL on title once the back-fill is complete.

-- 1. Add columns. title is nullable initially so the back-fill
--    can populate it before the NOT NULL constraint is applied.
ALTER TABLE "Request" ADD COLUMN "title" TEXT;
ALTER TABLE "Request" ADD COLUMN "body"  TEXT;

-- 2. Back-fill from context JSON. Idempotent: re-running on rows
--    that already have title/body populated is a no-op (the
--    coalesce keeps the existing value when present).
UPDATE "Request"
SET
  "title" = COALESCE(
    "title",
    NULLIF(context->>'title', ''),
    '(Untitled)'
  ),
  "body" = COALESCE(
    "body",
    NULLIF(context->>'body', '')
  );

-- 3. Apply NOT NULL + default to title (body stays nullable).
ALTER TABLE "Request" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "Request" ALTER COLUMN "title" SET DEFAULT '(Untitled)';
```

The back-fill is idempotent in the D070 sense: each `UPDATE` row
ends in the same state regardless of how many times the statement
runs, because `COALESCE("title", …)` short-circuits on the first
non-null term.

### Consumer migration

- `server/services/board.ts · listBoardCardsForGroup` swaps from
  reading `request.context.title` (with the `'(Untitled)'` runtime
  fallback) to reading `request.title` directly. The runtime
  fallback is dropped because the DB-level sentinel default
  (`'(Untitled)'`) covers any row missing a real title.
- `server/services/board.ts · getTicketDetail` (new in this PR)
  returns `title` and `body` as typed strings from the typed
  columns.
- `context.title` and `context.body` are deprecated as authoritative
  keys. They are not removed from existing rows in this PR — the
  data is harmless and unused once consumers stop reading it. A
  later cleanup migration may strip them.

## Reasoning

- **Editability needs a typed write path.** Surface 2's title and
  description edits are audit-logged user actions. Auditing a
  JSON-blob mutation is awkward: the diff has to compare nested
  keys, and typo / shape drift becomes silent. Typed columns turn
  it into a plain `UPDATE` with a clean before/after diff for the
  audit row.
- **The JSON blob still has a job.** `context` keeps per-type
  payload for non-kanban Request flows (vetting, `kind_review`,
  `dedup_merge`, …) where the shape varies per `requestType`. We
  are removing two specific keys from `context`'s job
  description, not removing the column.
- **Sentinel default keeps the constraint safe.** The migration
  back-fill catches the common case (rows with `context.title`).
  Sentinel default catches the long tail (rows with no title at
  all in any form) without forcing the migration to fail.
- **`body` nullable, `title` NOT NULL.** A ticket without a title
  is meaningless (the kanban card has nowhere to render). A ticket
  without a body is fine — it's the default state of a freshly
  created kanban ticket before the description is filled in.

## Consequences

- **Easier:**
  - `getTicketDetail`, `Card.tsx`, and any future ticket-shape
    consumers read typed strings, not nested JSON keys.
  - Audit log entries for title/body edits have a clean shape
    (`changes: { title: { from: …, to: … } }`).
  - Type errors at compile time when consumers read a missing or
    misspelled key — `request.titel` doesn't compile; `(request.context as any).titel` did.

- **Harder:**
  - Two writers exist transiently: any legacy code path that still
    writes `context.title` becomes a silent no-op for display. We
    grep for `context.title` / `context.body` in this PR and update
    every writer in the same commit. The grep result is small —
    only the test fixture and the kanban service itself read
    `context.title` today.
  - Migration is forward-only. Reversing would require dropping the
    columns; the back-fill would not be undoable.

- **Forward-only with sentinel.** The sentinel default covers the
  edge case of a ticket created via a code path that doesn't set a
  title. Surface 2's edit affordance gives members a way to replace
  `'(Untitled)'` with something meaningful.

## Notes

- The brief (bu-coordination-board v0.4) does not list
  `Request.title` / `Request.body` in its consolidated schema-
  additions block — it implicitly assumed the fields existed (the
  Surface 2 description references `Request.body` directly). This
  ADR closes that gap.
- The Surface 1 PR (#4d) shipped `BoardCard.title: string` returned
  from the service. The shape doesn't change — only the read path
  inside the service.
- Composer paths that create new kanban tickets in later BUs will
  write directly to `Request.title` / `Request.body`. No code in
  this PR creates kanban tickets; the migration alone is enough
  to make `getTicketDetail` correct for existing rows.

## Related

- ADR-0005 — `RequestStatus` redesign (PR #2g.3 / ADR-0012 executed it).
- ADR-0006 — `BoardColumn` carries workflow placement.
- ADR-0010 — `Request.type` nullable (kanban tickets carry `null`).
- ADR-0011 — drop claim trio (replaced by `Assignment`).
- ADR-0012 — `RequestStatus` enum reframe.
- D070 — reference data + idempotent migrations.
- bu-coordination-board v0.4 — Surface 2 (ticket detail).
- Handoff `bu-coordination-board-2026-05-04c.md` — flagged this
  punt under "Title field convention is unresolved."
