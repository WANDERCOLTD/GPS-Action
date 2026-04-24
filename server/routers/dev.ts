/**
 * @build-unit BU-001-lite
 * @spec architecture/environments.md
 *
 * Dev-only router and helpers. Exposes listUsers for the dev login
 * picker and login/logout helpers for server actions.
 *
 * NEVER registered in production — see _app.ts conditional.
 */

import { z } from 'zod';
import { router, publicProcedure } from '@/server/lib/trpc';
import { getUserIdFromCookie, setDevUserCookie, clearDevUserCookie } from '@/server/lib/auth';
import { resolveUser, getActiveRoles } from '@/server/services/auth';
import { auditLog } from '@/server/services/audit';

// ── tRPC procedures ──────────────────────────────────────────────────────

export const devRouter = router({
  /** List all non-deleted users with their active roles. For the dev login picker. */
  listUsers: publicProcedure
    .output(
      z.object({
        users: z.array(
          z.object({
            id: z.string(),
            displayName: z.string(),
            email: z.string(),
            activeRoles: z.array(z.string()),
          }),
        ),
      }),
    )
    .query(async () => {
      // Import prisma here via services layer — this procedure runs only in dev.
      const { prisma } = await import('@/server/db/client');
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { displayName: 'asc' },
        select: {
          id: true,
          displayName: true,
          email: true,
          roleGrants: {
            where: { revokedAt: null },
            select: { role: true },
          },
        },
      });

      return {
        users: users.map((u) => ({
          id: u.id,
          displayName: u.displayName,
          email: u.email,
          activeRoles: u.roleGrants.map((g) => g.role),
        })),
      };
    }),
});

// ── Helpers for server actions (called from app/dev/login/actions.ts) ────

/** Set dev cookie + write audit entry. */
export async function performDevLogin(userId: string): Promise<void> {
  const user = await resolveUser(userId);
  if (!user) {
    throw new Error(`[dev-auth] User ${userId} not found.`);
  }

  await setDevUserCookie(userId);
  await auditLog({
    action: 'user_logged_in',
    entityType: 'User',
    entityId: userId,
    userId,
  });
}

/** Clear dev cookie + write audit entry. */
export async function performDevLogout(): Promise<void> {
  const userId = await getUserIdFromCookie();
  await clearDevUserCookie();
  if (userId) {
    await auditLog({
      action: 'user_logged_out',
      entityType: 'User',
      entityId: userId,
      userId,
    });
  }
}

/** Get current user with roles (for LoggedInAs and similar). */
export async function getCurrentDevUser(): Promise<{
  id: string;
  displayName: string;
  activeRoles: string[];
} | null> {
  const userId = await getUserIdFromCookie();
  if (!userId) return null;
  const user = await resolveUser(userId);
  if (!user) return null;
  const activeRoles = await getActiveRoles(user.id);
  return {
    id: user.id,
    displayName: user.displayName,
    activeRoles,
  };
}
