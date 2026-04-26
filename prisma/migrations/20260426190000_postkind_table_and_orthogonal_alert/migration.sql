-- BU-fab-intent-picker (D062 revised, D063)
--
-- Promotes the kind axis to a managed PostKind table; collapses the
-- existing AlertCategory entity into PostKind; adds an orthogonal
-- urgency flag on Post; renames Request.alertCategoryId to kindId
-- pointing at the new table.
--
-- Approach:
--   1. Create PostKind table
--   2. Migrate existing AlertCategory rows into PostKind
--   3. Add Post.kindId, Post.urgency
--   4. Rename Request.alertCategoryId → Request.kindId; repoint FK
--   5. Drop AlertCategory table
--
-- Pre-condition: Post.kind String column does NOT exist (this branch's
-- prior migration was renamed in place; the unmerged version that
-- added Post.kind is replaced by this migration).

-- ── 1. PostKind table ────────────────────────────────────────────────────
CREATE TABLE "PostKind" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isAlertEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PostKind_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostKind_slug_key" ON "PostKind"("slug");
CREATE INDEX "PostKind_deletedAt_sortOrder_idx" ON "PostKind"("deletedAt", "sortOrder");

-- ── 2. Migrate existing AlertCategory rows into PostKind ──────────────────
-- D062 §3: AlertCategory was a single seeded row ("Happening now").
-- Copy any existing rows into PostKind preserving id (so existing Request
-- FKs stay valid after rename in step 4). isAlertEligible=true on these
-- because they were AlertCategory rows.
INSERT INTO "PostKind" ("id", "slug", "displayName", "icon", "sortOrder", "isAlertEligible", "createdAt", "deletedAt")
SELECT
    "id",
    REPLACE("slug", '-', '_'),
    "displayName",
    "icon",
    "sortOrder",
    true,
    "createdAt",
    "deletedAt"
FROM "AlertCategory";

-- ── 3. Add Post.kindId + Post.urgency ────────────────────────────────────
ALTER TABLE "Post"
  ADD COLUMN "kindId" TEXT,
  ADD COLUMN "urgency" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Post"
  ADD CONSTRAINT "Post_kindId_fkey"
  FOREIGN KEY ("kindId")
  REFERENCES "PostKind"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "Post_kindId_idx" ON "Post"("kindId");
CREATE INDEX "Post_urgency_idx" ON "Post"("urgency");

-- ── 4. Rename Request.alertCategoryId → Request.kindId ───────────────────
-- Drop the old FK constraint, rename the column, add the new FK pointing
-- at PostKind. Existing rows preserve their FK target (since PostKind
-- ids match old AlertCategory ids per step 2).
ALTER TABLE "Request" DROP CONSTRAINT "Request_alertCategoryId_fkey";

ALTER TABLE "Request" RENAME COLUMN "alertCategoryId" TO "kindId";

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_kindId_fkey"
  FOREIGN KEY ("kindId")
  REFERENCES "PostKind"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ── 5. Drop AlertCategory ────────────────────────────────────────────────
DROP TABLE "AlertCategory";
