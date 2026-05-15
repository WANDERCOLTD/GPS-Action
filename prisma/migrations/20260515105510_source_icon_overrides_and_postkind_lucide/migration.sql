-- ADR-0020 — source-group icon overrides + PostKind lucide rendering.
-- See docs/adrs/0020-source-and-kind-icons.md and D085.
--
-- Migration intentionally does NOT touch the pg_trgm GIN indexes that
-- BU-search-surface owns via SQL-only migrations. Prisma's drift
-- detector flags them as "should not exist"; that's by design. Do
-- not regenerate this migration with `prisma migrate dev` without
-- confirming the drift section is discarded — otherwise it will
-- drop the search indexes.

-- ── PostKind.lucideIcon ─────────────────────────────────────────────────
ALTER TABLE "PostKind" ADD COLUMN "lucideIcon" TEXT;

-- ── SourceIconOverride ──────────────────────────────────────────────────
CREATE TABLE "SourceIconOverride" (
    "slug" TEXT NOT NULL,
    "iconKind" TEXT NOT NULL,
    "imageUrl" TEXT,
    "lucideKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceIconOverride_pkey" PRIMARY KEY ("slug")
);

-- ── Reference data (D070): seed the two known overrides ────────────────
-- gps-action-network → uploaded brand mark (committed to /public).
-- gps-network-yes-no → lucide tick+cross overlap pair (no image).
--
-- Idempotent via ON CONFLICT: re-running this migration on a database
-- that already has the row will refresh the override values rather
-- than fail.

INSERT INTO "SourceIconOverride" ("slug", "iconKind", "imageUrl", "lucideKey", "createdAt", "updatedAt")
VALUES
    ('gps-action-network', 'image', '/source-icons/gps-action-network.jpg', NULL, NOW(), NOW()),
    ('gps-network-yes-no', 'lucide', NULL, 'tick-cross-pair', NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
    "iconKind" = EXCLUDED."iconKind",
    "imageUrl" = EXCLUDED."imageUrl",
    "lucideKey" = EXCLUDED."lucideKey",
    "updatedAt" = NOW();

-- ── PostKind data update: tick_or_cross → lucide overlap pair ──────────
UPDATE "PostKind"
SET "lucideIcon" = 'tick-cross-pair'
WHERE "slug" = 'tick_or_cross';
