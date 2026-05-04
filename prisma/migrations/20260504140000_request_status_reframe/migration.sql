-- bu-coordination-board / PR #2g.3 — ADR-0012
--
-- Reframe RequestStatus from
--   unclaimed | claimed | in_review | resolved | abandoned
-- to
--   backlog | active | done | abandoned
--
-- Mapping (confirmed with Paul 2026-05-04):
--   unclaimed → backlog
--   claimed   → active
--   in_review → active
--   resolved  → done
--   abandoned → abandoned
--
-- Postgres has no DROP VALUE for enums, so we use the swap pattern:
-- create a new enum, cast the column with a USING clause that maps
-- legacy values, drop the old enum, rename the new one into place.

-- 1. Create the new enum with only the target values.
CREATE TYPE "RequestStatus_new" AS ENUM ('backlog', 'active', 'done', 'abandoned');

-- 2. Drop the old default (typed against the OLD enum) before the cast.
ALTER TABLE "Request" ALTER COLUMN "status" DROP DEFAULT;

-- 3. Cast every row, mapping legacy values via the table above.
ALTER TABLE "Request"
  ALTER COLUMN "status" TYPE "RequestStatus_new"
  USING (
    CASE status::text
      WHEN 'unclaimed' THEN 'backlog'
      WHEN 'claimed'   THEN 'active'
      WHEN 'in_review' THEN 'active'
      WHEN 'resolved'  THEN 'done'
      WHEN 'abandoned' THEN 'abandoned'
    END::"RequestStatus_new"
  );

-- 4. Drop the old enum + rename the new one into place.
DROP TYPE "RequestStatus";
ALTER TYPE "RequestStatus_new" RENAME TO "RequestStatus";

-- 5. Restore the column default with the new value.
ALTER TABLE "Request" ALTER COLUMN "status" SET DEFAULT 'backlog'::"RequestStatus";
