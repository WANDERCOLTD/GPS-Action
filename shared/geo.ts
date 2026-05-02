/**
 * @build-unit BU-calendar-near-me BU-postcode-or-place
 * @spec architecture/decision-log.md (D076)
 * @spec docs/adrs/0002-post-location-coords.md
 * @spec docs/build/session-briefs/bu-postcode-or-place.md
 *
 * Geo helpers — Haversine distance + UK postcode + free-text place lookup.
 *
 * `haversineKm` is a pure function used by both server (to filter +
 * sort the candidate list) and client (to re-sort after the user
 * supplies their own coordinates). Imported from `shared/` per the
 * project's layer rules (services / app / components all welcome).
 *
 * `geocodeUkPostcode` is a small wrapper around postcodes.io. No API
 * key required, public endpoint, deliberately tolerant of whitespace
 * and case. Client-direct — postcodes.io rate-limits per source IP,
 * so each browser stays in its own bucket.
 *
 * `geocodePlace` resolves a free-text place name (town / city / area)
 * via our own `/api/geocode/place` server route, which proxies to
 * Nominatim (OpenStreetMap) with the User-Agent + ≤ 1 req/s budget
 * the policy demands. Browser never talks to Nominatim directly —
 * see the brief's "Architectural decision" section for why.
 *
 * `resolveLocation` is the user-facing helper: detect postcode shape,
 * try postcodes.io first, fall through to `geocodePlace` for free
 * text. Any helper consuming the field on /calendar?view=near, the
 * composer, or the post-edit form should call this — not the
 * lower-level functions.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6_371;

/**
 * Great-circle distance between two lat/lng coordinates, in kilometers.
 * Uses the Haversine formula. Sufficient for the demo's "sort events
 * by distance" surface (sub-meter precision is irrelevant when most
 * results are kilometres apart).
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

interface PostcodesIoSuccess {
  status: 200;
  result: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Resolve a UK postcode to lat/lng via postcodes.io. Returns `null`
 * for any non-OK response (404, 5xx, network error). Tolerant of
 * surrounding whitespace and lowercase input — postcodes.io expects
 * uppercase, no spaces.
 *
 * Client-side only — do NOT call from a server route. The endpoint is
 * unauthenticated and rate-limited per source IP; running it from the
 * server would funnel every member through one shared rate bucket.
 */
export async function geocodeUkPostcode(postcode: string): Promise<LatLng | null> {
  const cleaned = postcode.trim().replace(/\s+/g, '').toUpperCase();
  if (cleaned === '') return null;
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return null;
  }
  if (!isPostcodesIoSuccess(json)) return null;
  return { lat: json.result.latitude, lng: json.result.longitude };
}

function isPostcodesIoSuccess(value: unknown): value is PostcodesIoSuccess {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v['status'] !== 200) return false;
  const result = v['result'];
  if (typeof result !== 'object' || result === null) return false;
  const r = result as Record<string, unknown>;
  return typeof r['latitude'] === 'number' && typeof r['longitude'] === 'number';
}

// Strict: matches a *full* UK postcode (outward + inward), case-
// insensitive, optional space between halves. Outward-only inputs
// (`BS1`) deliberately don't match — they fall through to
// `geocodePlace` so we resolve them to a place centroid rather than
// hitting postcodes.io for a guaranteed 404.
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/i;

/** True if the input has the *shape* of a full UK postcode (does not
 *  prove the postcode exists — postcodes.io is the source of truth). */
export function isUkPostcodeShape(input: string): boolean {
  const cleaned = input.trim().replace(/\s+/g, '');
  if (cleaned === '') return false;
  return UK_POSTCODE_REGEX.test(cleaned);
}

/** Minimum characters before we hit any geocoder. Short inputs are
 *  almost always typos / partials and burn the rate-limit budget for
 *  no useful result. Decision locked at > 2 characters in the brief. */
export const MIN_PLACE_QUERY_LENGTH = 3;

interface PlaceProxySuccess {
  lat: number;
  lng: number;
}

/**
 * Resolve a free-text place name (town / city / area) via our own
 * server proxy at `/api/geocode/place`. The proxy talks to Nominatim
 * with the required User-Agent + global ≤ 1 req/s budget. Returns
 * `null` for any non-OK response (no result, rate-limited, network
 * error, junk JSON).
 *
 * Trims surrounding whitespace; rejects inputs shorter than
 * `MIN_PLACE_QUERY_LENGTH` without making a network call.
 */
export async function geocodePlace(query: string): Promise<LatLng | null> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_PLACE_QUERY_LENGTH) return null;
  const url = `/api/geocode/place?q=${encodeURIComponent(trimmed)}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return null;
  }
  if (!isPlaceProxySuccess(json)) return null;
  return { lat: json.lat, lng: json.lng };
}

function isPlaceProxySuccess(value: unknown): value is PlaceProxySuccess {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['lat'] === 'number' && typeof v['lng'] === 'number';
}

/**
 * Resolve any user-typed location string (UK postcode OR town / city /
 * area) to lat/lng. Chained:
 *
 *   1. If the input looks like a full UK postcode → postcodes.io.
 *   2. Otherwise (or on postcodes.io miss) → `geocodePlace` (Nominatim
 *      via our server proxy, UK-biased).
 *   3. Both miss → returns `null`. Caller surfaces a friendly error.
 *
 * Always returns the same `LatLng | null` shape regardless of which
 * resolver answered.
 */
export async function resolveLocation(query: string): Promise<LatLng | null> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_PLACE_QUERY_LENGTH) return null;
  if (isUkPostcodeShape(trimmed)) {
    const postcodeResult = await geocodeUkPostcode(trimmed);
    if (postcodeResult) return postcodeResult;
    // Postcode-shaped but postcodes.io said no — fall through. Rare
    // (a syntactically-valid but unallocated postcode) but covered
    // for completeness.
  }
  return geocodePlace(trimmed);
}
