---
slug: bu-calendar-near-me
status: shipped
phase: 2
priority: medium
shipped_in: "#169"
note: "Path A — hand-coded coords on seeded events. Path B (composer-side geocoding) is parked. Builds on bu-calendar-view + bu-event-time."
---

# SESSION BRIEF · BU-calendar-near-me — distance-sorted Near-me tab on /calendar

_Brief version: 1.0 · Author: Paul · Date: 2026-05-01_

---

## Objective

Add a third tab to `/calendar` (Agenda · Month · **Near me**) that
shows in-person event-bearing posts ordered by Haversine distance
from the caller's location. Caller location is supplied at runtime
either via `navigator.geolocation` or by typing a UK postcode
(resolved via `postcodes.io`). Online events are excluded from this
view.

This is **Path A**: coordinates ride on hand-coded seed entries today.
Path B (composer-side geocoding pipeline) is deferred to a follow-up
BU — see parking-lot entry "Geocoding pipeline for post locations".

---

## Pre-requisites

- bu-calendar-view + bu-event-time merged (this BU adds the third
  tab; the schema for `eventAt` / `locationText` already exists).
- ADR-0002 covers the schema additions: `latitude Float?`,
  `longitude Float?`, `isOnline Boolean @default(false)`.

---

## Scope

### Build in this session

- **Schema (D076):** Three additive columns on `Post` + composite
  index on `(latitude, longitude)`. Forward-only migration, no
  backfill required.
- **Shared (`shared/geo.ts`):** `haversineKm` (great-circle distance)
  + `geocodeUkPostcode` (postcodes.io wrapper, client-side fetch).
- **Seed (Path A):** Hand-pick UK lat/lng on the 8 event-bearing
  seed posts; flag online events with `isOnline=true`.
- **Server:** `post.listNearby` tRPC query — distance-sorted, app-side
  Haversine, mirrors `listUpcoming` visibility rules. Adds
  `latitude/longitude/isOnline` projection to `PostListItem`.
- **Client UI:**
  - `CalendarToggle` switches to icon chips (List · CalendarDays ·
    MapPin); aria-label preserves wording.
  - `app/calendar/NearMeView.tsx` (new) — prompt → locating →
    located states; postcode form fallback when geolocation denied.
  - `?view=near` URL contract + `?sort=date|distance` (default
    distance).

### Out of scope (parked)

- Composer-side geocoding pipeline (Path B). Pre-build decisions still
  open (Nominatim ToS, opt-in default, coordinate-precision rounding
  for privacy). Tracked in `docs/product/parking-lot.md`.
- Server-side region bounding (PostGIS).
- "Within X km" hard filter — sort is enough at MVP.
- Member-level privacy controls on coordinate visibility.

---

## Decisions baked in

- **Float over PostGIS.** Six-line Haversine works fine at MVP scale.
  PostGIS is the natural promotion path when Phase 3 needs
  region-bounded queries.
- **`isOnline` is the exclusion gate, not `locationText`.** Free-text
  scanning for "Online" / "Zoom" is brittle; the explicit flag carries
  authorial intent.
- **Postcodes.io is client-side only.** It rate-limits per source IP;
  routing it through the server would funnel every member through one
  shared rate bucket.
- **No `distanceKm` on PostListItem.** Distance is caller-relative, so
  it's only meaningful in the `listNearby` projection — which adds it
  to a `NearbyPost` extension type.

---

## Definition of done

- `/calendar?view=near` renders the candidate list, allows location
  selection, sorts by Haversine distance after coords land.
- Online events and NULL-coord rows are filtered out.
- `?sort=date` flips to event-start ordering; URL is the source of
  truth (back button restores).
- Unit tests: `haversineKm`, `geocodeUkPostcode`, `sortNearMePosts`,
  `NearMeViewBody` state matrix.
- Integration tests: `post.listNearby` query shape;
  `/calendar?view=near` renders NearMeView with the right candidates.
- Trace matrix regenerated; trackers up to date.
