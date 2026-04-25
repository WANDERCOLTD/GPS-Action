/**
 * @build-unit BU-reactions
 * @spec architecture/decision-log.md (D036)
 * @spec architecture/decision-log.md (D050)
 *
 * Minimal feature-flag helper. Reads FeatureFlag.enabledGlobally
 * from the database. Per D036, every substantial feature ships
 * behind a flag; this is the helper they call.
 *
 * MVP scope: globally on/off only. Per-user, per-region,
 * per-group, and rollout-percentage evaluation are deferred to a
 * follow-up build (D050 explicitly carves this scope).
 *
 * Fail-closed: if the flag row doesn't exist, the feature is
 * treated as disabled. Don't ship code that depends on a flag
 * row that hasn't been seeded.
 *
 * Lives in /server/services per the boundaries plugin (services
 * can import db; lib cannot).
 */

import { prisma } from '@/server/db/client';

/**
 * Returns true if the named feature flag is enabled globally.
 * Returns false if the flag doesn't exist or is disabled.
 */
export async function isFeatureEnabled(name: string): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { name },
    select: { enabledGlobally: true },
  });
  return flag?.enabledGlobally ?? false;
}
