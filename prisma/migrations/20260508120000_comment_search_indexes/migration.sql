-- bu-search-includes-comments / D078 §2 (lifted: public-thread case
-- only) / ADR-0004 sibling. Extends the pg_trgm GIN index set to cover
-- Comment.body so `searchComments` can substring-match the body of
-- public thread comments with the same fast plan the Post / Request /
-- User / Region indexes use.
--
-- Forward-only and additive — no existing rows touched, no schema
-- changes to `prisma/schema.prisma` (mirrors the prior search
-- migrations: indexes live in raw migrations, not the schema).
--
-- IF NOT EXISTS keeps the migration idempotent across replays /
-- rebuilds. The pg_trgm extension was already ensured by
-- 20260503100000_search_trgm_indexes; no need to re-create it here.
--
-- Reversible: the down-path is `DROP INDEX ...`. No data loss.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_body_trgm_idx" ON "Comment" USING gin ("body" gin_trgm_ops);
