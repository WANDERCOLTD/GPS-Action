-- bu-review-split
--
-- Seeds the admin-tunable discriminator for the /network vs /review
-- split. Value is a JSON array of chat_id strings; items posted in
-- those chats route to /review instead of /network.
--
-- Default: empty array. Admin sets the actual chat_id(s) once Grant
-- has a designated review WhatsApp channel. Until Grant ships a
-- per-message kind field upstream, chat_id is the discriminator.
--
-- Idempotent insert — re-running migrate deploy doesn't churn the
-- value.

INSERT INTO "SystemSetting" ("id", "key", "value", "updatedAt") VALUES
  (gen_random_uuid(), 'network_review_chat_ids', '[]', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
