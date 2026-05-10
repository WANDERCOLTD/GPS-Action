-- bu-network-link-previews / D036 / D070
--
-- Seed the `network_link_previews` feature flag idempotently. Per D036
-- every flag starts `enabledGlobally=false` in prod (gated rollout).
-- Dev defaults are handled by `scripts/seed.ts` which bulk-flips every
-- flag ON after migrations apply.
--
-- Per D070: reference data lives in migrations, not seed.ts. Without
-- this row in prod, the fail-closed evaluator returns `false` regardless
-- of code-level defaults — and the OG-fetch enrichment would silently
-- never run.
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
    RAISE EXCEPTION 'seed_feature_flag_network_link_previews: system user not found — earlier migration 20260505100000_seed_feature_flags should have created it';
  END IF;

  -- network_link_previews — gated enrichment of /network cards with
  -- OpenGraph previews. Reuses the existing fetchLinkMetadata fetcher
  -- (server/services/link-metadata.ts) and the LinkPreviewCard render
  -- component. OFF in prod until coordinator sign-off; ON in dev via
  -- the seed.ts bulk-flip.
  INSERT INTO "FeatureFlag" (
    "id", "name", "description", "purpose",
    "enabledGlobally", "rolloutPercentage",
    "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    'network_link_previews',
    '/network — OpenGraph hero/title/description previews on cards (bu-network-link-previews).',
    'rollout',
    FALSE,
    0,
    system_user_id, system_user_id, NOW(), NOW()
  )
  ON CONFLICT ("name") DO NOTHING;
END $$;
