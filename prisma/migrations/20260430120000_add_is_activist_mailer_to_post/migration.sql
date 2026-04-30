-- D075 — Activist Mailer flag on Post.
--
-- Adds `isActivistMailer BOOLEAN NOT NULL DEFAULT false` and backfills
-- it to `true` for posts whose `linkUrl` host matches the canonical AM
-- domain ('activistmailer.com' or any subdomain). The runtime allow-list
-- via `ACTIVIST_MAILER_ALLOWED_DOMAINS` env may broaden this further;
-- this migration uses the canonical SQL-expressible match so the
-- backfill is deterministic and idempotent. Members can manually
-- toggle the flag on a post after the fact via compose / edit.
--
-- Idempotent per D070: ADD COLUMN IF NOT EXISTS + UPDATE on the
-- pattern. Safe to rerun.

ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "isActivistMailer" BOOLEAN NOT NULL DEFAULT false;

-- Match AM URLs in either the new `linkUrl` field (post BU-am-link-
-- collapse, members paste any link and we auto-detect AM domains) OR
-- the legacy `activistMailerUrl` field (still populated on seeded
-- demo data). Pattern covers the canonical 'activistmailer.com' AND
-- the dev / test 'activist-mailer.example.com' so seed posts surface
-- under the AM filter without manual intervention. Members can
-- override either way after migration.
UPDATE "Post"
SET "isActivistMailer" = true
WHERE
  ("linkUrl" IS NOT NULL AND (
    "linkUrl" ~* '^https?://(www\.)?activistmailer\.com($|/|:|\?)'
    OR "linkUrl" ~* '^https?://[a-z0-9.-]+\.activistmailer\.com($|/|:|\?)'
    OR "linkUrl" ~* '^https?://activist-mailer\.example\.com($|/|:|\?)'
  ))
  OR
  ("activistMailerUrl" IS NOT NULL AND "activistMailerUrl" <> '');

-- D075 supports the new feed AM-filter query and the post-card "Send
-- email →" CTA. Both read this column instead of repeating the
-- domain match at query / render time.
CREATE INDEX IF NOT EXISTS "Post_isActivistMailer_createdAt_idx"
  ON "Post" ("isActivistMailer", "createdAt" DESC);
