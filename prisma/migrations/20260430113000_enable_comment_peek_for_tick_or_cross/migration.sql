-- D073 follow-up: per the user's UX call, `tick_or_cross` posts DO get
-- the feed comment peek. The original D073 seed defaulted it off on the
-- reasoning that discussion belonged on the detail page; in practice
-- the network ask attracts replies that are useful to surface in the
-- feed (single most-recent reply, same as every other kind).
--
-- `cultural` stays off — Shabbat / remembrance markers remain quieter.
--
-- Idempotent per D070: WHERE slug = matches at most one row, sets the
-- column unconditionally. Re-running on environments that already have
-- it true is a no-op.

UPDATE "PostKind" SET "feedCommentPeekEnabled" = true
  WHERE "slug" = 'tick_or_cross';
