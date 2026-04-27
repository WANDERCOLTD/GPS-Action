/**
 * @build-unit BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec architecture/decision-log.md (D065)
 *
 * Canonical site origin for outbound deep-links (e.g. the post URL
 * embedded in a WhatsApp share). Resolution order:
 *
 *   1. `NEXT_PUBLIC_SITE_ORIGIN` env var if set
 *   2. `window.location.origin` if running in the browser
 *   3. `http://localhost:3001` as a last-resort dev fallback
 *
 * Pure function. No throwing — outbound shares should never fail
 * because of an environment lookup.
 */

const DEV_FALLBACK = 'http://localhost:3001';

export function getSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  if (fromEnv && fromEnv.length > 0) {
    return stripTrailingSlash(fromEnv);
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return DEV_FALLBACK;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
