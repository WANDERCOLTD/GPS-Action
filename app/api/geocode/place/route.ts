/**
 * @build-unit BU-postcode-or-place
 * @spec docs/build/session-briefs/bu-postcode-or-place.md
 *
 * Server proxy for free-text place geocoding via Nominatim
 * (OpenStreetMap). Exists because Nominatim's usage policy requires:
 *
 *   - A descriptive User-Agent identifying the application (browsers
 *     forbid setting `User-Agent` via fetch, so the call cannot
 *     originate client-side and stay policy-compliant).
 *   - ≤ 1 request per second across the entire app (a global budget,
 *     not per-IP — so a token bucket here, not in the browser).
 *
 * Request:  GET /api/geocode/place?q=<string>
 * Response: 200 { lat: number, lng: number }
 *           404 { error: 'no-result' }       — Nominatim returned nothing
 *           400 { error: 'invalid-query' }   — empty / too short / too long
 *           429 { error: 'rate-limited' } + Retry-After: 1
 *           502 { error: 'upstream-error' }  — Nominatim 5xx / network
 *
 * Country bias: `countrycodes=gb` always. Per the brief's locked
 * decision (Q4) — non-UK input surfaces the "couldn't find that
 * location" friendly error rather than resolving to e.g. Paris,
 * because distance sort against UK-only events would be useless.
 *
 * The 1 req/s budget is enforced in-process; on Vercel each instance
 * keeps its own bucket. That's acceptable for MVP — when production
 * traffic outgrows it, B17 in the engineering roadmap fires (swap to
 * Mapbox, which doesn't impose a global budget).
 */

import { MIN_PLACE_QUERY_LENGTH } from '@/shared/geo';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const MAX_QUERY_LENGTH = 100;
const MIN_INTERVAL_MS = 1_000; // Nominatim policy: ≤ 1 req/s
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
const USER_AGENT = `gps-action/${APP_VERSION} (paul@thewanders.com)`;

// Per-instance token bucket — last-call timestamp gates the next.
// Module-scoped so it persists across requests in the same Node
// process. On serverless runtimes with multiple warm instances this
// over-permits in aggregate; that's the trade we accept until B17.
let lastCallAt = 0;

/** Test-only — reset the rate-limit bucket so each test starts fresh. */
export function __resetRateLimitForTests(): void {
  lastCallAt = 0;
}

interface NominatimSuccessRow {
  lat: string;
  lon: string;
}

function isNominatimRow(value: unknown): value is NominatimSuccessRow {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['lat'] === 'string' && typeof v['lon'] === 'string';
}

function jsonError(status: number, error: string, headers?: HeadersInit): Response {
  return Response.json({ error }, { status, headers });
}

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (q.length < MIN_PLACE_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    return jsonError(400, 'invalid-query');
  }

  // Rate-limit gate — global, in-process. If another caller hit
  // Nominatim within MIN_INTERVAL_MS, return 429 immediately rather
  // than queueing (queueing inside a serverless handler ties up
  // function time and the user is better-served with an immediate
  // "try again in a sec" response).
  const now = Date.now();
  if (now - lastCallAt < MIN_INTERVAL_MS) {
    return jsonError(429, 'rate-limited', { 'Retry-After': '1' });
  }
  lastCallAt = now;

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    countrycodes: 'gb',
    addressdetails: '0',
  });

  let response: Response;
  try {
    response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });
  } catch {
    return jsonError(502, 'upstream-error');
  }

  if (response.status === 429) {
    // Nominatim throttling us — surface as 429 to the client too.
    return jsonError(429, 'rate-limited', { 'Retry-After': '1' });
  }
  if (!response.ok) {
    return jsonError(502, 'upstream-error');
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return jsonError(502, 'upstream-error');
  }

  if (!Array.isArray(json) || json.length === 0) {
    return jsonError(404, 'no-result');
  }

  const first = json[0];
  if (!isNominatimRow(first)) {
    return jsonError(502, 'upstream-error');
  }

  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return jsonError(502, 'upstream-error');
  }

  return Response.json({ lat, lng });
}
