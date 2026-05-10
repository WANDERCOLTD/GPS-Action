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
 * curated relation includes for label-friendly audit snapshots).
 * Used internally by audit-integration to capture `before` / `after`
 * snapshots. Per-entity Prisma calls live on the registry entry's
 * `getRaw`, so adding an entity is a single registration — the
 * registry entry's required `getRaw` field forces the new entity
 * to declare its raw shape at type-check time.
 */
export async function getEntityRaw(
  entity: EntityKey,
  id: string,
): Promise<Record<string, unknown> | null> {
  assertNotQueueWorkflow(entity);
  return getRegistryEntry(entity).getRaw({ id });
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
