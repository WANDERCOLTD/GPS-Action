/**
 * @build-unit BU-demo-mode
 * @spec architecture/environments.md
 *
 * Demo-mode flag. Enables dev-auth surfaces (/dev/login, dev tRPC router,
 * <LoggedInAs />) on a real Vercel deployment so demo viewers can switch
 * between seeded users without a real auth backend.
 *
 * Lives in /shared so /app and /components can import it (boundary
 * plugin disallows /server/lib from those layers). The env var has no
 * NEXT_PUBLIC_ prefix, so on the client `process.env.DEMO_MODE` is
 * undefined and `isDemoMode()` returns false. All gate consumers run in
 * server-rendered code, where the lookup works.
 *
 * Safety rail: throws at module load if DEMO_MODE=1 is set on a real
 * production Vercel project (VERCEL_ENV=production). Demo deployments
 * must use a Vercel project distinct from any future real-prod project.
 */

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function readFlag(name: string): string | undefined {
  const raw = process.env[name];
  return raw === undefined ? undefined : raw.trim().toLowerCase();
}

function demoModeEnabled(): boolean {
  const value = readFlag('DEMO_MODE');
  return value !== undefined && TRUE_VALUES.has(value);
}

function isRealProductionVercel(): boolean {
  return readFlag('VERCEL_ENV') === 'production';
}

if (demoModeEnabled() && isRealProductionVercel()) {
  throw new Error(
    '[demo-mode] DEMO_MODE=1 is set on a Vercel project where VERCEL_ENV=production. ' +
      'Demo deployments must run on a separate Vercel project (preview env or a project ' +
      'whose VERCEL_ENV is not "production"). Refusing to start.',
  );
}

/**
 * Returns true when the deployment should expose dev-auth surfaces despite
 * running with NODE_ENV=production. Use alongside the existing NODE_ENV gate:
 *
 *   if (process.env.NODE_ENV !== 'production' || isDemoMode()) { ... }
 */
export function isDemoMode(): boolean {
  return demoModeEnabled();
}
