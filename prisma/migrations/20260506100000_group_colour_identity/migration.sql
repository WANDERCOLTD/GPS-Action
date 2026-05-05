-- bu-group-identity / ADR-0013
--
-- Adds the curated 12-name colour palette enum + Group.colourKey
-- column. Existing rows are backfilled round-robin by createdAt
-- order so the distribution is flat without any manual curation.
--
-- New group creates flow through server/services/group.ts →
-- assignNextColourKey(), which picks the least-recently-used name
-- among non-soft-deleted groups. The schema-level @default(slate)
-- is a safety net for a code path that bypasses the service; the
-- normal create path always passes an explicit colourKey.
--
-- Forward-only. Reversible by dropping the column and the enum;
-- not expected.

-- CreateEnum
CREATE TYPE "GroupColourKey" AS ENUM ('slate', 'rust', 'moss', 'plum', 'ochre', 'teal', 'indigo', 'coral', 'sage', 'amber', 'rose', 'stone');

-- AddColumn (with the schema default; backfill below overrides for existing rows)
ALTER TABLE "Group" ADD COLUMN "colourKey" "GroupColourKey" NOT NULL DEFAULT 'slate';

-- Backfill: assign existing groups round-robin in createdAt order.
-- Deterministic — same `createdAt` ordering always yields the same
-- assignment, so dev resets land on the same colours.
WITH ordered AS (
  SELECT
    "id",
    (ARRAY['slate','rust','moss','plum','ochre','teal','indigo','coral','sage','amber','rose','stone']::"GroupColourKey"[])
      [((ROW_NUMBER() OVER (ORDER BY "createdAt", "id") - 1) % 12) + 1] AS "next"
  FROM "Group"
)
UPDATE "Group" g
SET "colourKey" = ordered."next"
FROM ordered
WHERE g."id" = ordered."id";
