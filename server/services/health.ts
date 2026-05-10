/**
 * @build-unit BU-healthcheck
 * @spec docs/build/phase-0-foundations.md
 * @spec architecture/decision-log.md (D037)
 *
 * Health-check service. Pings upstream dependencies for the readiness
 * probe at /readyz. Today: the Postgres database via Prisma's
 * `$queryRaw \`SELECT 1\``. Future dependencies (Redis, AI endpoint)
 * land as additional named exports here.
 *
 * The service swallows the underlying error and returns a boolean —
 * the caller (the route handler) needs a boolean to assemble the
 * structured `checks` payload, and re-throwing would force a redundant
 * try/catch up the chain. When @sentry/nextjs lands per D037, swap the
 * silent catch for Sentry.captureException. Same seam pattern as F11's
 * ErrorBoundary.reportError.
 *
 * Lives in /server/services per the boundaries plugin (services may
 * import db; lib and app may not).
 */

import { prisma } from '@/server/db/client';

/**
 * Verifies the database is reachable by issuing `SELECT 1`.
 * Resolves `true` on success, `false` on any thrown error.
 */
export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    // TODO(D037): Sentry.captureException once @sentry/nextjs lands.
    return false;
  }
}

/**
 * Three discrete states for the Supabase upstream:
 *   - 'ok'             — REST returned 2xx
 *   - 'config-missing' — SUPABASE_URL / SUPABASE_ANON_KEY env unset
 *   - 'unreachable'    — REST returned non-2xx, network error, timeout
 *
 * The split matters operationally: 'config-missing' is "fix env vars
 * in Vercel"; 'unreachable' is "Grant's pipe is down or the anon key
 * is wrong". The Network feed silently degrades to an empty list on
 * both — the distinction lives here so the readiness probe can name
 * which one is happening without a code dive.
 */
export type SupabasePingState = 'ok' | 'config-missing' | 'unreachable';

/**
 * Probes the Supabase view with the cheapest possible query
 * (`limit=1`, single column). Bounded by an explicit 3s timeout so
 * a slow upstream can't drag /readyz into 503 territory the loadbal
 * uses to drain instances.
 */
export async function pingSupabase(): Promise<SupabasePingState> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return 'config-missing';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${url}/rest/v1/gps_group_messages?select=id&limit=1`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    return res.ok ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timeout);
  }
}
