-- bu-share-event-polymorphic / ADR-0018 — Phase A (additive)
--
-- Creates the polymorphic ShareEvent table that supersedes the (never-
-- built) PostShare table speced in ADR-0003. Three-phase migration:
--   A) this migration — additive, no behaviour change
--   B) service layer dual-write + read swap (separate PR)
--   C) drop PostShare + legacyPostShareId column (separate PR)
--
-- IMPORTANT — historical note: ADR-0003 / D077 designed a PostShare
-- table, but bu-post-share-counter's build phases never landed (brief
-- status remains `planned` as of 2026-05-11). This Phase A therefore
-- ships:
--   - The ShareDestination enum (would have shipped with PostShare)
--   - The new ShareTargetType enum (`post` value only)
--   - The ShareEvent table (final polymorphic shape)
--   - A defensive backfill block that copies from PostShare IF it
--     exists — typically a no-op on first deploy, but safe if a
--     parallel branch ships PostShare before this lands.
--
-- Reversible: down-path is `DROP TABLE "ShareEvent"; DROP TYPE
-- "ShareTargetType"; DROP TYPE "ShareDestination";` — no other table
-- touched.

-- ── 1. Enums ────────────────────────────────────────────────────────────

CREATE TYPE "ShareTargetType" AS ENUM ('post');

CREATE TYPE "ShareDestination" AS ENUM (
  'whatsapp',
  'x',
  'instagram',
  'facebook',
  'email',
  'copy_link',
  'other'
);

-- ── 2. Table ────────────────────────────────────────────────────────────

CREATE TABLE "ShareEvent" (
  "id"                 TEXT               NOT NULL,
  "userId"             TEXT               NOT NULL,
  "targetType"         "ShareTargetType"  NOT NULL,
  "targetId"           TEXT               NOT NULL,
  "postId"             TEXT,
  "networkCardStateId" BIGINT,
  "destination"        "ShareDestination" NOT NULL,
  "intentAt"           TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt"        TIMESTAMP(3),
  "legacyPostShareId"  TEXT,
  "createdAt"          TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)       NOT NULL,
  CONSTRAINT "ShareEvent_pkey" PRIMARY KEY ("id")
);

-- ── 3. Indexes & unique constraints ─────────────────────────────────────

-- Idempotency: one row per (target, user, destination). Re-tapping the
-- same share button updates intentAt (within rate limit) instead of
-- inserting a duplicate.
CREATE UNIQUE INDEX "share_event_unique"
  ON "ShareEvent"("targetType", "targetId", "userId", "destination");

-- Trace-back to a hypothetical PostShare row (Phase C drops this).
CREATE UNIQUE INDEX "ShareEvent_legacyPostShareId_key"
  ON "ShareEvent"("legacyPostShareId");

-- Aggregation query: counts per target by destination.
CREATE INDEX "ShareEvent_targetType_targetId_destination_idx"
  ON "ShareEvent"("targetType", "targetId", "destination");

-- "Shares by user this week" query.
CREATE INDEX "ShareEvent_userId_intentAt_idx"
  ON "ShareEvent"("userId", "intentAt");

-- Typed FK lookups (post + network card).
CREATE INDEX "ShareEvent_postId_idx" ON "ShareEvent"("postId");
CREATE INDEX "ShareEvent_networkCardStateId_idx"
  ON "ShareEvent"("networkCardStateId");

-- ── 4. Foreign keys ─────────────────────────────────────────────────────

ALTER TABLE "ShareEvent"
  ADD CONSTRAINT "ShareEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShareEvent"
  ADD CONSTRAINT "ShareEvent_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShareEvent"
  ADD CONSTRAINT "ShareEvent_networkCardStateId_fkey"
  FOREIGN KEY ("networkCardStateId") REFERENCES "NetworkCardState"("messageId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. Defensive backfill ───────────────────────────────────────────────
--
-- If a parallel branch shipped the PostShare table (per ADR-0003), copy
-- its rows into ShareEvent so Phase A leaves the data layer in a
-- counter-parity state. If PostShare doesn't exist, this block is a
-- no-op. Wrapped in a DO block so the migration succeeds on a fresh DB
-- where PostShare was never created.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'PostShare'
  ) THEN
    EXECUTE $sql$
      INSERT INTO "ShareEvent" (
        "id",
        "userId",
        "targetType",
        "targetId",
        "postId",
        "networkCardStateId",
        "destination",
        "intentAt",
        "confirmedAt",
        "legacyPostShareId",
        "createdAt",
        "updatedAt"
      )
      SELECT
        gen_random_uuid()::text,
        ps."userId",
        'post'::"ShareTargetType",
        ps."postId",
        ps."postId",
        NULL,
        ps."destination"::text::"ShareDestination",
        ps."intentAt",
        ps."confirmedAt",
        ps."id",
        COALESCE(ps."createdAt", ps."intentAt"),
        COALESCE(ps."updatedAt", ps."intentAt")
      FROM "PostShare" ps
      ON CONFLICT ("legacyPostShareId") DO NOTHING
    $sql$;
  END IF;
END
$$;
