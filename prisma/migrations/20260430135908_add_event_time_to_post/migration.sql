-- BU-event-time / D073 / ADR-0001. Structured event-time fields on Post.
--
-- Three nullable columns + one B-tree index on eventAt. Forward-only,
-- additive, no backfill required: every existing Post row gets NULL
-- in the new columns. Reversible via a follow-up migration.
--
-- Storage convention is UTC; the UI boundary converts to Europe/London
-- via date-fns-tz at render time. The server-layer invariant
-- (eventEndsAt >= eventAt when both are set) is enforced in the
-- service / Zod validator, not as a DB CHECK constraint, to keep the
-- migration cheap and the rule colocated with the rest of post
-- validation.
--
-- Plain B-tree on eventAt is acceptable at MVP scale even though most
-- rows have NULL; a partial index (WHERE eventAt IS NOT NULL) is the
-- planned promotion path once the table grows.

-- AlterTable
ALTER TABLE "Post"
  ADD COLUMN "eventAt"      TIMESTAMP(3),
  ADD COLUMN "eventEndsAt"  TIMESTAMP(3),
  ADD COLUMN "locationText" TEXT;

-- CreateIndex
CREATE INDEX "Post_eventAt_idx" ON "Post"("eventAt");
