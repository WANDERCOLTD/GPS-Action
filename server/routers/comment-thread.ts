/**
 * @build-unit bu-coordination-board (atom 5d-2)
 * @spec docs/build/session-handoffs/parallel-stream-b-comment-thread-2026-05-05.md
 * @adr 0007
 *
 * tRPC router for the kanban ticket-detail comment / note thread.
 *
 * Endpoints:
 *   - listForRequest({ requestId, viewerGroupId }) — interleaved thread
 *     read; `viewerGroupId` controls note visibility (only the
 *     originating-group viewer sees notes).
 *   - postComment({ requestId, body }) — kind = comment, source = human.
 *   - postNote({ requestId, body }) — kind = note, source = human.
 *     Restricted to originating-team members + system admins so we don't
 *     create ghost notes invisible to their own author.
 *
 * Permission gate uses `getCommentThreadAccess` from the service.
 * Member of any active link → can comment; member of originating group
 * (or sysadmin) → can post + see notes.
 */

import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from '@/server/lib/trpc';
import {
  getCommentThreadAccess,
  listForKanbanTicket,
  createCommentForKanbanTicket,
} from '@/server/services/comment-thread';
import {
  commentThreadAddSchema,
  commentThreadListSchema,
} from '@/shared/validation/comment-thread';

export const commentThreadRouter = router({
  listForRequest: authedProcedure.input(commentThreadListSchema).query(async ({ ctx, input }) => {
    const isSystemAdmin = ctx.activeRoles.includes('admin');
    const access = await getCommentThreadAccess({
      requestId: input.requestId,
      userId: ctx.user.id,
      isSystemAdmin,
    });
    if (!access.canComment) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of any team linked to this ticket.',
      });
    }
    return listForKanbanTicket({
      requestId: input.requestId,
      viewerGroupId: input.viewerGroupId,
      viewerId: ctx.user.id,
    });
  }),

  postComment: authedProcedure.input(commentThreadAddSchema).mutation(async ({ ctx, input }) => {
    const isSystemAdmin = ctx.activeRoles.includes('admin');
    const access = await getCommentThreadAccess({
      requestId: input.requestId,
      userId: ctx.user.id,
      isSystemAdmin,
    });
    if (!access.canComment) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of any team linked to this ticket.',
      });
    }
    return createCommentForKanbanTicket({
      requestId: input.requestId,
      authorId: ctx.user.id,
      body: input.body,
      kind: 'comment',
    });
  }),

  postNote: authedProcedure.input(commentThreadAddSchema).mutation(async ({ ctx, input }) => {
    const isSystemAdmin = ctx.activeRoles.includes('admin');
    const access = await getCommentThreadAccess({
      requestId: input.requestId,
      userId: ctx.user.id,
      isSystemAdmin,
    });
    if (!access.canPostNote) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Notes are visible only to the originating team.',
      });
    }
    return createCommentForKanbanTicket({
      requestId: input.requestId,
      authorId: ctx.user.id,
      body: input.body,
      kind: 'note',
    });
  }),
});
