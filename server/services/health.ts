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
