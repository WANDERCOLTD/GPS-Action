-- bu-network-unread-icon / D036 / D070
--
-- Seed the `network_unread_chip` feature flag. Gates the visibility
-- of the Unread-only chip on `/network` only — the `?unread=1` URL
-- param and the client-side filter remain wired up regardless of the
-- flag so existing bookmarks continue to work.
--
-- Per D036 every flag starts `enabledGlobally=false` in prod — the
-- chip stays hidden by default while we evaluate the seen-state UX.
-- Per D070 reference data lives in migrations.
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
    RAISE EXCEPTION 'seed_feature_flag_network_unread_chip: system user not found — earlier migration 20260505100000_seed_feature_flags should have created it';
  END IF;

  INSERT INTO "FeatureFlag" (
    "id", "name", "description", "purpose",
    "enabledGlobally", "rolloutPercentage",
    "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'network_unread_chip',
    'When on, the sparkles "Unread only" chip is rendered next to the sort toggle on /network. The ?unread=1 URL param and client-side filter remain wired regardless — flag gates display only.',
    'rollout',
    FALSE,
    0,
    system_user_id, system_user_id, NOW(), NOW()
  )
  ON CONFLICT ("name") DO NOTHING;
END $$;
