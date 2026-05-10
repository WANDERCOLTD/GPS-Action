-- bu-network-feed / ADR-0017 / D083
--
-- Add NetworkCardState — own-side workflow state for the /network surface.
-- The cards themselves are read from Grant (AIFA)'s Supabase view
-- `public.gps_group_messages`; this table owns the triage state on our side
-- per Grant's "own the workflow state" steer (PAUL_INTEGRATION.md quirk #4)
-- and ADR-0017.
--
-- `messageId` is an opaque BIGINT join key into the external view. NOT a
-- foreign key — the upstream row lives in a different Postgres cluster.
-- Orphan-tolerant: when Grant hides a row upstream, our state row simply
-- becomes unreachable through the join. Sweep is parking-lot.
--
-- No backfill: existing 163 historical upstream cards have no state row and
-- default to NEW at read time. Rows are created lazily on first state
-- mutation, keeping the table tight.
--
-- Reversible: down-path is `DROP TABLE "NetworkCardState"; DROP TYPE
-- "NetworkCardStatus";` — state is reproducible from triage activity.

CREATE TYPE "NetworkCardStatus" AS ENUM ('NEW', 'TRIAGED', 'PROMOTED', 'DISCARDED');

CREATE TABLE "NetworkCardState" (
  "id"          TEXT                NOT NULL,
  "messageId"   BIGINT              NOT NULL,
  "status"      "NetworkCardStatus" NOT NULL DEFAULT 'NEW',
  "ownerUserId" TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)        NOT NULL,
  CONSTRAINT "NetworkCardState_pkey" PRIMARY KEY ("id")
);

-- One state row per upstream message id.
CREATE UNIQUE INDEX "NetworkCardState_messageId_key" ON "NetworkCardState"("messageId");

-- Triage queries.
CREATE INDEX "NetworkCardState_status_idx" ON "NetworkCardState"("status");
CREATE INDEX "NetworkCardState_ownerUserId_idx" ON "NetworkCardState"("ownerUserId");

-- Owner relation. SET NULL on user delete so removing a coordinator
-- gracefully unassigns rather than cascade-deleting card history.
ALTER TABLE "NetworkCardState"
  ADD CONSTRAINT "NetworkCardState_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
