-- BU-requests-foundation (D054, D055, D056)
--
-- Rename WorkItem → Request (D054), add Comment.audience (D056), add
-- RoleGrant.scope (D055). Hand-written to use RENAME instead of
-- DROP+CREATE so existing data (FeatureFlag rows, seed data, audit
-- entries) survives the rename.

-- ── 1. Rename enums (preserves any row using these types) ────────────────
ALTER TYPE "WorkItemType" RENAME TO "RequestType";
ALTER TYPE "WorkItemStatus" RENAME TO "RequestStatus";
ALTER TYPE "WorkItemPriority" RENAME TO "RequestPriority";
ALTER TYPE "WorkItemResolution" RENAME TO "RequestResolution";

-- ── 2. Rename table (preserves rows, indexes auto-rename via constraint) ──
ALTER TABLE "WorkItem" RENAME TO "Request";

-- ── 3. Rename indexes to match new table name ────────────────────────────
ALTER INDEX "WorkItem_pkey" RENAME TO "Request_pkey";
ALTER INDEX "WorkItem_status_priority_createdAt_idx" RENAME TO "Request_status_priority_createdAt_idx";
ALTER INDEX "WorkItem_claimedByUserId_status_idx" RENAME TO "Request_claimedByUserId_status_idx";
ALTER INDEX "WorkItem_type_status_idx" RENAME TO "Request_type_status_idx";
ALTER INDEX "WorkItem_regionSlug_status_idx" RENAME TO "Request_regionSlug_status_idx";
ALTER INDEX "WorkItem_groupTags_idx" RENAME TO "Request_groupTags_idx";
ALTER INDEX "WorkItem_deletedAt_idx" RENAME TO "Request_deletedAt_idx";

-- ── 4. Rename foreign-key constraints to match new table name ────────────
ALTER TABLE "Request" RENAME CONSTRAINT "WorkItem_createdByUserId_fkey" TO "Request_createdByUserId_fkey";
ALTER TABLE "Request" RENAME CONSTRAINT "WorkItem_claimedByUserId_fkey" TO "Request_claimedByUserId_fkey";
ALTER TABLE "Request" RENAME CONSTRAINT "WorkItem_resolvedByUserId_fkey" TO "Request_resolvedByUserId_fkey";

-- ── 5. Comment.audience (D056) ───────────────────────────────────────────
CREATE TYPE "CommentAudience" AS ENUM ('all', 'reviewers');
ALTER TABLE "Comment" ADD COLUMN "audience" "CommentAudience" NOT NULL DEFAULT 'all';

-- ── 6. RoleGrant.scope (D055) ────────────────────────────────────────────
ALTER TABLE "RoleGrant" ADD COLUMN "scope" TEXT;
CREATE INDEX "RoleGrant_scope_idx" ON "RoleGrant"("scope");
