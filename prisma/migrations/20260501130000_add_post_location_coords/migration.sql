-- BU-calendar-near-me / D076 / ADR-0002. Structured event location
-- coordinates (`latitude`, `longitude`) + online-event flag (`isOnline`)
-- on Post.
--
-- Three additive columns + one composite B-tree index. Forward-only,
-- idempotent: every existing Post row gets NULL for `latitude` /
-- `longitude` and `false` for `isOnline`. No backfill required —
-- seed data is updated in a separate code change to populate the
-- eight event-bearing seed posts.
--
-- Storage convention: WGS84 decimal degrees in Float columns. The
-- distance computation lives in `shared/geo.ts` as a Haversine
-- function so the same code runs on the server (for kindSlugs filter)
-- and the client (for after-location-set re-sorting).
--
-- Plain B-tree on (latitude, longitude) is acceptable at MVP scale
-- even though most rows have NULL values; the natural promotion is
-- a PostGIS GiST index once the table grows.

-- AlterTable
ALTER TABLE "Post"
  ADD COLUMN "latitude"  DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "isOnline"  BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Post_latitude_longitude_idx" ON "Post"("latitude", "longitude");
