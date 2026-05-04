/**
 * @build-unit bu-coordination-board (build seq #3 — routers)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0006
 *
 * BoardColumn router — list / create / rename / soft-delete / reorder
 * for the per-Group kanban columns. Mutations gate on group-admin
 * (or system-admin) via group-kanban's assertCanAdminBoard.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from '@/server/lib/trpc';
import type { BoardColumn } from '@prisma/client';
import {
  listColumnsForGroup,
  createColumn,
  renameColumn,
  softDeleteColumn,
  reorderColumns,
  getColumnGroupId,
} from '@/server/services/board-column';
import {
  assertCanViewBoard,
  assertCanAdminBoard,
  GroupAccessError,
} from '@/server/services/group-kanban';

const groupIdSchema = z.object({ groupId: z.string().min(1) });
const columnIdSchema = z.object({ columnId: z.string().min(1) });

const createSchema = groupIdSchema.extend({
  displayName: z.string().trim().min(1).max(80),
});
const renameSchema = columnIdSchema.extend({
  displayName: z.string().trim().min(1).max(80),
});
const reorderSchema = groupIdSchema.extend({
  orderedIds: z.array(z.string().min(1)).min(1).max(20),
});

function toTRPCError(err: unknown): TRPCError {
  if (err instanceof GroupAccessError) {
    return new TRPCError({
      code: err.kind === 'forbidden' ? 'FORBIDDEN' : 'NOT_FOUND',
      message: err.message,
    });
  }
  if (err instanceof Error) {
    return new TRPCError({ code: 'BAD_REQUEST', message: err.message });
  }
  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error' });
}

async function resolveGroupIdOrThrow(columnId: string): Promise<string> {
  const groupId = await getColumnGroupId(columnId);
  if (!groupId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Column ${columnId} not found` });
  }
  return groupId;
}

export const boardColumnRouter = router({
  /** List the active column set for a Group. Any group member or sysadmin. */
  listForGroup: authedProcedure
    .input(groupIdSchema)
    .query(async ({ ctx, input }): Promise<BoardColumn[]> => {
      try {
        await assertCanViewBoard({
          groupId: input.groupId,
          userId: ctx.user.id,
          isSystemAdmin: ctx.activeRoles.includes('admin'),
        });
      } catch (err) {
        throw toTRPCError(err);
      }
      return listColumnsForGroup(input.groupId);
    }),

  /** Append a new column. Group admin or system admin only. */
  create: authedProcedure.input(createSchema).mutation(async ({ ctx, input }) => {
    try {
      await assertCanAdminBoard({
        groupId: input.groupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw toTRPCError(err);
    }
    return createColumn({
      groupId: input.groupId,
      displayName: input.displayName,
      actorId: ctx.user.id,
    });
  }),

  /** Rename an existing column. Group admin or system admin only. */
  rename: authedProcedure.input(renameSchema).mutation(async ({ ctx, input }) => {
    const groupId = await resolveGroupIdOrThrow(input.columnId);
    try {
      await assertCanAdminBoard({
        groupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw toTRPCError(err);
    }
    try {
      return await renameColumn({
        columnId: input.columnId,
        displayName: input.displayName,
        actorId: ctx.user.id,
      });
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  /** Soft-delete a column (refuses if active Requests still reference it). */
  softDelete: authedProcedure.input(columnIdSchema).mutation(async ({ ctx, input }) => {
    const groupId = await resolveGroupIdOrThrow(input.columnId);
    try {
      await assertCanAdminBoard({
        groupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw toTRPCError(err);
    }
    try {
      return await softDeleteColumn({ columnId: input.columnId, actorId: ctx.user.id });
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  /** Atomic reorder. Group admin or system admin only. */
  reorder: authedProcedure.input(reorderSchema).mutation(async ({ ctx, input }) => {
    try {
      await assertCanAdminBoard({
        groupId: input.groupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw toTRPCError(err);
    }
    try {
      return await reorderColumns({
        groupId: input.groupId,
        orderedIds: input.orderedIds,
        actorId: ctx.user.id,
      });
    } catch (err) {
      throw toTRPCError(err);
    }
  }),
});
