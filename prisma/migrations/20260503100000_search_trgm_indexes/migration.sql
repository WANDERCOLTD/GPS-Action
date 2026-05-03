-- bu-search-surface / D078 §6 / ADR-0004. Adds the `pg_trgm` extension
-- and four GIN trigram indexes to support fast, typo-tolerant
-- substring search across the four entity types in v1: Posts (title +
-- body), Users (displayName), and Regions (displayName).
--
-- Forward-only and additive — no existing rows touched, no schema
-- changes to `prisma/schema.prisma`. The extension exists at the
-- database level only; the search service queries via raw Prisma
-- `$queryRaw` (or the `%` operator wrapped in a typed helper) and
-- consumes the indexes implicitly.
--
-- Why pg_trgm + GIN over plain ILIKE: typo tolerance ("henden" finds
-- "hendon" via similarity threshold) and substring-match speed at
-- scale. Why not tsvector: weaker fit for short strings (names,
-- region codes) which dominate the query mix. Why not Algolia /
-- Meilisearch: D078 §1 — native Postgres only, no vendor sync
-- pipelines.
--
-- Partner-orgs index is intentionally absent — D078 §9 defers partner-
-- orgs as a search entity until §3.30 ships the model. When it lands
-- a sibling migration adds the fifth GIN index following the same
-- shape.
--
-- Reversible: the down-path is `DROP INDEX ...` (4×) plus
-- `DROP EXTENSION pg_trgm`. No data loss.
--
-- AWS RDS (eu-west-2) supports pg_trgm on Postgres ≥9.6 via the
-- `rds_superuser` role's grants — no superuser escalation required.
-- Local dev / CI Postgres supports it natively.

-- Extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Post_title_trgm_idx" ON "Post" USING gin ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Post_body_trgm_idx" ON "Post" USING gin ("body" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "User_displayName_trgm_idx" ON "User" USING gin ("displayName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Region_displayName_trgm_idx" ON "Region" USING gin ("displayName" gin_trgm_ops);
