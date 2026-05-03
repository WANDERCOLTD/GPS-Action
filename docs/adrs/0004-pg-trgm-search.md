# ADR-0004 · `pg_trgm` extension + GIN indexes for app-wide member search

**Status:** Accepted (migration shipped 2026-05-03 in `20260503100000_search_trgm_indexes`)
**Date:** 2026-05-02 (proposed) · 2026-05-03 (accepted on migration land)
**Deciders:** Paul (product), Claude Code Session N (spec assembly)

## Context

The product brief **bu-search-surface** wants a magnifier-in-AppNav
overlay that returns grouped results (Posts · People · Regions ·
Partner orgs) for any free-text query. Decisions captured during
brief assembly (2026-05-01) lock the backend as **native Postgres,
no third-party** — Algolia, Meilisearch, and similar SaaS
alternatives are explicitly out (D078 §1).

`prisma/schema.prisma` is contract-locked (CLAUDE.md). A search
backend that wants to be fast and typo-tolerant cannot ship without
either a Postgres extension or a JS-side fuzzy library (slow at
scale). This ADR captures the extension-and-index decision so that
a build session can run the migration without further architectural
debate.

Members type queries on phones — typo rate is non-trivial
("hendon" mistyped as "henden", "gilead" as "gileed"). A backend
that returns zero results for `henden` reads as broken even though
the post exists. Typo tolerance at the database layer is therefore
not a polish item but the v1 design.

## Options considered

- **Option A — Plain `ILIKE '%q%'` with no special index.**
  - Pros: Zero infra change. No extension, no migration risk.
    Smallest code path.
  - Cons: Sequential scan on substring match; latency grows
    linearly with row count. No typo tolerance — `henden` returns
    zero. At pilot scale (<1k posts) it's fine; at network-of-50
    scale it isn't.

- **Option B — Postgres `tsvector` + GIN (full-text search).**
  - Pros: Excellent for long-form text (post bodies). Stems words,
    weights matches, ranks by relevance. Mature, well-documented.
  - Cons: No typo tolerance (stems but doesn't fuzzy-match). Weaker
    fit for short strings (names, region codes, partner-org
    handles). Configuration cost (text search config, language
    dictionaries) for marginal gain on the dominant query type.

- **Option C — `pg_trgm` extension + GIN trigram indexes.**
  - Pros: Typo-tolerant out of the box (`henden` finds `hendon`
    via similarity threshold). Fast substring match via GIN. Same
    operator (`%` / `similarity()`) across all indexed columns.
    Single extension covers all 5 columns we want to search.
  - Cons: Requires a Postgres extension (not a Prisma-native
    feature). GIN indexes are ~2–3× the underlying column size on
    disk. Slight write cost — every INSERT/UPDATE on indexed
    columns updates the GIN index too. None of these are material
    at our scale.

- **Option D — Third-party search service (Algolia, Meilisearch).**
  - Pros: Best-in-class ranking, instant search, dashboards.
  - Cons: New vendor dependency, new auth/CORS surface, ongoing
    cost, sync pipeline to keep Postgres and the index aligned.
    Explicitly rejected by D078 §1 (native Postgres only).

## Decision

We will adopt **Option C — `pg_trgm` + GIN**.

The migration `20260503100000_search_trgm_indexes/migration.sql`
creates the extension and four indexes (the actual SQL — column
names match the Prisma schema, which uses `displayName`, not
`name`, on both `User` and `Region`):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Post_title_trgm_idx"
  ON "Post" USING gin ("title" gin_trgm_ops);
CREATE INDEX "Post_body_trgm_idx"
  ON "Post" USING gin ("body" gin_trgm_ops);
CREATE INDEX "User_displayName_trgm_idx"
  ON "User" USING gin ("displayName" gin_trgm_ops);
CREATE INDEX "Region_displayName_trgm_idx"
  ON "Region" USING gin ("displayName" gin_trgm_ops);
-- partner-orgs index deferred until §3.30 ships (D078 §9).
```

The service layer queries via the `%` operator (or
`similarity() > threshold`); threshold tunes from the default 0.3
based on pilot feedback (D078 §6 note).

`posts.body` is the largest indexable column. If body sizes grow
into the multi-kilobyte range during pilot, a future ADR may swap
the body-only index from trigram to `tsvector`; the router shape
absorbs that swap without API change (D078 §1 note).

## Reasoning

Typo tolerance is the differentiator. Plain `ILIKE` ships fast but
is the wrong v1 product — members will hit the empty-state on
typos and read it as broken. `tsvector` is excellent for one
scenario (body relevance) but a worse fit for the dominant
short-string queries (names, regions). External services solve a
problem we don't have (network-scale ranking) at a cost we won't
pay (vendor lock-in).

Trigram-on-everything is the single uniform mechanism that covers
all five entity types. One extension, one index family, one query
operator. The only real downside (index size) is immaterial at our
data scale and stays immaterial through the realistic next 12
months.

Shipping `ILIKE` first and upgrading later was considered and
rejected: the migration cost is small enough that doing it twice
is wasteful, and the upgrade window would re-open every brief
decision the team already closed.

## Consequences

- **One additive forward-only migration**: extension + 4 GIN
  indexes (5th gated on §3.30). No backfill, no data movement.
- **Build session prerequisite:** Postgres role running the
  migration must be able to `CREATE EXTENSION`. AWS RDS
  (eu-west-2) supports `pg_trgm` on Postgres ≥9.6 without
  superuser; the `rds_superuser` role's grants cover this.
- **Search service** in `server/services/search.ts` is single-
  algorithm: trigram similarity. The router shape stays
  pluggable (could swap individual columns to `tsvector` without
  client-side changes) but no current need.
- **Rollback path:** drop indexes, drop extension. No cascade,
  no parent schema impact.
- **Index storage:** ~2–3× the indexed column data on disk. At
  current row counts (~1k posts, ~hundreds of users, ~tens of
  regions), the absolute size is negligible.
- **Write amplification:** every INSERT/UPDATE on an indexed
  column updates the trigram index. Negligible at our write
  volume; revisit if write QPS grows by 10×.
- **Local-dev parity:** `prisma migrate deploy` runs the extension
  creation in dev/CI/preview/prod. Dev databases on Postgres
  ≥9.6 support `pg_trgm` natively.

## Notes

- The index column list is locked (D078 §6) but the GIN ops class
  is `gin_trgm_ops` for all five — no per-column tuning v1.
- Similarity threshold defaults to 0.3 (Postgres default).
  D078 §6 marks this as tuneable from pilot data, not blocking.
- Comment search is excluded from v1 (D078 §2). The `Comment`
  table is intentionally not indexed here.
