-- @adr D036 D070
-- Per D070: reference data lives in migrations, not seed.ts. The four
-- active flags in `docs/product/feature-flag-register.md` were never
-- migrated into prod; admin-CRUD path was the de-facto creation route
-- but rows were missing on the Vercel DB. This migration plugs that
-- gap idempotently.
--
-- Idempotency:
--   - ON CONFLICT (email) DO NOTHING on the system user.
--   - ON CONFLICT (name)  DO NOTHING on each FeatureFlag row.
-- Re-running this migration on a DB that already has these rows is a
-- no-op. Manual admin edits (renames, flips, TTL extensions) are NOT
-- overwritten — the conflict path leaves the existing row intact.

-- ─── Step 1: ensure the system user exists ──────────────────────────────────
--
-- The 'system@gps-action.test' email matches SYSTEM_USER_EMAIL in
-- server/services/request.ts. The request service upserts on demand to
-- author system-comments; here we ensure the row exists earlier so the
-- FeatureFlag inserts (which reference it) don't fail.

INSERT INTO "User" ("id", "email", "displayName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'system@gps-action.test',
  'system',
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO NOTHING;

-- ─── Step 2: insert each FeatureFlag in the register ────────────────────────
--
-- Wrapped in a DO block to capture the system user's id once and reuse
-- it across the four inserts. Source of truth is
-- docs/product/feature-flag-register.md.

DO $$
DECLARE
  system_user_id TEXT;
BEGIN
  SELECT "id" INTO system_user_id
  FROM "User"
  WHERE "email" = 'system@gps-action.test'
  LIMIT 1;

  IF system_user_id IS NULL THEN
    RAISE EXCEPTION 'seed_feature_flags: system user not found after step 1 — aborting';
  END IF;

  -- ff_reactions — rolled out, kept ON in prod (kill-switch path).
  INSERT INTO "FeatureFlag" (
    "id", "name", "description", "purpose",
    "enabledGlobally", "rolloutPercentage",
    "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'ff_reactions',
    'Quiet, multi-select reactions on posts (BU-reactions / D050).',
    'rollout',
    TRUE,
    0,
    system_user_id, system_user_id, NOW(), NOW()
  )
  ON CONFLICT ("name") DO NOTHING;

  -- ff_comments — rolled out, kept ON in prod (kill-switch path).
  INSERT INTO "FeatureFlag" (
    "id", "name", "description", "purpose",
    "enabledGlobally", "rolloutPercentage",
    "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'ff_comments',
    'Post-detail page + flat comment thread (BU-comments / D052).',
    'rollout',
    TRUE,
    0,
    system_user_id, system_user_id, NOW(), NOW()
  )
  ON CONFLICT ("name") DO NOTHING;

  -- calendar_enabled — gated rollout, OFF in prod.
  INSERT INTO "FeatureFlag" (
    "id", "name", "description", "purpose",
    "enabledGlobally", "rolloutPercentage",
    "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'calendar_enabled',
    'Calendar tab + agenda + month surfaces (BU-calendar-view / D073).',
    'rollout',
    FALSE,
    0,
    system_user_id, system_user_id, NOW(), NOW()
  )
  ON CONFLICT ("name") DO NOTHING;

  -- coord_board_v1 — gated build, OFF in both prod and dev.
  INSERT INTO "FeatureFlag" (
    "id", "name", "description", "purpose",
    "enabledGlobally", "rolloutPercentage",
    "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'coord_board_v1',
    'Coordination board surfaces — picker, kanban, ticket detail, notifications (bu-coordination-board).',
    'rollout',
    FALSE,
    0,
    system_user_id, system_user_id, NOW(), NOW()
  )
  ON CONFLICT ("name") DO NOTHING;
END $$;
