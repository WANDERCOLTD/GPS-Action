-- bu-network-first / D036 / D070
--
-- Seed the `network_first` feature flag. When on:
--   - Root `/` redirects authenticated users to `/network` (was `/feed`).
--   - Feed / Calendar / Requests tabs in AppNav render at 40% opacity
--     to signal "legacy surface" while Network is the primary one.
--
-- Per D036 every flag starts `enabledGlobally=false` in prod. Dev can flip
-- via admin UI when ready to demo the network-first IA.
-- Per D070 reference data lives in migrations, not seed.ts.
--
-- Idempotency: ON CONFLICT (name) DO NOTHING.

DO $$
DECLARE
  system_user_id TEXT;
BEGIN
  SELECT "id" INTO system_user_id
  FROM "User"
  WHERE "email" = 'system@gps-action.test'
  LIMIT 1;

  IF system_user_id IS NULL THEN
    RAISE EXCEPTION 'seed_feature_flag_network_first: system user not found — earlier migration 20260505100000_seed_feature_flags should have created it';
  END IF;

  INSERT INTO "FeatureFlag" (
    "id", "name", "description", "purpose",
    "enabledGlobally", "rolloutPercentage",
    "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'network_first',
    'Treat /network as the primary surface — root redirects there, and Feed/Calendar/Requests nav tabs dim to 40% opacity.',
    'rollout',
    FALSE,
    0,
    system_user_id, system_user_id, NOW(), NOW()
  )
  ON CONFLICT ("name") DO NOTHING;
END $$;
