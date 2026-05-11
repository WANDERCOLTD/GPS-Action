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

import { pingDatabase, pingSupabase } from '@/server/services/health';

export async function GET(): Promise<Response> {
  // Both checks in parallel — slowest dictates total latency.
  const [databaseOk, supabase] = await Promise.all([pingDatabase(), pingSupabase()]);

  // Supabase is a NON-FATAL upstream — a missing config or unreachable
  // pipe degrades the /network surface to "Quiet in here" but does NOT
  // make the app unable to serve traffic. Reported in the payload for
  // visibility (so a curl of /readyz tells you "config-missing" vs
  // "unreachable" vs "ok"), but does not flip /readyz to 503.
  // Database remains the only fatal upstream.
  const checks: Record<string, string> = {
    database: databaseOk ? 'ok' : 'fail',
    supabase,
  };

  const fatalsOk = databaseOk;

  return Response.json(
    { status: fatalsOk ? 'ready' : 'not_ready', checks },
    { status: fatalsOk ? 200 : 503 },
  );
}
