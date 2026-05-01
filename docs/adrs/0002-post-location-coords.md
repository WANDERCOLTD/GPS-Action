# ADR-0002 · Post location coordinates + online-event flag (`latitude`, `longitude`, `isOnline`)

**Status:** Accepted
**Date:** 2026-05-01
**Deciders:** Paul (product), Claude Code Session L (implementation)

## Context

`Post` already carries `locationText: String?` for free-text venue
strings (added in ADR-0001 / D073) but nothing structured for distance
queries. The forthcoming **bu-calendar-near-me** wants a third tab on
`/calendar` that shows event-bearing posts ordered by distance from
the caller's geolocation (or a typed-in postcode). To do that we need
two things:

1. Real lat/lng coordinates on each in-person event, so the client
   can sort by Haversine distance after the user supplies their own
   coords.
2. A way to mark online events so they're excluded from any
   distance-based view — a "Zoom call" with `locationText` set to
   `"Online via Zoom"` should never show up next to "2.3 km away".

The composer does not yet geocode user-typed locations. Path B (the
geocoding pipeline) is parked as a follow-up BU; this ADR documents
the schema columns the demo path needs **today** so seeded events
can be hand-coded with sensible UK coordinates.

`prisma/schema.prisma` is contract-locked (CLAUDE.md), so the schema
change rides this ADR.

## Options considered

- **Option A — Three columns directly on `Post`**:
  `latitude Float?`, `longitude Float?`, `isOnline Boolean @default(false)`.
  - Pros: Same nullable-additive pattern as `eventAt` / `linkUrl` /
    `heroImageUrl`. No new tables. Trivial to read/write. Forward-only
    additive migration with no backfill.
  - Cons: Two extra rarely-set columns on an already-wide table.

- **Option B — Sidecar `PostLocation` table** keyed by `postId`,
  carrying coords + `isOnline`.
  - Pros: Keeps the `Post` row narrow.
  - Cons: Adds a join + a nullable include path on every list query.
    Premature for two columns of the same shape that the existing
    `locationText` already lives next to.

- **Option C — Single `coords` column** (Postgres `point` or `geography`).
  - Pros: Compact; future-proof for PostGIS distance queries.
  - Cons: Prisma's `point`/`geography` support is limited (raw SQL
    - custom mapper). Adds a dependency without a current need —
      the demo sorts at app-level via Haversine. Can be promoted later
      via a follow-up migration.

## Decision

We will adopt **Option A**: three new columns on `Post`.

```prisma
model Post {
  // … existing fields …

  // Structured location coordinates (BU-calendar-near-me / ADR-0002).
  // Optional; populated by hand-coded seed entries today (Path A).
  // Path B (composer geocoding pipeline) will write these on save.
  latitude  Float?
  longitude Float?

  // Online-event marker. When true, the post is excluded from
  // distance-based views (e.g. /calendar?view=near). Set by the
  // composer's "this is online" toggle when it ships; today set on
  // seeded events whose location text is "Online via Zoom" etc.
  isOnline Boolean @default(false)

  @@index([latitude, longitude])
}
```

Field shape:

| Column      | Type      | Default | Nullable | Notes                                                |
| ----------- | --------- | ------- | -------- | ---------------------------------------------------- |
| `latitude`  | `Float?`  | —       | yes      | Decimal degrees, WGS84 (range -90 to 90)             |
| `longitude` | `Float?`  | —       | yes      | Decimal degrees, WGS84 (range -180 to 180)           |
| `isOnline`  | `Boolean` | `false` | no       | True ⇒ post is an online event; exclude from Near-me |

Index: `(latitude, longitude)` — modest size given most rows are NULL,
fine at MVP scale. We're not bothering with a partial index; promotion
is a follow-up if/when the table grows.

### Path A vs Path B

- **Path A (this BU, today):** Hand-code coordinates on the eight
  event-bearing seed posts. The composer is unchanged — newly-authored
  posts get `latitude = NULL` and don't surface in Near-me. This is
  acceptable for the demo: members exploring the route see real seeded
  events, not their own untagged compositions.
- **Path B (parked, follow-up BU):** Composer wires up postcode lookup
  (postcodes.io for UK postcodes) + Nominatim/OSM fallback for street
  addresses, writes coordinates back to the post on save, and adds an
  explicit `is_online` toggle. Open questions on Nominatim ToS,
  privacy default (opt-in vs opt-out), and coordinate-precision
  rounding mean Path B isn't ready to ship yet.

## Reasoning

- **Match the established `Post` column pattern** rather than introducing
  a sidecar table for two columns of the same shape that already
  neighbour `locationText`. ADR-0001 set this precedent with `eventAt`.
- **Float over PostGIS** keeps the demo simple. Haversine in
  TypeScript is six lines, runs at ~ns per pair, and works in any
  environment without a database extension. PostGIS is the natural
  promotion path when Phase 3 adds region-bounded queries.
- **`isOnline` as a Boolean default-false** keeps the existing demo
  data quiet — every existing post defaults to "in-person" (which
  matches reality for almost all of them) and only newly-flagged
  online events flip the bit.
- **No index on `isOnline` alone.** The Near-me query filters on
  `isOnline: false AND latitude IS NOT NULL` then sorts in app code;
  the existing `eventAt` index plus the new `(lat, lng)` index covers
  the access pattern cheaply.

## Consequences

- **Easier:**
  - bu-calendar-near-me can `findMany({ where: { isOnline: false, latitude: { not: null } }, orderBy: { eventAt: 'asc' } })` and sort distance app-side.
  - Seeded events render in `/calendar?view=near` without any composer
    changes.
  - Path B has a pre-existing column shape to populate when it lands.

- **Harder:**
  - Three more columns on `Post` (the table is already wide).
  - The composer + edit page will eventually need to wire up the
    `is_online` toggle and the geocoding pipeline. That work is
    parked, not in this BU.

- **Forward-only migration.** Three additive nullable/defaulted
  columns + one composite index. No data backfill required. The
  migration is reversible via a follow-up if needed.

- **Layer boundaries respected.** Distance helpers live in
  `shared/geo.ts`; the postcode geocoder there is a client-side
  fetch and is intentionally not exported through any server-side
  boundary.

## Notes

- Recurring events, "all-day" semantics, server-side region bounding
  (PostGIS), and member-level privacy controls on coordinate visibility
  are explicitly out of scope here and live in `docs/product/parking-lot.md`.
- See decision-log entry **D076** (this PR) for the cross-reference.

## Related

- D013 — Self-dispatch is the default (calendar is read-only routing surface).
- D041 — Region as optional tag only; no filtering in MVP (lat/lng is
  member-level, not server-bounded — same spirit).
- D070 — Reference data ships in migrations (no new reference rows
  here, only column adds).
- D073 / ADR-0001 — Structured event-time fields (the precedent for
  this additive-column pattern, and the sister fields Near-me composes
  with).
- bu-calendar-near-me brief — the implementation contract.
