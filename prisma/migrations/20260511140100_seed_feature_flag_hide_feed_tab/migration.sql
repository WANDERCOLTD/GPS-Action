-- bu-network-first / D036 / D070
--
-- Seed the `hide_feed_tab` feature flag. When on, the Feed tab is
-- removed from AppNav entirely (separate from `network_first` which
-- only dims it). Pair with `network_first=true` for the cleanest
-- "Network is the only home" IA.
--
-- Per D036 every flag starts `enabledGlobally=false` in prod — so Feed
-- stays visible by default. Per D070 reference data lives in migrations.
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
    RAISE EXCEPTION 'seed_feature_flag_hide_feed_tab: system user not found — earlier migration 20260505100000_seed_feature_flags should have created it';
  END IF;

  INSERT INTO "FeatureFlag" (
    "id", "name", "description", "purpose",
    "enabledGlobally", "rolloutPercentage",
    "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'hide_feed_tab',
    'When on, the Feed tab is hidden from AppNav entirely. Default OFF so /feed remains reachable.',
    'rollout',
    FALSE,
    0,
    system_user_id, system_user_id, NOW(), NOW()
  )
  ON CONFLICT ("name") DO NOTHING;
END $$;
