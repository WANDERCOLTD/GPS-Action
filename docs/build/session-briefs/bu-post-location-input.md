---
slug: bu-post-location-input
status: planned
phase: 2
priority: medium
note: "Slice of the parking-lot 'Geocoding pipeline for post locations (Path B)' entry — UK postcode-only via postcodes.io. No Nominatim fallback, no backfill flow, no privacy opt-in toggle. Builds on bu-calendar-near-me (which added the columns and the `geocodeUkPostcode` helper)."
---

# SESSION BRIEF · BU-post-location-input — postcode + isOnline on the composer / edit form

_Brief version: 1.0 · Author: Paul · Date: 2026-05-01_

---

## Objective

Let members add a structured location to their event-bearing posts via
the UI. Reuse the `geocodeUkPostcode` helper introduced by
bu-calendar-near-me (Path A). Two new fields appear on the composer
and the post-edit form when the active kind is time-bearing
(`meeting` / `event` / `happening_now`):

- **UK postcode** (`<input type="text">`) — geocoded via postcodes.io
  at submit; coords land on `Post.latitude` / `Post.longitude`.
- **This is online** (`<input type="checkbox">`) — when checked, the
  postcode field is disabled and the server forces both coords to
  `null` regardless of caller-supplied values.

This is the smallest forward step from Path A — coords appear on
member-authored posts so they show up in `/calendar?view=near`.

---

## Pre-requisites

- bu-calendar-near-me merged (schema + `geocodeUkPostcode` helper).
- bu-event-time merged (`kindIsTimeBearing` gate; `EventFieldsBlock`).

---

## Scope

- **In:** composer + edit form fields, FormData → schema wiring,
  `createPost` + `updatePost` accepting `latitude` / `longitude` /
  `isOnline`, idempotent seed-update of the new columns.
- **Out:** Nominatim / non-UK geocoding (still parking-lot Path B
  follow-up), privacy opt-in toggle, backfill flow for already-
  authored posts, reverse-geocoding existing coords back to a
  postcode on the edit form.

---

## Build list

1. `components/PostLocationFieldsBlock.tsx` — shared block used by
   composer + edit. Postcode input + isOnline checkbox; lifted state.
2. `components/PostForm.tsx` — render the block when the active kind
   is time-bearing; geocode at submit; surface inline error on
   failure.
3. `components/EditPostForm.tsx` — same wiring, plus pre-fill rules
   (isOnline from current value; postcode always blank).
4. `shared/validation/post.ts` — `latitude` / `longitude` / `isOnline`
   on `postCreateSchema` + `postUpdateSchema`.
5. `app/compose/actions.ts` + `app/post/[id]/edit/actions.ts` — read
   FormData, forward to the schemas.
6. `server/services/post.ts` — `createPost` + `updatePost` write the
   new columns; `isOnline=true` forces coords to null (defence in
   depth).
7. `scripts/seed.ts` — idempotent backfill so a re-run reconciles
   declared vs current coords / isOnline.
8. Tests — pipeline tests for the four critical paths (geocode happy,
   invalid, online-overrides-postcode, edit-preserves-blank); Zod
   bounds tests for lat/lng.

---

## Decisions surfaced

- **Postcode-only (UK)**: Nominatim deferred to a later BU when
  non-UK members appear or rate-limit budgeting becomes worth the
  ceremony.
- **No reverse-geocode on edit**: pre-filling a postcode from coords
  is a different problem; keeping the postcode field blank by default
  means an empty submit preserves existing coords (the form sends no
  lat/lng → server skips them).
- **Online wins server-side**: `isOnline=true` forces `latitude` and
  `longitude` to `null` even when the caller supplied values. Mirrors
  the UI rule (postcode disabled while online is ticked) and protects
  seed / direct-service callers.

---

## Quality gates

- `npm run typecheck && npm run lint && npm test` — green
- `npm run trace:check && npm run trackers:check` — pass
