-- Add LinkPreview model — persistent server-side OG-metadata cache.
-- See ADR-0019, D084, bu-link-preview-store.
--
-- This migration intentionally does NOT touch the pg_trgm GIN indexes
-- (*_trgm_idx) that BU-search-surface owns via SQL-only migrations.
-- Prisma's drift detector flags them as "should not exist" because
-- they live outside the Prisma schema; that's by design (pg_trgm GIN
-- is not expressible in Prisma DSL). Do not regenerate this migration
-- with `prisma migrate dev` without confirming the drift section is
-- discarded — otherwise it will drop the search indexes.

-- CreateTable
CREATE TABLE "LinkPreview" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "siteName" TEXT,
    "faviconUrl" TEXT,
    "linkType" TEXT,
    "fetchStatus" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkPreview_url_key" ON "LinkPreview"("url");

-- CreateIndex
CREATE INDEX "LinkPreview_normalizedUrl_idx" ON "LinkPreview"("normalizedUrl");

-- CreateIndex
CREATE INDEX "LinkPreview_expiresAt_idx" ON "LinkPreview"("expiresAt");

-- CreateIndex
CREATE INDEX "LinkPreview_linkType_idx" ON "LinkPreview"("linkType");
