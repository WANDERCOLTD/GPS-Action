-- D074 — per-kind feed comment-peek toggle.
--
-- Adds `feedCommentPeekEnabled BOOLEAN NOT NULL DEFAULT true` to PostKind
-- and seeds the two kinds that shouldn't show a peek:
--   - cultural       (calm markers; no engagement chatter on feed cards)
--   - tick_or_cross  (network ask; discussion lives on detail, not feed)
--
-- Idempotent per D070: ADD COLUMN IF NOT EXISTS + UPDATE by slug, so
-- rerunning on environments that already have the column is a no-op.

ALTER TABLE "PostKind"
  ADD COLUMN IF NOT EXISTS "feedCommentPeekEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "PostKind" SET "feedCommentPeekEnabled" = false
  WHERE "slug" IN ('cultural', 'tick_or_cross');
