/**
 * @build-unit BU-admin-crud BU-admin-bulk-ops
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 * @spec build/session-briefs/bu-admin-bulk-ops.md
 *
 * Generic admin tRPC router. Five per-row procedures (list / get /
 * create / update / delete) dispatch to per-entity handlers in
 * `server/services/admin/registry.ts`. Auth is metadata-driven via
 * `requireRoleForEntity`; routers do no inline auth checks (F06 r4).
 *
 * Per Q3 (BU-admin-crud, locked): role check is flat — no D055
 * scope filtering. Future scope-aware filtering tracked as B13 in
 * the engineering roadmap.
 *
 * BU-admin-bulk-ops adds a `bulk` namespace with four bulk
 * procedures (softDelete, restore, hardDelete, forceRelease). Each
 * processes one row at a time so the per-row audit chain stays
 * intact and partial failures surface row-by-row.
 */

import { TRPCError } from '@trpc/server';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { router, authedProcedure } from '@/server/lib/trpc';
import {
  adminBulkForceReleaseInput,
  adminBulkHardDeleteInput,
  adminBulkRestoreInput,
  adminBulkSoftDeleteInput,
  adminCreateInput,
  adminDeleteInput,
  adminGetInput,
  adminListInput,
  adminUpdateInput,
} from '@/shared/validation/admin';
import { requireRoleForEntity } from '@/server/services/admin/auth';
import {
  createEntity,
  getEntity,
  hardDeleteEntity,
  listEntity,
  restoreEntity,
  softDeleteEntity,
  updateEntity,
} from '@/server/services/admin/crud';
import {
  bulkForceRelease,
  bulkHardDelete,
  bulkRestore,
  bulkSoftDelete,
} from '@/server/services/admin/bulk';

const bulkRouter = router({
  softDelete: authedProcedure.input(adminBulkSoftDeleteInput).mutation(async ({ ctx, input }) => {
    const entity = input.entity as EntityKey;
    requireRoleForEntity(ctx, entity, 'edit');
    return bulkSoftDelete({ entity, ids: input.ids, actorId: ctx.user.id });
  }),

  restore: authedProcedure.input(adminBulkRestoreInput).mutation(async ({ ctx, input }) => {
    const entity = input.entity as EntityKey;
    requireRoleForEntity(ctx, entity, 'edit');
    return bulkRestore({ entity, ids: input.ids, actorId: ctx.user.id });
  }),

  hardDelete: authedProcedure.input(adminBulkHardDeleteInput).mutation(async ({ ctx, input }) => {
    const entity = input.entity as EntityKey;
    requireRoleForEntity(ctx, entity, 'edit');
    return bulkHardDelete({ entity, ids: input.ids, actorId: ctx.user.id });
  }),

  forceRelease: authedProcedure
    .input(adminBulkForceReleaseInput)
    .mutation(async ({ ctx, input }) => {
      // forceRelease entity is locked to 'request' by the input schema.
      // Cast through the EntityKey union for the role check; the
      // metadata entry exists even though it's not in slice 1's
      // ADMIN_ENTITY_KEYS list.
      const entity = input.entity as EntityKey;
      requireRoleForEntity(ctx, entity, 'edit');
      return bulkForceRelease({ entity, ids: input.ids, actorId: ctx.user.id });
    }),
});

export const adminRouter = router({
  list: authedProcedure.input(adminListInput).query(async ({ ctx, input }) => {
    const entity = input.entity as EntityKey;
    requireRoleForEntity(ctx, entity, 'view');
    return listEntity(entity, { search: input.search, take: input.take });
  }),

  get: authedProcedure.input(adminGetInput).query(async ({ ctx, input }) => {
    const entity = input.entity as EntityKey;
    requireRoleForEntity(ctx, entity, 'view');
    const row = await getEntity(entity, input.id);
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
    return row;
  }),

  create: authedProcedure.input(adminCreateInput).mutation(async ({ ctx, input }) => {
    const entity = input.entity as EntityKey;
    requireRoleForEntity(ctx, entity, 'edit');
    return createEntity(entity, { data: input.data, actorId: ctx.user.id });
  }),

  update: authedProcedure.input(adminUpdateInput).mutation(async ({ ctx, input }) => {
    const entity = input.entity as EntityKey;
    requireRoleForEntity(ctx, entity, 'edit');
    return updateEntity(entity, { id: input.id, data: input.data, actorId: ctx.user.id });
  }),

  delete: authedProcedure.input(adminDeleteInput).mutation(async ({ ctx, input }) => {
    const entity = input.entity as EntityKey;
    requireRoleForEntity(ctx, entity, 'edit');
    if (input.mode === 'soft') {
      return softDeleteEntity(entity, input.id, ctx.user.id);
    }
    if (input.mode === 'restore') {
      return restoreEntity(entity, input.id, ctx.user.id);
    }
    return hardDeleteEntity(entity, input.id, ctx.user.id);
  }),

  bulk: bulkRouter,
});
