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
