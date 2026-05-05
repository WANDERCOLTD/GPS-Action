-- bu-coordination-board / PR #5a — ADR-0013 / D079
--
-- Add typed Request.title + Request.body. Back-fill from the
-- existing context JSON's `title` and `body` keys. Then enforce
-- NOT NULL on title.
--
-- Idempotent in the D070 sense: each statement converges on the
-- same state regardless of repeats — COALESCE short-circuits when
-- the typed column already has a value.

-- 1. Add columns. title is nullable initially so the back-fill
--    can populate it before the NOT NULL constraint is applied.
ALTER TABLE "Request" ADD COLUMN "title" TEXT;
ALTER TABLE "Request" ADD COLUMN "body"  TEXT;

-- 2. Back-fill from context JSON. Idempotent: re-running on rows
--    that already have title/body populated is a no-op (COALESCE
--    short-circuits on the first non-null term). NULLIF(…, '')
--    treats empty strings as missing so the sentinel kicks in.
UPDATE "Request"
SET
  "title" = COALESCE(
    "title",
    NULLIF(context->>'title', ''),
    '(Untitled)'
  ),
  "body" = COALESCE(
    "body",
    NULLIF(context->>'body', '')
  );

-- 3. Apply NOT NULL + default to title (body stays nullable).
ALTER TABLE "Request" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "Request" ALTER COLUMN "title" SET DEFAULT '(Untitled)';
