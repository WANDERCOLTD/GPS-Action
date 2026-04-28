-- BU-tick-or-cross hotfix (D070): the BU-tick-or-cross feature shipped
-- (PR #129) with a Signal enum and Post.signal column but did NOT
-- insert the 'tick_or_cross' PostKind row that the composer relies on.
-- Without this row, kindMap['tick_or_cross'] is undefined → the
-- composer submits without kindId → the service throws "signal is
-- only valid for tick_or_cross posts".
--
-- Per D070, reference-data rows ship with idempotent migrations, not
-- seed scripts. ON CONFLICT (slug) DO NOTHING means re-running this
-- migration on environments that already have the row (dev DBs that
-- were manually patched, environments where db:seed was re-run) is a
-- safe no-op.
--
-- Row values mirror scripts/seed.ts:472-478.

INSERT INTO "PostKind" ("id", "slug", "displayName", "icon", "sortOrder", "isAlertEligible", "createdAt")
VALUES (gen_random_uuid(), 'tick_or_cross', '✅ or ❌', 'check-square', 5, false, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;
