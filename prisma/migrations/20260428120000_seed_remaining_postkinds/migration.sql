-- D070 follow-up: the BU-tick-or-cross hotfix (PR #133) seeded the
-- 'tick_or_cross' PostKind via migration but left 7 other code-
-- referenced slugs (per shared/post-kinds.ts) seed-only. Without this
-- migration, a fresh DB that runs `prisma migrate deploy` without
-- `db:seed` ends up with only 'happening_now' (from the AlertCategory
-- → PostKind migration) and 'tick_or_cross' (from PR #133), missing
-- the other 7. The boot-time invariant + check:reference-data gate
-- then fail.
--
-- This migration finishes the job — every slug in
-- shared/post-kinds.ts is now inserted by an idempotent migration.
-- Row values mirror scripts/seed.ts:461-522.
--
-- ON CONFLICT (slug) DO NOTHING means re-running on environments that
-- already have the rows (any env where db:seed has been run, or where
-- previous AlertCategory rows existed) is a safe no-op.

INSERT INTO "PostKind" ("id", "slug", "displayName", "icon", "sortOrder", "isAlertEligible", "createdAt") VALUES
  (gen_random_uuid(), 'meeting',        'Meeting',         'users',          10, true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'cultural',       'Cultural moment', 'feather',        20, false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'call_to_action', 'Call to action',  'megaphone',      30, false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'outcome',        'Outcome',         'pin',            40, false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'thought',        'Just a thought',  'message-circle', 50, false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'link_share',     'Share a link',    'link',           60, false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'event',          'Event',           'calendar-days',  70, false, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;
