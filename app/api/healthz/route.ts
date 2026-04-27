/**
 * @build-unit BU-healthcheck BU-versioning
 * @spec docs/build/phase-0-foundations.md
 * @spec docs/process/versioning.md
 *
 * Liveness probe — answers "is the app process alive?". If this
 * handler can respond at all, the answer is "yes". External uptime
 * monitors (Better Stack, per D037) and container orchestrators ping
 * this; non-200 responses trigger restarts.
 *
 * Pairs with /readyz (readiness probe) which goes one level deeper
 * and verifies upstream dependencies are reachable. Don't conflate —
 * different remediation paths.
 *
 * BU-versioning: response also reports `version`, `sha`, and `env` so
 * monitoring + on-call can confirm what's deployed without leaving the
 * terminal. The same env vars feed the in-app <VersionBadge />.
 */

export async function GET(): Promise<Response> {
  return Response.json({
    status: 'ok',
    uptime: process.uptime(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unversioned',
    sha: process.env.NEXT_PUBLIC_APP_SHA ?? '',
    env: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development',
  });
}
