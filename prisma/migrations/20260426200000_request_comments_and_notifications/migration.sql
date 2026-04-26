-- BU-requests-vetting (D056, D057)
--
-- Comment is now polymorphic — exactly one of postId / requestId is
-- non-null (app-level invariant). Adds the Notification entity for
-- in-app delivery of @mentions + state-change events.

-- ── 1. Comment polymorphism: widen postId, add requestId ─────────────────
ALTER TABLE "Comment" ALTER COLUMN "postId" DROP NOT NULL;

ALTER TABLE "Comment" ADD COLUMN "requestId" TEXT;

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_requestId_fkey"
  FOREIGN KEY ("requestId")
  REFERENCES "Request"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE INDEX "Comment_requestId_createdAt_idx" ON "Comment"("requestId", "createdAt");

-- ── 2. Notification entity ───────────────────────────────────────────────
CREATE TYPE "NotificationType" AS ENUM (
  'request_status_changed',
  'request_mention',
  'request_resolved',
  'request_published',
  'request_archived'
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "requestId" TEXT,
    "fromUserId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx"
  ON "Notification"("recipientUserId", "readAt", "createdAt");
CREATE INDEX "Notification_requestId_idx" ON "Notification"("requestId");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId")
  REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_requestId_fkey"
  FOREIGN KEY ("requestId")
  REFERENCES "Request"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_fromUserId_fkey"
  FOREIGN KEY ("fromUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
