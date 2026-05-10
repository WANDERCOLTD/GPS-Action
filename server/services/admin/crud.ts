/**
 * @build-unit BU-admin-crud BU-admin-audit-integration
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 * @spec build/session-briefs/bu-admin-audit-integration.md
 *
 * Thin facade over the registry. The router calls these; the service
 * dispatches to the registered entry. Keeps router code free of
 * per-entity branching.
 *
 * BU-admin-audit-integration: every mutation now writes one
 * `AuditLog` row via `writeAdminAudit()`. Audit happens AFTER the
 * mutation succeeds; the helper itself never throws (per
 * `server/services/audit.ts`).
 */

import { TRPCError } from '@trpc/server';
import { prisma } from '@/server/db/client';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { entityMetadata } from '@/server/admin/entity-metadata';
import { ensureSupports, getRegistryEntry } from '@/server/services/admin/registry';
import { writeAdminAudit } from '@/server/services/admin/audit';
import type {
  AdminListArgs,
  AdminListResult,
  AdminMutationArgs,
  AdminRow,
  AdminUpdateArgs,
} from '@/server/services/admin/types';

function assertNotQueueWorkflow(entity: EntityKey): void {
  const meta = entityMetadata[entity];
  if (meta?.workflow === 'queue') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Entity "${entity}" has workflow=queue and is not surfaced through /data — use /requests`,
    });
  }
}

export async function listEntity(entity: EntityKey, args: AdminListArgs): Promise<AdminListResult> {
  assertNotQueueWorkflow(entity);
  return getRegistryEntry(entity).list(args);
}

export async function getEntity(entity: EntityKey, id: string): Promise<AdminRow | null> {
  assertNotQueueWorkflow(entity);
  return getRegistryEntry(entity).get({ id });
}

/**
 * Returns the full Prisma row for an entity (every column, plus
 * single-level relation includes from `listColumns`). Used by the
 * detail / edit pages so all fields are available — not just the
 * curated `listColumns`. Also used internally by audit-integration
 * to capture `before` / `after` snapshots.
 */
export async function getEntityRaw(
  entity: EntityKey,
  id: string,
): Promise<Record<string, unknown> | null> {
  assertNotQueueWorkflow(entity);
  // Switch on the literal entity key so each `findUnique` call binds
  // to the typed Prisma delegate. Adding a new entity means adding
  // a case here AND a registry entry.
  switch (entity) {
    case 'user':
      return (await prisma.user.findUnique({ where: { id } })) as Record<string, unknown> | null;
    case 'post':
      return (await prisma.post.findUnique({ where: { id } })) as Record<string, unknown> | null;
    case 'region':
      return (await prisma.region.findUnique({
        where: { id },
        include: { parent: { select: { id: true, displayName: true, slug: true } } },
      })) as Record<string, unknown> | null;
    case 'group':
      return (await prisma.group.findUnique({
        where: { id },
        include: { createdBy: { select: { id: true, displayName: true } } },
      })) as Record<string, unknown> | null;
    case 'groupMembership':
      return (await prisma.groupMembership.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, displayName: true } },
          group: { select: { id: true, displayName: true, slug: true } },
          approvedBy: { select: { id: true, displayName: true } },
        },
      })) as Record<string, unknown> | null;
    case 'roleGrant':
      return (await prisma.roleGrant.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, displayName: true } },
          grantedBy: { select: { id: true, displayName: true } },
          revokedBy: { select: { id: true, displayName: true } },
        },
      })) as Record<string, unknown> | null;
    case 'featureFlag':
      return (await prisma.featureFlag.findUnique({
        where: { id },
        include: {
          owner: { select: { id: true, displayName: true } },
          createdBy: { select: { id: true, displayName: true } },
          updatedBy: { select: { id: true, displayName: true } },
        },
      })) as Record<string, unknown> | null;
    case 'auditLog':
      return (await prisma.auditLog.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, displayName: true } },
          targetUser: { select: { id: true, displayName: true } },
        },
      })) as Record<string, unknown> | null;
    case 'kanbanEventConfig':
      return (await prisma.kanbanEventConfig.findUnique({
        where: { id },
        include: {
          updatedBy: { select: { id: true, displayName: true } },
        },
      })) as Record<string, unknown> | null;
    default:
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Entity "${entity}" is not registered for raw read`,
      });
  }
}

export async function createEntity(
  entity: EntityKey,
  args: AdminMutationArgs & { actorId: string },
): Promise<{ id: string }> {
  assertNotQueueWorkflow(entity);
  const entry = ensureSupports(entity, 'create');
  const result = await entry.create(args);
  // Re-fetch the new row for `changes.after` (Q3 locked: re-fetch,
  // don't extend the registry signature).
  const after = await getEntityRaw(entity, result.id);
  if (after) {
    await writeAdminAudit({
      verb: 'create',
      entity,
      entityId: result.id,
      actorId: args.actorId,
      after,
    });
  }
  return result;
}

export async function updateEntity(
  entity: EntityKey,
  args: AdminUpdateArgs & { actorId: string },
): Promise<{ id: string }> {
  assertNotQueueWorkflow(entity);
  const entry = ensureSupports(entity, 'update');
  const before = await getEntityRaw(entity, args.id);
  if (!before) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  const result = await entry.update(args);
  const after = await getEntityRaw(entity, args.id);
  if (after) {
    await writeAdminAudit({
      verb: 'update',
      entity,
      entityId: args.id,
      actorId: args.actorId,
      before,
      after,
    });
  }
  return result;
}

export async function softDeleteEntity(
  entity: EntityKey,
  id: string,
  actorId: string,
): Promise<{ id: string }> {
  assertNotQueueWorkflow(entity);
  const meta = entityMetadata[entity];
  if (!meta?.softDelete) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Entity "${entity}" does not support soft-delete`,
    });
  }
  const entry = ensureSupports(entity, 'softDelete');
  // Pre-load the row before the mutation — its state changes after.
  const before = await getEntityRaw(entity, id);
  if (!before) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  const result = await entry.softDelete({ id, actorId });
  await writeAdminAudit({
    verb: 'soft-delete',
    entity,
    entityId: id,
    actorId,
    before,
  });
  return result;
}

export async function restoreEntity(
  entity: EntityKey,
  id: string,
  actorId: string,
): Promise<{ id: string }> {
  assertNotQueueWorkflow(entity);
  const meta = entityMetadata[entity];
  if (!meta?.softDelete) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Entity "${entity}" does not support restore`,
    });
  }
  const entry = ensureSupports(entity, 'restore');
  const before = await getEntityRaw(entity, id);
  if (!before) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  const result = await entry.restore({ id, actorId });
  await writeAdminAudit({
    verb: 'restore',
    entity,
    entityId: id,
    actorId,
    before,
  });
  return result;
}

export async function hardDeleteEntity(
  entity: EntityKey,
  id: string,
  actorId: string,
): Promise<{ id: string }> {
  assertNotQueueWorkflow(entity);
  const meta = entityMetadata[entity];
  if (meta?.softDelete) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Entity "${entity}" uses soft-delete; use mode="soft" instead`,
    });
  }
  const entry = ensureSupports(entity, 'hardDelete');
  // Pre-load the row — after hard-delete it's gone forever.
  const before = await getEntityRaw(entity, id);
  if (!before) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  const result = await entry.hardDelete({ id, actorId });
  await writeAdminAudit({
    verb: 'hard-delete',
    entity,
    entityId: id,
    actorId,
    before,
  });
  return result;
}
