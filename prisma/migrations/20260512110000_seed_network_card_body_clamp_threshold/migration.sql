-- bu-network-card-body-clamp
--
-- Seeds the admin-tunable threshold for the /network card body clamp.
-- When a card's body exceeds N rendered lines, the client clamps to
-- 3 lines and renders a "Show more" toggle. Default 6 — picked in
-- the brief's design pass as the smallest value where the toggle
-- starts to feel worth it (a 4-line body wouldn't save enough to
-- justify a tap).
--
-- Idempotent insert (ON CONFLICT DO NOTHING) so re-running migrate
-- deploy doesn't churn the value; admins tune via the /settings UI
-- (or `setSystemSetting` directly) once seeded.

INSERT INTO "SystemSetting" ("id", "key", "value", "updatedAt") VALUES
  (gen_random_uuid(), 'network_card_body_clamp_threshold_lines', '6', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
