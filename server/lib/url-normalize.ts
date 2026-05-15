/**
 * @build-unit BU-link-preview-store
 * @spec adrs/0019-link-preview-store.md
 *
 * Pure URL canonicalisation for the spread-gallery dedup key.
 *
 * Two distinct keys exist on `LinkPreview`:
 *  - `url`           — exact string the caller passed (cache lookup)
 *  - `normalizedUrl` — output of this function (cross-URL dedup)
 *
 * Two messages sharing the same article via `?utm=a` and `?utm=b`
 * yield two `LinkPreview` rows but collide on `normalizedUrl`, so
 * the gallery's groupBy aggregates them as one "thing spreading."
 *
 * Rules (ADR-0019 §2):
 *   1. Lowercase host
 *   2. Drop `www.` prefix
 *   3. Strip URL fragment (`#…`)
 *   4. Strip tracking params: utm_*, fbclid, gclid, mc_cid, mc_eid,
 *      ref, igshid, si
 *   5. Strip trailing slash on path (preserve root `/`)
 *   6. Alphabetise remaining query params
 *   7. Normalise scheme `http://` → `https://`
 *
 * Invalid inputs (non-URL, unsupported scheme) return the raw string
 * lower-cased. Callers should not pass user-typed garbage here; the
 * upstream `fetchLinkMetadata` validation runs first, so by the time
 * a URL reaches this function it's already passed `new URL()` parse.
 */

const TRACKING_PARAM_PREFIXES = ['utm_'] as const;
const TRACKING_PARAM_NAMES = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'igshid',
  'si',
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  for (const prefix of TRACKING_PARAM_PREFIXES) {
    if (lower.startsWith(prefix)) return true;
  }
  return TRACKING_PARAM_NAMES.has(lower);
}

export function normalizeUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return input.trim().toLowerCase();
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return input.trim().toLowerCase();
  }

  // Scheme: always https for storage. The fetcher follows the
  // redirect anyway; we treat http and https variants as the same
  // "thing spreading."
  parsed.protocol = 'https:';

  // Host: lowercase, strip www.
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  parsed.hostname = host;

  // Fragment: drop entirely.
  parsed.hash = '';

  // Query params: strip tracking, sort the rest alphabetically.
  const kept: Array<[string, string]> = [];
  parsed.searchParams.forEach((value, key) => {
    if (!isTrackingParam(key)) kept.push([key, value]);
  });
  kept.sort(([a], [b]) => a.localeCompare(b));
  const newSearch = new URLSearchParams();
  for (const [k, v] of kept) newSearch.append(k, v);
  parsed.search = newSearch.toString();

  // Path: strip trailing slash except for the root.
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}
