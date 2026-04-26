/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Generic admin tRPC router. Five procedures (list / get / create /
 * update / delete) dispatch to per-entity handlers in
 * `server/services/admin/registry.ts`. Auth is metadata-driven via
 * `requireRoleForEntity`; routers do no inline auth checks (F06 r4).
 *
 * Per Q3 (locked): role check is flat — no D055 scope filtering.
 * Future scope-aware filtering tracked as B13 in the engineering
 * roadmap.
 */

import { TRPCError } from '@trpc/server';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { router, authedProcedure } from '@/server/lib/trpc';
import {
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
});
