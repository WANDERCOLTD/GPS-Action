-- D071 — publish router foundation. Single migration covering:
--
--   1. New enums (PostStatus, ReviewMode, CommentSystemKind) +
--      RequestType += 'kind_review'
--   2. User.avatarUrl
--   3. PostKind config columns (actionSlugs, reviewMode, canSelfPublish,
--      reviewPriority) + idempotent UPDATEs seeding per-kind values
--   4. Post lifecycle columns (status, publishedAt, reviewRequestId,
--      reviewedByUserId) + index + backfill of existing rows
--   5. Comment.systemKind (nullable)
--   6. SystemSetting rows for autosave / undo / auto-comment toggle
--      tunables (idempotent INSERT)
--
-- All changes are additive. Existing rows preserve their semantics:
--   - Existing Post rows are backfilled status='published' (they were
--     visible in the feed before this migration; staying so is the safe
--     default). publishedAt backfilled from createdAt for those rows.
--   - Existing PostKind rows get sensible defaults for the new columns
--     via the table defaults; per-kind values then UPDATE to the table
--     in D071 §2.
--   - Existing Comment rows get systemKind = NULL — unchanged behaviour.
--
-- Per D070, reference-data inserts (the SystemSetting rows) ride this
-- migration with ON CONFLICT (key) DO NOTHING so re-runs are safe.

-- ─── 1. Enums ─────────────────────────────────────────────────────────────

CREATE TYPE "PostStatus" AS ENUM ('draft', 'published');

CREATE TYPE "ReviewMode" AS ENUM (
  'review_first',
  'review_after_publish',
  'either_with_default_review_first',
  'either_with_default_publish'
);

CREATE TYPE "CommentSystemKind" AS ENUM ('post_review_attribution');

ALTER TYPE "RequestType" ADD VALUE 'kind_review';

-- ─── 2. User.avatarUrl ────────────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

-- ─── 3. PostKind config columns ───────────────────────────────────────────

ALTER TABLE "PostKind" ADD COLUMN "actionSlugs"    TEXT[]            NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PostKind" ADD COLUMN "reviewMode"     "ReviewMode"      NOT NULL DEFAULT 'either_with_default_publish';
ALTER TABLE "PostKind" ADD COLUMN "canSelfPublish" BOOLEAN           NOT NULL DEFAULT true;
ALTER TABLE "PostKind" ADD COLUMN "reviewPriority" "RequestPriority" NOT NULL DEFAULT 'normal';

-- Per-kind seed values per D071 §2. Idempotent — match by slug.
UPDATE "PostKind" SET
  "actionSlugs"    = ARRAY[]::TEXT[],
  "reviewMode"     = 'review_after_publish',
  "canSelfPublish" = true,
  "reviewPriority" = 'urgent'
WHERE slug = 'happening_now';

UPDATE "PostKind" SET
  "actionSlugs"    = ARRAY['share_to_gps_whatsapp'],
  "reviewMode"     = 'either_with_default_review_first',
  "canSelfPublish" = true,
  "reviewPriority" = 'high'
WHERE slug = 'tick_or_cross';

UPDATE "PostKind" SET
  "actionSlugs"    = ARRAY['schedule_for_sundown'],
  "reviewMode"     = 'review_first',
  "canSelfPublish" = false,
  "reviewPriority" = 'high'
WHERE slug = 'cultural';

UPDATE "PostKind" SET
  "actionSlugs"    = ARRAY['open_activist_mailer'],
  "reviewMode"     = 'either_with_default_review_first',
  "canSelfPublish" = true,
  "reviewPriority" = 'normal'
WHERE slug = 'call_to_action';

UPDATE "PostKind" SET
  "actionSlugs"    = ARRAY['share_to_socials'],
  "reviewMode"     = 'either_with_default_publish',
  "canSelfPublish" = true,
  "reviewPriority" = 'normal'
WHERE slug = 'link_share';

UPDATE "PostKind" SET
  "actionSlugs"    = ARRAY['add_to_calendar'],
  "reviewMode"     = 'either_with_default_publish',
  "canSelfPublish" = true,
  "reviewPriority" = 'normal'
WHERE slug = 'event';

UPDATE "PostKind" SET
  "actionSlugs"    = ARRAY['open_join_link'],
  "reviewMode"     = 'either_with_default_publish',
  "canSelfPublish" = true,
  "reviewPriority" = 'normal'
WHERE slug = 'meeting';

UPDATE "PostKind" SET
  "actionSlugs"    = ARRAY[]::TEXT[],
  "reviewMode"     = 'either_with_default_publish',
  "canSelfPublish" = true,
  "reviewPriority" = 'low'
WHERE slug = 'outcome';

UPDATE "PostKind" SET
  "actionSlugs"    = ARRAY[]::TEXT[],
  "reviewMode"     = 'either_with_default_publish',
  "canSelfPublish" = true,
  "reviewPriority" = 'low'
WHERE slug = 'thought';

-- ─── 4. Post lifecycle columns ────────────────────────────────────────────

-- status: default 'draft' for new rows; existing rows backfilled below.
ALTER TABLE "Post" ADD COLUMN "status"           "PostStatus" NOT NULL DEFAULT 'draft';
ALTER TABLE "Post" ADD COLUMN "publishedAt"      TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "reviewRequestId"  TEXT;
ALTER TABLE "Post" ADD COLUMN "reviewedByUserId" TEXT;

-- Backfill: any existing non-deleted Post is treated as published, with
-- publishedAt = createdAt (the closest approximation we have). This keeps
-- the live feed intact across the migration.
UPDATE "Post"
   SET "status" = 'published',
       "publishedAt" = "createdAt"
 WHERE "deletedAt" IS NULL;

-- @unique constraint on Post.reviewRequestId
CREATE UNIQUE INDEX "Post_reviewRequestId_key" ON "Post"("reviewRequestId");

-- FK Post.reviewRequestId → Request.id
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_reviewRequestId_fkey"
  FOREIGN KEY ("reviewRequestId")
  REFERENCES "Request"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- FK Post.reviewedByUserId → User.id
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Feed query index: published posts ordered by publishedAt
CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt" DESC);

-- ─── 5. Comment.systemKind ────────────────────────────────────────────────

ALTER TABLE "Comment" ADD COLUMN "systemKind" "CommentSystemKind";

-- ─── 6. SystemSetting tunables ────────────────────────────────────────────

INSERT INTO "SystemSetting" ("id", "key", "value", "updatedAt") VALUES
  (gen_random_uuid(), 'autosave_interval_seconds',                 '30',   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'autosave_promote_after_inactivity_seconds', '60',   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'discard_undo_window_seconds',               '10',   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'review_published_creates_comment',          'true', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
