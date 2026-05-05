-- @adr 0014 D070
-- bu-kanban-event-config — admin-controlled on/off per kanban event kind.
-- Idempotent: re-running on a DB that already has these rows is a no-op.
-- Manual admin flips are NOT overwritten — ON CONFLICT (eventKind) DO NOTHING.

-- ─── Step 1: enum + table ───────────────────────────────────────────────────

CREATE TYPE "KanbanEventKind" AS ENUM (
  'column_move',
  'status_change',
  'urgent_on',
  'urgent_off',
  'assign_self',
  'unassign_self',
  'title_edit',
  'body_edit',
  'share_to_team'
);

CREATE TABLE "KanbanEventConfig" (
  "id"              TEXT NOT NULL,
  "eventKind"       "KanbanEventKind" NOT NULL,
  "enabled"         BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "updatedByUserId" TEXT NOT NULL,

  CONSTRAINT "KanbanEventConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KanbanEventConfig_eventKind_key"
  ON "KanbanEventConfig"("eventKind");

CREATE INDEX "KanbanEventConfig_enabled_idx"
  ON "KanbanEventConfig"("enabled");

ALTER TABLE "KanbanEventConfig"
  ADD CONSTRAINT "KanbanEventConfig_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Step 2: seed reference data (per D070) ─────────────────────────────────
--
-- Defaults per ADR-0014: high-signal events ON, low-signal events OFF.
-- Wrapped in a DO block to capture the system-user id once and reuse it
-- across the nine inserts. The system user is created on demand for
-- migration self-containment (no-op if 20260505100000_seed_feature_flags
-- has already created it).

INSERT INTO "User" ("id", "email", "displayName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'system@gps-action.test',
  'system',
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO NOTHING;

DO $$
DECLARE
  system_user_id TEXT;
BEGIN
  SELECT "id" INTO system_user_id FROM "User"
    WHERE "email" = 'system@gps-action.test';

  INSERT INTO "KanbanEventConfig"
    ("id", "eventKind", "enabled", "updatedAt", "updatedByUserId")
  VALUES
    (gen_random_uuid()::text, 'column_move',   true,  NOW(), system_user_id),
    (gen_random_uuid()::text, 'status_change', true,  NOW(), system_user_id),
    (gen_random_uuid()::text, 'urgent_on',     true,  NOW(), system_user_id),
    (gen_random_uuid()::text, 'urgent_off',    false, NOW(), system_user_id),
    (gen_random_uuid()::text, 'assign_self',   false, NOW(), system_user_id),
    (gen_random_uuid()::text, 'unassign_self', false, NOW(), system_user_id),
    (gen_random_uuid()::text, 'title_edit',    false, NOW(), system_user_id),
    (gen_random_uuid()::text, 'body_edit',     false, NOW(), system_user_id),
    (gen_random_uuid()::text, 'share_to_team', true,  NOW(), system_user_id)
  ON CONFLICT ("eventKind") DO NOTHING;
END $$;
