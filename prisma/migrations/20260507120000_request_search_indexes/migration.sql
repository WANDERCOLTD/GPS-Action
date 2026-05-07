-- bu-search-includes-kanban / D078 §6 / ADR-0004 sibling. Extends the
-- pg_trgm GIN index set to cover Request.title and Request.body so the
-- search service can search kanban tickets (status='active' or
-- 'backlog') with the same fast, typo-tolerant substring match the
-- four entity types from #183 use.
--
-- Forward-only and additive — no existing rows touched, no schema
-- changes to `prisma/schema.prisma` (mirrors the Post/User/Region
-- pattern from 20260503100000_search_trgm_indexes — indexes live in
-- raw migrations, not the schema).
--
-- IF NOT EXISTS keeps the migration idempotent across replays /
-- rebuilds. The pg_trgm extension was already ensured by the prior
-- search migration; no need to re-create it here.
--
-- Reversible: the down-path is `DROP INDEX ...` (×2). No data loss.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Request_title_trgm_idx" ON "Request" USING gin ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Request_body_trgm_idx" ON "Request" USING gin ("body" gin_trgm_ops);
