/**
 * @build-unit BU-001-lite
 * @spec architecture/admin-surface.md
 * @spec architecture/decision-log.md (D042)
 *
 * Auth-related database queries. Resolves a user from an ID and
 * fetches active role grants. Used by the tRPC context factory
 * (server/routers/context.ts), not called directly from app/.
 */

import type { User, SystemRole } from '@prisma/client';
import { prisma } from '@/server/db/client';

/** Look up a non-deleted user by ID. Returns null if not found or soft-deleted. */
export async function resolveUser(userId: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
  });
}

/**
 * Return the set of active roles for a user.
 * Active = RoleGrant where revokedAt IS NULL.
 */
export async function getActiveRoles(userId: string): Promise<SystemRole[]> {
  const grants = await prisma.roleGrant.findMany({
    where: { userId, revokedAt: null },
    select: { role: true },
  });
  return grants.map((g) => g.role);
}
