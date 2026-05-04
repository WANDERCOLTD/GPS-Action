-- bu-coordination-board / PR #2g.1 — Option B (ADR-0010)
--
-- Make `Request.type` nullable. Kanban tickets created from the
-- coordination board surface (forthcoming) write `type = NULL`;
-- existing reviewer-queue Requests keep their non-null values
-- (vetting / flag / kind_review / outcome_review / dedup_merge /
-- edit_request / incident / content_submission / link_submission).
--
-- No data migration: existing rows are unaffected. The constraint
-- relaxation is purely additive.
--
-- See docs/adrs/0010-coord-board-request-type-nullable.md for the
-- full decision record.

ALTER TABLE "Request" ALTER COLUMN "type" DROP NOT NULL;
