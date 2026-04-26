/**
 * @build-unit BU-healthcheck
 * @spec docs/build/phase-0-foundations.md
 * @spec architecture/decision-log.md (D037)
 *
 * Readiness probe — answers "can the app serve traffic?". Pings every
 * upstream dependency and reports a structured payload. Returns 200
 * when all checks pass, 503 when any fail.
 *
 * Today: only the database is checked. Future dependencies (Redis,
 * the AI endpoint) become additional keys in `checks`; the shape is
 * `Record<string, 'ok' | 'fail'>` so consumers can extend without
 * breaking.
 *
 * External monitors (Better Stack, per D037) page on 503. Container
 * orchestrators take the instance out of the load-balancer pool but
 * do NOT restart it — that's /healthz's job.
 */

import { pingDatabase } from '@/server/services/health';

export async function GET(): Promise<Response> {
  const databaseOk = await pingDatabase();

  const checks: Record<string, 'ok' | 'fail'> = {
    database: databaseOk ? 'ok' : 'fail',
  };

  const allOk = Object.values(checks).every((v) => v === 'ok');

  return Response.json(
    { status: allOk ? 'ready' : 'not_ready', checks },
    { status: allOk ? 200 : 503 },
  );
}
