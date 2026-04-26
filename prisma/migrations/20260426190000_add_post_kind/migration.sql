-- BU-fab-intent-picker (D062)
-- Adds the intent kind label to Post. Free-form string, nullable.
-- Existing posts have kind=NULL and render unchanged.

ALTER TABLE "Post" ADD COLUMN "kind" TEXT;
