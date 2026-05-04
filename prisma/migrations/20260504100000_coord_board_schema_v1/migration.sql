-- bu-coordination-board / build sequence #1 of 8 (ADRs 0005-0009)
--
-- Schema additions for the kanban surface, additive only. Consumers
-- (services, routers, surfaces) land in PR #2 onwards. All rows here
-- stay dormant until pilot teams flip `coord_board_v1`.
--
-- Slice content:
--   - 7 new enums (GroupKind, CommentKind, CommentSource,
--     NotificationLifecycle, NotificationReasonKind, SubscriptionSource,
--     RequestGroupOrigin).
--   - 5 new tables (Assignment, RequestGroup, GroupShareWorkflow,
--     BoardColumn, RequestSubscription).
--   - Field additions on existing tables: Group.kind,
--     Request.columnId / boardPosition, Comment.kind / source,
--     Notification.lifecycle / reasonKind.
--   - Sync-write data migration: existing system-authored Comment rows
--     (systemKind != NULL) are flipped to source = system; existing
--     read Notification rows (readAt != NULL) are flipped to
--     lifecycle = acknowledged. Keeps surface 3 + ticket-detail
--     rendering consistent on the row before any service code starts
--     writing the new fields.
--
-- Deferred to PR #2 (alongside consumer-service migration):
--   - Drop Request.claimedByUserId (replaced by Assignment join).
--   - Drop Request.requestType.
--   - Reframe RequestStatus enum to backlog | active | done | abandoned
--     (ADR-0005 documents the target shape).
--
-- Forward-only. Reversible by dropping the new tables, columns, and
-- enums; not expected.

-- CreateEnum
CREATE TYPE "GroupKind" AS ENUM ('workstream', 'region', 'network', 'team', 'topic');

-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('comment', 'note');

-- CreateEnum
CREATE TYPE "CommentSource" AS ENUM ('human', 'system');

-- CreateEnum
CREATE TYPE "NotificationLifecycle" AS ENUM ('new', 'acknowledged', 'dismissed');

-- CreateEnum
CREATE TYPE "NotificationReasonKind" AS ENUM ('assignment', 'mention', 'status_change', 'comment', 'urgent_flip', 'team_blast');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('auto_author', 'auto_assignee', 'auto_mention', 'explicit', 'team_blast_optin');

-- CreateEnum
CREATE TYPE "RequestGroupOrigin" AS ENUM ('originating', 'workflow_share', 'ad_hoc_share');

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "boardPosition" DECIMAL(65,30),
ADD COLUMN     "columnId" TEXT;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "kind" "GroupKind" NOT NULL DEFAULT 'team';

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "kind" "CommentKind" NOT NULL DEFAULT 'comment',
ADD COLUMN     "source" "CommentSource" NOT NULL DEFAULT 'human';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "lifecycle" "NotificationLifecycle" NOT NULL DEFAULT 'new',
ADD COLUMN     "reasonKind" "NotificationReasonKind";

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestGroup" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "columnId" TEXT,
    "boardPosition" DECIMAL(65,30),
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "origin" "RequestGroupOrigin" NOT NULL DEFAULT 'originating',
    "sharedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RequestGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupShareWorkflow" (
    "id" TEXT NOT NULL,
    "sourceGroupId" TEXT NOT NULL,
    "targetGroupId" TEXT NOT NULL,
    "addedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GroupShareWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardColumn" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BoardColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestSubscription" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "SubscriptionSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RequestSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_userId_unassignedAt_idx" ON "Assignment"("userId", "unassignedAt");

-- CreateIndex
CREATE INDEX "Assignment_requestId_unassignedAt_idx" ON "Assignment"("requestId", "unassignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_requestId_userId_key" ON "Assignment"("requestId", "userId");

-- CreateIndex
CREATE INDEX "RequestGroup_groupId_deletedAt_idx" ON "RequestGroup"("groupId", "deletedAt");

-- CreateIndex
CREATE INDEX "RequestGroup_requestId_idx" ON "RequestGroup"("requestId");

-- CreateIndex
CREATE INDEX "RequestGroup_groupId_columnId_boardPosition_idx" ON "RequestGroup"("groupId", "columnId", "boardPosition");

-- CreateIndex
CREATE UNIQUE INDEX "RequestGroup_requestId_groupId_key" ON "RequestGroup"("requestId", "groupId");

-- CreateIndex
CREATE INDEX "GroupShareWorkflow_sourceGroupId_deletedAt_idx" ON "GroupShareWorkflow"("sourceGroupId", "deletedAt");

-- CreateIndex
CREATE INDEX "GroupShareWorkflow_targetGroupId_deletedAt_idx" ON "GroupShareWorkflow"("targetGroupId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupShareWorkflow_sourceGroupId_targetGroupId_key" ON "GroupShareWorkflow"("sourceGroupId", "targetGroupId");

-- CreateIndex
CREATE INDEX "BoardColumn_groupId_deletedAt_idx" ON "BoardColumn"("groupId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BoardColumn_groupId_ordinal_key" ON "BoardColumn"("groupId", "ordinal");

-- CreateIndex
CREATE INDEX "RequestSubscription_userId_deletedAt_idx" ON "RequestSubscription"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "RequestSubscription_requestId_deletedAt_idx" ON "RequestSubscription"("requestId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestSubscription_requestId_userId_key" ON "RequestSubscription"("requestId", "userId");

-- CreateIndex
CREATE INDEX "Request_columnId_boardPosition_idx" ON "Request"("columnId", "boardPosition");

-- CreateIndex
CREATE INDEX "Group_kind_idx" ON "Group"("kind");

-- CreateIndex
CREATE INDEX "Comment_requestId_kind_createdAt_idx" ON "Comment"("requestId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_lifecycle_createdAt_idx" ON "Notification"("recipientUserId", "lifecycle", "createdAt");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestGroup" ADD CONSTRAINT "RequestGroup_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestGroup" ADD CONSTRAINT "RequestGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestGroup" ADD CONSTRAINT "RequestGroup_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestGroup" ADD CONSTRAINT "RequestGroup_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupShareWorkflow" ADD CONSTRAINT "GroupShareWorkflow_sourceGroupId_fkey" FOREIGN KEY ("sourceGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupShareWorkflow" ADD CONSTRAINT "GroupShareWorkflow_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupShareWorkflow" ADD CONSTRAINT "GroupShareWorkflow_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardColumn" ADD CONSTRAINT "BoardColumn_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestSubscription" ADD CONSTRAINT "RequestSubscription_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestSubscription" ADD CONSTRAINT "RequestSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Sync-write data migration (ADR-0007 + ADR-0008) ──────────────────────
-- Existing rows: keep new fields consistent with the legacy fields they
-- coexist with. ADR-0007 (Comment): system-authored rows already have
-- systemKind != NULL; flip them to source = system. ADR-0008
-- (Notification): rows that were already read have readAt != NULL; flip
-- them to lifecycle = acknowledged so Surface 3 doesn't tint them. Both
-- UPDATEs are idempotent — re-running them sets the same values.

UPDATE "Comment"
SET "source" = 'system'
WHERE "systemKind" IS NOT NULL;

UPDATE "Notification"
SET "lifecycle" = 'acknowledged'
WHERE "readAt" IS NOT NULL;
