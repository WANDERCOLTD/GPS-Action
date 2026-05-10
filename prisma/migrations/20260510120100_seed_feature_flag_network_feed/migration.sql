-- bu-network-feed / D036 / D070 / D083
--
-- Seed the `network_feed` feature flag idempotently. Per D036 every flag
-- starts `enabledGlobally=false` in prod (gated rollout). Dev defaults are
-- handled by environment-specific overrides in admin UI; the seed plants
-- the row with the prod-safe state.
--
-- Per D070: reference data lives in migrations, not seed.ts. Without this
-- row in prod, the fail-closed evaluator returns `false` regardless of
-- code-level defaults — and the feature would silently never render.
--
-- Idempotency: ON CONFLICT (name) DO NOTHING. Re-running is a no-op.
-- Manual admin edits (renames, flips, TTL extensions) are NOT overwritten.

DO $$
DECLARE
  system_user_id TEXT;
BEGIN
  SELECT "id" INTO system_user_id
  FROM "User"
  WHERE "email" = 'system@gps-action.test'
  LIMIT 1;

  IF system_user_id IS NULL THEN
    RAISE EXCEPTION 'seed_feature_flag_network_feed: system user not found — earlier migration 20260505100000_seed_feature_flags should have created it';
  END IF;

  -- network_feed — gated build, OFF in prod, OFF in dev until first
  -- coordinator sign-off.
  INSERT INTO "FeatureFlag" (
    "id", "name", "description", "purpose",
    "enabledGlobally", "rolloutPercentage",
    "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'network_feed',
    '/network — read-only surface for Grant (AIFA)''s WhatsApp-link feed (bu-network-feed / ADR-0017).',
    'rollout',
    FALSE,
    0,
    system_user_id, system_user_id, NOW(), NOW()
  )
  ON CONFLICT ("name") DO NOTHING;
END $$;
