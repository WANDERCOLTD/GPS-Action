/**
 * @build-unit BU-001-lite
 * @spec architecture/admin-surface.md
 * @spec architecture/environments.md
 *
 * tRPC context factory. Resolves the current user from the dev auth
 * cookie and pre-fetches active roles. Called from server components
 * and future API route handlers.
 *
 * Lives in server/routers/ so it can import from both lib and services
 * without violating ESLint boundary rules.
 */

import type { TRPCContext } from '@/server/lib/trpc';
import { getUserIdFromCookie } from '@/server/lib/auth';
import { resolveUser, getActiveRoles, getActiveScopes } from '@/server/services/auth';

/**
 * Build the tRPC context for the current request. Reads the dev auth
 * cookie, resolves the user, and fetches their active roles + scopes.
 */
export async function createTRPCContext(): Promise<TRPCContext> {
  if (process.env.NODE_ENV === 'production') {
    // In production, real auth (BU-002) replaces this.
    return { user: null, activeRoles: [], activeScopes: [] };
  }

  const userId = await getUserIdFromCookie();
  if (!userId) {
    return { user: null, activeRoles: [], activeScopes: [] };
  }

  const user = await resolveUser(userId);
  if (!user) {
    return { user: null, activeRoles: [], activeScopes: [] };
  }

  const [activeRoles, activeScopes] = await Promise.all([
    getActiveRoles(user.id),
    getActiveScopes(user.id),
  ]);
  return { user, activeRoles, activeScopes };
}
