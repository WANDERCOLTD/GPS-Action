/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Thin facade over the registry. The router calls these; the service
 * dispatches to the registered entry. Keeps router code free of
 * per-entity branching.
 */

import { TRPCError } from '@trpc/server';
import { prisma } from '@/server/db/client';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { entityMetadata } from '@/server/admin/entity-metadata';
import { ensureSupports, getRegistryEntry } from '@/server/services/admin/registry';
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
 * curated `listColumns`.
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
  return entry.create(args);
}

export async function updateEntity(
  entity: EntityKey,
  args: AdminUpdateArgs & { actorId: string },
): Promise<{ id: string }> {
  assertNotQueueWorkflow(entity);
  const entry = ensureSupports(entity, 'update');
  return entry.update(args);
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
  return entry.softDelete({ id, actorId });
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
  return entry.restore({ id, actorId });
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
  return entry.hardDelete({ id, actorId });
}
