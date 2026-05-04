-- bu-coordination-board / PR #2g.2 — ADR-0011
--
-- Drop the Request claim trio (claimedByUserId / claimedAt / claimExpiresAt).
-- Single-owner ownership migrates to the Assignment join (ADR-0009).
-- claimExpiresAt was dead schema — no sweeper enforced it.
--
-- Two-step migration:
--   1. Backfill Assignment rows for every Request currently carrying a
--      non-null claimedByUserId. Preserves "ownership" history through
--      the cutover.
--   2. Drop the columns + relation index.

-- 1. Backfill ----------------------------------------------------------------
INSERT INTO "Assignment" ("id", "requestId", "userId", "assignedAt")
SELECT gen_random_uuid(), id, "claimedByUserId", COALESCE("claimedAt", "createdAt")
FROM "Request"
WHERE "claimedByUserId" IS NOT NULL
ON CONFLICT ("requestId", "userId") DO NOTHING;

-- 2. Drop columns + relation index ------------------------------------------
DROP INDEX IF EXISTS "Request_claimedByUserId_status_idx";

ALTER TABLE "Request" DROP CONSTRAINT IF EXISTS "Request_claimedByUserId_fkey";

ALTER TABLE "Request"
  DROP COLUMN "claimedByUserId",
  DROP COLUMN "claimedAt",
  DROP COLUMN "claimExpiresAt";
