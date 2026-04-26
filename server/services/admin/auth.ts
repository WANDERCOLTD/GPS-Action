/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Centralised role-gate helper for the admin CRUD engine. Reads the
 * required role from `entityMetadata[entity].requiresRole` and checks
 * `ctx.activeRoles`. Mirrors `requireRole` from `server/lib/trpc.ts`
 * but takes the entity as input so the gate is metadata-driven.
 *
 * Per Q3 (locked 2026-04-26): flat role check only — no D055 scope
 * filtering. Future scope-aware filtering tracked as B13 in the
 * engineering roadmap.
 */

import { TRPCError } from '@trpc/server';
import type { TRPCContext } from '@/server/lib/trpc';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { entityMetadata } from '@/server/admin/entity-metadata';

export type AdminAction = 'view' | 'edit';

/**
 * Boolean variant — useful in pages that need to decide between
 * `notFound()` and rendering, without throwing.
 */
export function canAccessEntity(ctx: TRPCContext, entity: EntityKey, action: AdminAction): boolean {
  if (!ctx.user) return false;
  const meta = entityMetadata[entity];
  if (!meta) return false;
  const required = meta.requiresRole[action];
  return (
    ctx.activeRoles.includes(required) ||
    (required === 'queue_manager' && ctx.activeRoles.includes('admin'))
  );
}

/**
 * Admin is a superset of queue_manager per the architectural model
 * in `docs/architecture/admin-surface.md` ("admin: Everything a
 * queue manager can do, PLUS..."). The flat `requireRole` middleware
 * in `server/lib/trpc.ts` doesn't encode this hierarchy because
 * production data convention grants both roles together. The
 * generic admin surface enforces the hierarchy explicitly here so
 * an admin without an explicit queue_manager grant still passes
 * the gate on queue_manager-view entities.
 */
export function requireRoleForEntity(
  ctx: TRPCContext,
  entity: EntityKey,
  action: AdminAction,
): asserts ctx is TRPCContext & { user: NonNullable<TRPCContext['user']> } {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  const meta = entityMetadata[entity];
  if (!meta) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Entity "${entity}" is not in the metadata map`,
    });
  }
  const required = meta.requiresRole[action];
  const hasRole = ctx.activeRoles.includes(required);
  const adminCovers = required === 'queue_manager' && ctx.activeRoles.includes('admin');
  if (!hasRole && !adminCovers) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
}
