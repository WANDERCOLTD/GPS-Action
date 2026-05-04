/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4b)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0006 0009 0011 0012
 *
 * Board router — drag-reorder + explicit status change.
 *
 * Wraps server/services/board.ts. Two mutations:
 *   - moveCard: drag-and-drop primitive. Routes to originating or
 *     shared based on the link the service finds.
 *   - setStatus: explicit status change for off-drag gestures
 *     (e.g. "Mark abandoned").
 *
 * Permission shape (per Surface 1's permission table):
 *   1. Caller must be a viewer of `groupId` (member, group admin, or
 *      system admin) — assertCanViewBoard from group-kanban.
 *   2. Caller must be either a group admin (or system admin) OR an
 *      active assignee on the Request. Plain members without an
 *      assignment cannot move someone else's card. The brief's
 *      "members move own assignment, admins move any" rule.
 *
 * Errors: BoardError → TRPCError (NOT_FOUND / FORBIDDEN / BAD_REQUEST).
 * GroupAccessError → TRPCError (NOT_FOUND / FORBIDDEN).
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from '@/server/lib/trpc';
import {
  moveCard,
  setRequestStatus,
  BoardError,
  type MoveCardResult,
} from '@/server/services/board';
import { isAssigneeActive } from '@/server/services/assignments';
import {
  assertCanViewBoard,
  GroupAccessError,
  type GroupAccess,
} from '@/server/services/group-kanban';

const destinationSchema = z.union([
  z.object({ lane: z.literal('active'), columnId: z.string().min(1) }),
  z.object({ lane: z.enum(['backlog', 'done', 'abandoned']) }),
]);

const moveCardSchema = z.object({
  requestId: z.string().min(1),
  groupId: z.string().min(1),
  destination: destinationSchema,
  beforeRequestId: z.string().min(1).nullish(),
  afterRequestId: z.string().min(1).nullish(),
});

const setStatusSchema = z.object({
  requestId: z.string().min(1),
  /** Caller's current group context — drives the permission gate. */
  groupId: z.string().min(1),
  status: z.enum(['backlog', 'active', 'done', 'abandoned']),
});

function toTRPCError(err: unknown): TRPCError {
  if (err instanceof GroupAccessError) {
    return new TRPCError({
      code: err.kind === 'forbidden' ? 'FORBIDDEN' : 'NOT_FOUND',
      message: err.message,
    });
  }
  if (err instanceof BoardError) {
    const code =
      err.kind === 'request_not_found' || err.kind === 'group_link_not_found'
        ? 'NOT_FOUND'
        : err.kind === 'shared_off_board_forbidden'
          ? 'FORBIDDEN'
          : 'BAD_REQUEST';
    return new TRPCError({ code, message: err.message });
  }
  if (err instanceof Error) {
    return new TRPCError({ code: 'BAD_REQUEST', message: err.message });
  }
  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error' });
}

/**
 * Two-stage gate: viewer access first, then "admin or active assignee".
 * Returns the resolved GroupAccess so the caller can reuse it.
 */
async function gateMoveOrStatus(opts: {
  groupId: string;
  requestId: string;
  userId: string;
  isSystemAdmin: boolean;
}): Promise<GroupAccess> {
  let access: GroupAccess;
  try {
    access = await assertCanViewBoard({
      groupId: opts.groupId,
      userId: opts.userId,
      isSystemAdmin: opts.isSystemAdmin,
    });
  } catch (err) {
    throw toTRPCError(err);
  }
  if (!access.canAdminBoard) {
    const assigned = await isAssigneeActive(opts.requestId, opts.userId);
    if (!assigned) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only group admins or active assignees can change this card',
      });
    }
  }
  return access;
}

export const boardRouter = router({
  /**
   * Drag-and-drop a card. Service dispatches by origin: originating-
   * group writes Request + mirrors RequestGroup; shared-group writes
   * the RequestGroup row only.
   */
  moveCard: authedProcedure
    .input(moveCardSchema)
    .mutation(async ({ ctx, input }): Promise<MoveCardResult> => {
      await gateMoveOrStatus({
        groupId: input.groupId,
        requestId: input.requestId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
      try {
        return await moveCard({
          requestId: input.requestId,
          groupId: input.groupId,
          destination: input.destination,
          beforeRequestId: input.beforeRequestId ?? null,
          afterRequestId: input.afterRequestId ?? null,
          actorId: ctx.user.id,
        });
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Explicit status change. For off-drag gestures (e.g. "Mark abandoned").
   * Same permission shape as moveCard.
   */
  setStatus: authedProcedure.input(setStatusSchema).mutation(async ({ ctx, input }) => {
    await gateMoveOrStatus({
      groupId: input.groupId,
      requestId: input.requestId,
      userId: ctx.user.id,
      isSystemAdmin: ctx.activeRoles.includes('admin'),
    });
    try {
      return await setRequestStatus({
        requestId: input.requestId,
        status: input.status,
        actorId: ctx.user.id,
      });
    } catch (err) {
      throw toTRPCError(err);
    }
  }),
});
