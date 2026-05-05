/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4b; #5a + #5c — Surface 2 read + edit)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0006 0009 0011 0012 0013
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
  listBoardCardsForGroup,
  getTicketDetail,
  editTicketTitle,
  editTicketBody,
  proposeKanbanTicket,
  BoardError,
  EditTicketError,
  ProposeKanbanTicketError,
  TICKET_TITLE_MAX_LENGTH,
  TICKET_BODY_MAX_LENGTH,
  type BoardCard,
  type MoveCardResult,
  type TicketDetail,
} from '@/server/services/board';
import { boardProposeSchema } from '@/shared/validation/board';
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
  if (err instanceof EditTicketError) {
    const code =
      err.kind === 'request_not_found' || err.kind === 'group_link_not_found'
        ? 'NOT_FOUND'
        : 'BAD_REQUEST';
    return new TRPCError({ code, message: err.message });
  }
  if (err instanceof ProposeKanbanTicketError) {
    return new TRPCError({ code: 'BAD_REQUEST', message: err.message });
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

const listCardsSchema = z.object({
  groupId: z.string().min(1),
  /** Off-board lanes use 'backlog' | 'done' | 'abandoned'. Default = 'active'. */
  status: z.enum(['backlog', 'active', 'done', 'abandoned']).optional(),
});

const getTicketSchema = z.object({
  requestId: z.string().min(1),
  /**
   * The group whose board the viewer is acting on. Drives both the
   * permission gate (assertCanViewBoard) and the cross-group disclosure
   * scope (the ticket must be linked to this group).
   */
  groupId: z.string().min(1),
});

const editTitleSchema = z.object({
  requestId: z.string().min(1),
  groupId: z.string().min(1),
  title: z.string().min(1).max(TICKET_TITLE_MAX_LENGTH),
});

const editBodySchema = z.object({
  requestId: z.string().min(1),
  groupId: z.string().min(1),
  /** null clears the description; non-null is trimmed server-side. */
  body: z.string().max(TICKET_BODY_MAX_LENGTH).nullable(),
});

export const boardRouter = router({
  /**
   * Read the active cards for a group's kanban board. Joins via
   * RequestGroup so per-link column placement drives the view.
   */
  listCards: authedProcedure
    .input(listCardsSchema)
    .query(async ({ ctx, input }): Promise<BoardCard[]> => {
      try {
        await assertCanViewBoard({
          groupId: input.groupId,
          userId: ctx.user.id,
          isSystemAdmin: ctx.activeRoles.includes('admin'),
        });
      } catch (err) {
        throw toTRPCError(err);
      }
      return listBoardCardsForGroup(input.groupId, { status: input.status });
    }),

  /**
   * Read full detail for a ticket, scoped to the viewer's group context.
   * The viewer must be able to see `groupId`, AND the ticket must be
   * linked to that group — otherwise NOT_FOUND. We collapse missing-link
   * and missing-request to the same code so the router does not leak
   * cross-group ticket existence.
   */
  getTicket: authedProcedure
    .input(getTicketSchema)
    .query(async ({ ctx, input }): Promise<TicketDetail> => {
      try {
        await assertCanViewBoard({
          groupId: input.groupId,
          userId: ctx.user.id,
          isSystemAdmin: ctx.activeRoles.includes('admin'),
        });
      } catch (err) {
        throw toTRPCError(err);
      }
      const ticket = await getTicketDetail({
        requestId: input.requestId,
        viewerGroupId: input.groupId,
      });
      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Ticket ${input.requestId} not found in group ${input.groupId}`,
        });
      }
      return ticket;
    }),

  /**
   * Edit the typed `Request.title`. Any group member of a group linked
   * to the ticket may edit; brief Tier-1 ("any group member, audit-
   * logged"). Audit row written by the service.
   */
  editTitle: authedProcedure.input(editTitleSchema).mutation(async ({ ctx, input }) => {
    try {
      await assertCanViewBoard({
        groupId: input.groupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw toTRPCError(err);
    }
    try {
      const updated = await editTicketTitle({
        requestId: input.requestId,
        viewerGroupId: input.groupId,
        actorId: ctx.user.id,
        title: input.title,
      });
      return { ok: true as const, title: updated.title };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  /**
   * Edit the typed `Request.body`. Same permission shape as editTitle.
   * Whitespace-only input collapses to null at the service layer.
   */
  editBody: authedProcedure.input(editBodySchema).mutation(async ({ ctx, input }) => {
    try {
      await assertCanViewBoard({
        groupId: input.groupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw toTRPCError(err);
    }
    try {
      const updated = await editTicketBody({
        requestId: input.requestId,
        viewerGroupId: input.groupId,
        actorId: ctx.user.id,
        body: input.body,
      });
      return { ok: true as const, body: updated.body };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

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
   * Propose a new ticket into the group's backlog. Any group viewer
   * (member, group admin, or system admin) may propose. The resulting
   * card sits off-board (status='backlog') until someone drags it onto
   * a column on the Backlog tab — the brief's Tier-1 path for "Propose
   * to backlog".
   */
  propose: authedProcedure.input(boardProposeSchema).mutation(async ({ ctx, input }) => {
    try {
      await assertCanViewBoard({
        groupId: input.groupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw toTRPCError(err);
    }
    try {
      const result = await proposeKanbanTicket({
        groupId: input.groupId,
        title: input.title,
        body: input.body,
        actorId: ctx.user.id,
      });
      return { ok: true as const, requestId: result.request.id };
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
