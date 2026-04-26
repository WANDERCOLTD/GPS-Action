/**
 * @build-unit BU-healthcheck
 * @spec docs/build/phase-0-foundations.md
 *
 * Liveness probe — answers "is the app process alive?". If this
 * handler can respond at all, the answer is "yes". External uptime
 * monitors (Better Stack, per D037) and container orchestrators ping
 * this; non-200 responses trigger restarts.
 *
 * Pairs with /readyz (readiness probe) which goes one level deeper
 * and verifies upstream dependencies are reachable. Don't conflate —
 * different remediation paths.
 */

export async function GET(): Promise<Response> {
  return Response.json({ status: 'ok', uptime: process.uptime() });
}
