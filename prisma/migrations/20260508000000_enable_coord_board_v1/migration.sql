-- @adr D036 D070
-- @build-unit bu-coordination-board (build seq #8 — flag flip)
--
-- Flip `coord_board_v1` ON globally so members behind the gate see the
-- Board tab in `AppNav` and the kanban / ticket-detail / notifications
-- surfaces it gates. Final step in the 8-PR build sequence; until this
-- runs, all coord-board surfaces redirect to /feed in production even
-- though the code has shipped.
--
-- Idempotency: UPDATE on a single row keyed by the unique `name`
-- column. Re-running this migration on a DB where the flag is already
-- ON is a no-op (the row's value is already true). Subsequent admin
-- edits via the FeatureFlag CRUD path are NOT overwritten — this
-- migration runs exactly once per environment via `prisma migrate
-- deploy`'s journal.

UPDATE "FeatureFlag"
   SET "enabledGlobally" = TRUE,
       "updatedAt" = NOW()
 WHERE "name" = 'coord_board_v1';
