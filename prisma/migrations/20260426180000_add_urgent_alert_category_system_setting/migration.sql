-- BU-requests-urgent (D058)
--
-- Adds the urgent flag to Request, the AlertCategory entity (admin-managed
-- enum-replacement table), and the SystemSetting entity (key/value store
-- for global config like urgent_ttl_hours).

-- ── Request: urgent flag + alert category FK ─────────────────────────────
ALTER TABLE "Request"
  ADD COLUMN "urgency" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "urgencyExpiresAt" TIMESTAMP(3),
  ADD COLUMN "alertCategoryId" TEXT;

CREATE INDEX "Request_urgency_status_idx" ON "Request"("urgency", "status");

-- ── AlertCategory ────────────────────────────────────────────────────────
CREATE TABLE "AlertCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "AlertCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlertCategory_slug_key" ON "AlertCategory"("slug");
CREATE INDEX "AlertCategory_deletedAt_sortOrder_idx" ON "AlertCategory"("deletedAt", "sortOrder");

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_alertCategoryId_fkey"
  FOREIGN KEY ("alertCategoryId")
  REFERENCES "AlertCategory"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ── SystemSetting ────────────────────────────────────────────────────────
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

ALTER TABLE "SystemSetting"
  ADD CONSTRAINT "SystemSetting_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
