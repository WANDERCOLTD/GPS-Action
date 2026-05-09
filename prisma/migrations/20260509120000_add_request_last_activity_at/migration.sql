-- bu-ticket-view-fixes / Sub-build A — ADR-0015 / D081
--
-- Add `Request.lastActivityAt` — visible-activity recency, bumped
-- explicitly by `touchRequestActivity` from each tRPC mutation that
-- performs a bump-event (comment / note / status / assignment /
-- share-unshare / title / body edit). Distinct from `updatedAt`,
-- which is the Prisma-managed row-mutation timestamp.
--
-- Backfill seeds from `updatedAt` — the honest day-zero default for
-- pre-existing rows. From the next bump-event onwards the explicit
-- helper takes over and the column is exact.
--
-- Idempotent in the D070 sense: ADD COLUMN IF NOT EXISTS / SET …
-- statements converge on the same state; the UPDATE…WHERE IS NULL
-- guard is a no-op once the column is populated. The whole sequence
-- runs in a single transaction so partial-state replay can't leave
-- the column nullable on an environment where the constraint flip
-- failed.
--
-- Reversible: the down-path is `DROP INDEX … ; ALTER TABLE … DROP
-- COLUMN …`. No data loss (the column is derived).

-- 1. Add nullable column so the back-fill can populate it before the
--    NOT NULL constraint is applied.
ALTER TABLE "Request" ADD COLUMN "lastActivityAt" TIMESTAMP(3);

-- 2. Back-fill from `updatedAt`. Idempotent: the WHERE clause makes
--    re-runs a no-op once the column is populated.
UPDATE "Request"
SET "lastActivityAt" = "updatedAt"
WHERE "lastActivityAt" IS NULL;

-- 3. Apply NOT NULL + default. From now on, new inserts get
--    CURRENT_TIMESTAMP automatically; the helper bumps it explicitly
--    on every visible-activity event.
ALTER TABLE "Request" ALTER COLUMN "lastActivityAt" SET NOT NULL;
ALTER TABLE "Request" ALTER COLUMN "lastActivityAt" SET DEFAULT CURRENT_TIMESTAMP;

-- 4. DESC index — keeps "most recently active first" triage views fast.
CREATE INDEX "Request_lastActivityAt_idx" ON "Request"("lastActivityAt" DESC);
