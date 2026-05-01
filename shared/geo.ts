/**
 * @build-unit BU-calendar-near-me
 * @spec architecture/decision-log.md (D076)
 * @spec docs/adrs/0002-post-location-coords.md
 *
 * Geo helpers — Haversine distance + UK postcode lookup.
 *
 * `haversineKm` is a pure function used by both server (to filter +
 * sort the candidate list) and client (to re-sort after the user
 * supplies their own coordinates). Imported from `shared/` per the
 * project's layer rules (services / app / components all welcome).
 *
 * `geocodeUkPostcode` is a small wrapper around postcodes.io. No API
 * key required, public endpoint, deliberately tolerant of whitespace
 * and case. It runs as a `fetch` against a third-party endpoint, so
 * it's intentionally NOT exported through any server-side boundary —
 * the call originates client-side from `app/calendar/NearMeView.tsx`
 * after the user types a postcode.
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
