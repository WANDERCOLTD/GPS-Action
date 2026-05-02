---
slug: bu-postcode-or-place
status: stub
phase: 2
priority: medium
note: "Plan-only brief. Extends BU-post-location-input + BU-calendar-near-me's single field from postcode-only to 'postcode OR town/city/area' with one input. Adds Nominatim (OpenStreetMap) as the free-text geocoder behind a chained resolver. Two architectural variants surfaced for Paul to pick (client-side vs server proxy) — Nominatim's User-Agent policy + browser CORS make this a real choice, not a coin flip. See engineering-roadmap B17 for the Mapbox swap trigger."
---

# SESSION BRIEF · bu-postcode-or-place — One field, postcode or place

_Brief version: 0.1 (stub) · Author: Paul · Date: 2026-05-02_

---

## Objective

Let members type **either a UK postcode OR a town / city / area name**
into the same single input on `/calendar?view=near` (and, in scope,
the post composer's location field too). Behind the scenes we chain
two resolvers:

1. **UK postcode regex match** → resolve via `postcodes.io` (current
   path, unchanged).
2. **Otherwise** → resolve as free-text place via **Nominatim**
   (OpenStreetMap) biased to UK results.

Both paths return `LatLng | null`; downstream Haversine sort and
distance display are unchanged.

This closes the v0.2.53 friction surfaced by typing `Bristol` into
the Near-me field today and getting "Could not find that postcode".

---

## Pre-requisites

- BU-post-location-input merged (#171) — the postcode field exists
  on the composer + edit form.
- BU-calendar-near-me merged — `geocodeUkPostcode` + Haversine
  helpers in `shared/geo.ts`.
- v0.2.53 merged (BU-icon-strips, #174) — the chip strip work that
  was just shipped doesn't gate this BU but confirms a clean main.

---

## UX flow (single field, two resolvers)

**Resolution order on submit (Find button or Enter key):**

1. **Trim + uppercase** the input. If it matches the UK postcode
   regex (full or outward+sector form) → `postcodes.io`. On success
   → done. On 404 → fall through.
2. **Place lookup** (Nominatim or proxied equivalent) with
   `countrycodes=gb&limit=1`. On success → done. On no result → fail.
3. **No result either way** → show a single friendly error: "Couldn't
   find that location. Try a UK postcode, town or city." (Replaces
   today's postcode-specific copy.)

**Copy changes:**

| Surface       | Today                                           | Proposed                                                                                  |
| ------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Placeholder   | _(none — empty input)_                          | `UK postcode, town or city`                                                                |
| Helper line   | "Allow your location, or type a UK postcode…"   | "Allow your location, or type a UK postcode, town or city — to find in-person events sorted by distance." |
| Error (fail)  | "Could not find that postcode. Check the spelling and try again." | "Couldn't find that location. Try a UK postcode, town or city." |
| Error (network down) | _(silent fail today — returns null, shows the same postcode error)_ | "Couldn't reach the location service. Try again in a moment." |

---

## Scenarios — every input we expect

| # | Input                  | Resolution path                          | Expected behaviour                                     |
| --- | ---------------------- | ---------------------------------------- | ------------------------------------------------------ |
| S1 | `BS1 4DJ`              | postcode regex → postcodes.io            | Bristol BS1 4DJ exact lat/lng                           |
| S2 | `bs1 4dj`              | postcode regex (case-insensitive)        | Same as S1                                             |
| S3 | `BS14DJ`               | postcode regex (whitespace stripped)     | Same as S1                                             |
| S4 | `BS1`                  | postcode regex partial-match → postcodes.io 404 → falls through to place | Bristol centroid via Nominatim |
| S5 | `Bristol`              | place                                    | Bristol city centroid                                  |
| S6 | `bristol`              | place (case-insensitive)                 | Same as S5                                             |
| S7 | `Manchester`           | place + `countrycodes=gb`                | Manchester, England (NOT Manchester, NH)              |
| S8 | `Manchester, UK`       | place                                    | Same as S7 (free text with comma is fine)              |
| S9 | `North London`         | place                                    | Centroid of "North London" admin area                  |
| S10 | `Hackney`             | place                                    | Borough of Hackney centroid                            |
| S11 | `10 Downing Street`   | place                                    | Exact street address (Nominatim handles addresses)     |
| S12 | `Iver Heath`          | place                                    | Village centroid                                       |
| S13 | `Paris`               | place + `countrycodes=gb`                | **No result** → friendly error (UK-bias rejects Paris) — see Q4 below for the global-fallback question |
| S14 | `asdfjkl`             | place                                    | No result → friendly error                             |
| S15 | _(empty / whitespace)_| neither — short-circuit before fetch     | Silently no-op (button stays inert) — same as today    |
| S16 | `12345`               | place (numbers don't match UK postcode regex) | No result → friendly error (US zip codes won't resolve under UK bias) |
| S17 | `<script>alert(1)</script>` | place (URL-encoded)               | No result; Nominatim sanitises; we URL-encode regardless |
| S18 | _(network offline)_   | fetch throws                             | Friendly error "Couldn't reach the location service…" |
| S19 | _(Nominatim 429 / rate-limit)_ | place returns 429                | Same as S18 — friendly error, don't retry on the same input |
| S20 | _(very long string, >100 chars)_ | reject pre-fetch                | Don't bother the API; show validation error            |

---

## Architectural decision — client-side vs server proxy

**The real choice this BU has to make.** Today's `geocodeUkPostcode`
is a client-side fetch (browser → postcodes.io). Its docstring
explicitly justifies this: rate limiting is per source IP, so
funnelling everyone through our server would share one bucket.

Nominatim's [usage policy](https://operations.osmfoundation.org/policies/nominatim/)
adds three friction points that postcodes.io doesn't have:

1. **Mandatory User-Agent** identifying the application — browsers
   forbid setting `User-Agent` via `fetch()`, so a browser request
   sends the browser's UA, which Nominatim explicitly says "will
   not do."
2. **≤ 1 req/s absolute** — across our entire app, not per-IP.
3. **No bulk / heavy use** — host your own tile server if you grow.

Two viable architectures:

### Variant A — Client-side fetch (parallel to postcodes.io)

- Browser calls Nominatim directly.
- We can't set User-Agent; rely on the browser's UA + a
  `Referer: gps-action.app` header to identify ourselves.
- Risk: Nominatim may rate-limit / block our origin if they detect
  policy violations. Realistically OK at our volume but not
  guaranteed.
- Pros: matches the postcodes.io pattern; per-user IP rate-limiting.
- Cons: violates User-Agent policy; can't centralise rate limit; hard
  to swap to Mapbox (B17) later without changing where the call lives.

### Variant B — Server proxy at `/api/geocode/place`

- Browser calls our server route; server fetches Nominatim with our
  custom UA (`gps-action/0.2.x (paul@thewanders.com)`).
- Centralised rate limit (we throttle to 1 req/s across the app via
  a small in-memory token bucket on the server).
- Pros: compliant with Nominatim policy; clean swap to Mapbox later
  (B17) — only the server route changes, client code is unchanged;
  hides client IPs from the third-party.
- Cons: at scale, our single egress IP could itself get rate-limited
  by Nominatim — but the trigger to swap to Mapbox (B17) fires
  exactly when this happens, so the mitigation is built in.

**Recommendation: Variant B.** It's the policy-compliant path, the
swap to Mapbox is a one-file change, and the throughput cost (one
extra hop per Find click) is negligible. The postcodes.io call can
stay client-side as a deliberate exception (it's policy-compliant
and benefits from per-IP buckets); the new Nominatim call goes via
the server.

---

## Privacy — small but real disclosure

Today, `geocodeUkPostcode` already sends typed input to a third party
(postcodes.io). Adding Nominatim doesn't change the trust model
materially. Two choices:

1. **Silent** — same as today. Member doesn't know.
2. **One-line note under the field**: "Locations resolved via
   OpenStreetMap." Honest, doesn't scare, satisfies our "Honest copy"
   principle (#5 in `design-philosophy.md`).

**Recommend (2).** Cheap to ship, matches the project's posture.

---

## Scope

### Build

- `shared/geo.ts` (MODIFY)
  - Add `geocodePlace(query: string): Promise<LatLng | null>` —
    server-only by convention if Variant B, or co-located fetch if
    Variant A.
  - Add `resolveLocation(query: string): Promise<LatLng | null>` —
    the chained resolver: postcode regex → postcodes.io →
    `geocodePlace` fallback.
  - Add a small UK postcode regex helper (`isUkPostcodeShape`).
- `app/api/geocode/place/route.ts` (NEW — only if Variant B)
  - GET `?q=…` returns `{ lat, lng } | null` JSON.
  - Server-side token-bucket rate limit (1 req/s across the app)
    using a tiny in-memory counter; document that it's per-instance
    (Vercel may run multiple) and acceptable for MVP.
  - Sets `User-Agent: gps-action/<version> (paul@thewanders.com)`
    per Nominatim policy.
- `app/calendar/NearMeView.tsx` (MODIFY)
  - Field label / placeholder / helper / error copy per the table above.
  - Call `resolveLocation` instead of `geocodeUkPostcode`.
- `components/PostForm.tsx` (MODIFY — extend to composer per Paul's
  earlier mention; confirm in Q5)
  - Same field-label / placeholder / helper update.
  - Call `resolveLocation` on submit instead of postcode-only.
- `components/EditPostForm.tsx` (MODIFY — same as PostForm).
- `tests/unit/geo.test.ts` (MODIFY / EXTEND)
  - `isUkPostcodeShape` truth table (S1–S4 and friends).
  - `geocodePlace` mock-based tests (success, 404, 429, network error,
    JSON parse failure).
  - `resolveLocation` chained tests (postcode hit; postcode miss →
    place hit; both miss; empty input).
- `tests/integration/api/geocode-place.test.ts` (NEW — only if Variant B)
  - Hits the route with a stubbed `fetch` for Nominatim.
  - Asserts the User-Agent header is set.
  - Asserts the rate-limit returns 429 to the client past the budget.
- `docs/product/design-philosophy.md` glyph register
  - **No new glyphs.** Field uses no new icon. Helper line uses an
    existing affordance (the existing "Use my location" button keeps
    its current `LocateFixed` glyph).
- README updates in any directory touched.

### Do NOT touch

- `Post` schema — already has `latitude` / `longitude` columns from
  BU-calendar-near-me.
- `haversineKm` — pure function, fine as-is.
- Sort logic in `NearMeView` — once we have lat/lng, identical.
- The "Use my location" button — geolocation flow is unchanged.

### Out of scope

- **Typeahead / autocomplete** — Nominatim is not built for it; that
  needs Mapbox (B17). Single-field, single-resolve-on-submit is this
  BU.
- **Multi-result disambiguation UI** — we always take Nominatim's
  top result. If "Manchester" is ambiguous, picking is the
  geocoder's problem.
- **Caching** — could be added later as a thin LRU on the server
  proxy. Skip for MVP; trivial to add when B17 fires.
- **Non-UK members at scale** — `countrycodes=gb` everywhere. The
  global-fallback question is open (Q4 below).
- **Bulk geocoding** (batch backfill of historical postcodes) — Path
  B in the parking-lot, separate BU.

---

## Acceptance criteria

- [ ] All 20 scenarios above behave as the table specifies.
- [ ] `Bristol` (Paul's original screenshot case) resolves to Bristol
      centroid → distance-sorted feed.
- [ ] `BS1 4DJ` still resolves exactly (regression).
- [ ] Network failures fall through to the friendly error, not a
      stack trace or silent no-op.
- [ ] Server proxy (Variant B) sets `User-Agent` per Nominatim policy.
- [ ] Server proxy enforces a 1 req/s budget across the app
      (returning 429 to the client when exceeded).
- [ ] Existing testids preserved verbatim (calendar-near-locate-…,
      composer location field testids, etc.).
- [ ] `npm run typecheck && npm run lint && npm test` green.

---

## Open questions

1. **Variant A vs B (the architectural fork).** Recommend B. Confirm.
2. **Privacy disclosure** under the field — silent or one-line note?
   Recommend the one-line note.
3. **Composer scope.** Extend the same UX to `/compose`'s location
   field too, or only `/calendar?view=near`? Recommend both — the
   friction is symmetric.
4. **Global fallback for non-UK input.** If `countrycodes=gb` returns
   nothing, do we retry without the country bias (so `Paris` resolves)
   or surface the friendly error? Recommend surface the error — GPS
   Action is UK-focused; resolving Paris is a footgun for distance
   sort against UK events.
5. **Rate-limit response code from our proxy.** When our 1 req/s
   budget is exceeded, return `429` (correct semantically) or `503`
   (more generic)? Recommend 429 with a `Retry-After: 1` header.
6. **Min input length** before we bother the API. 1 char? 2? 3?
   Currently the field accepts anything. Recommend ≥ 2 chars
   (`London` is 6, `Hackney` is 7, no real-world place is 1 char).

---

## Definition of done

- [ ] Files modified per Build list; tests added per Build list.
- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] Manual smoke through all 20 scenarios on
      `/calendar?view=near` AND `/compose` (assuming Q5 = both).
- [ ] `package.json` version bumped (PATCH min).
- [ ] Brief flipped to `status: shipped`, `shipped_in: "#NNN"`.
- [ ] `npm run trackers` if status flipped.
- [ ] No `any`, no `@ts-ignore`.

---

## Context

- Predecessor brief: `bu-post-location-input.md` (#171, shipped) —
  added the postcode field on composer/edit.
- Sibling brief: `bu-calendar-near-me.md` (#169, shipped) — added the
  Near-me view + the postcode helper this BU extends.
- Engineering roadmap entry: **B17** (Geocoder upgrade — Mapbox swap
  trigger). Read it for the criteria that flip us from Nominatim to
  Mapbox once the volume bites.
- Nominatim usage policy:
  <https://operations.osmfoundation.org/policies/nominatim/>
- Mapbox Search Box (the future swap target):
  <https://docs.mapbox.com/api/search/search-box/>
- postcodes.io (the existing UK postcode resolver):
  <https://postcodes.io/>
- Current code surface: `shared/geo.ts`,
  `app/calendar/NearMeView.tsx`, `components/PostForm.tsx`,
  `components/EditPostForm.tsx`.
- Glyph register impact: **none** — no new lucide icons needed.
