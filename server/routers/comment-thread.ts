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
import { prisma } from '@/server/db/client';
import {
  getCommentThreadAccess,
  listForKanbanTicket,
  createCommentForKanbanTicket,
  editCommentForKanbanTicket,
  deleteCommentForKanbanTicket,
  CommentMutationGateError,
} from '@/server/services/comment-thread';
import {
  commentThreadAddSchema,
  commentThreadListSchema,
  commentThreadEditSchema,
  commentThreadDeleteSchema,
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

  // ── Edit / Delete (ADR-0016 / D082) ────────────────────────────────────
  //
  // Author-only · request-comments only · human-source only. Defence-
  // in-depth: the router runs the same gate the service runs, so a
  // bypass via a future caller still hits the invariant.

  editComment: authedProcedure.input(commentThreadEditSchema).mutation(async ({ ctx, input }) => {
    const existing = await prisma.comment.findUnique({
      where: { id: input.commentId },
      select: {
        id: true,
        postId: true,
        requestId: true,
        authorId: true,
        source: true,
      },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment not found.' });
    }
    if (existing.requestId === null) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Edit / delete only on request comments per D082.',
      });
    }
    if (existing.source !== 'human') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'System rows cannot be edited.' });
    }
    if (existing.authorId !== ctx.user.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the author can edit this comment.',
      });
    }
    try {
      return await editCommentForKanbanTicket({
        commentId: input.commentId,
        actorUserId: ctx.user.id,
        body: input.body,
      });
    } catch (err) {
      throw mapServiceGateError(err);
    }
  }),

  deleteComment: authedProcedure
    .input(commentThreadDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.comment.findUnique({
        where: { id: input.commentId },
        select: {
          id: true,
          postId: true,
          requestId: true,
          authorId: true,
          source: true,
        },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment not found.' });
      }
      if (existing.requestId === null) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Edit / delete only on request comments per D082.',
        });
      }
      if (existing.source !== 'human') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'System rows cannot be deleted.' });
      }
      if (existing.authorId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the author can delete this comment.',
        });
      }
      try {
        return await deleteCommentForKanbanTicket({
          commentId: input.commentId,
          actorUserId: ctx.user.id,
        });
      } catch (err) {
        throw mapServiceGateError(err);
      }
    }),
});

function mapServiceGateError(err: unknown): TRPCError {
  if (err instanceof CommentMutationGateError) {
    if (err.reason === 'not_found') {
      return new TRPCError({ code: 'NOT_FOUND', message: err.message });
    }
    if (err.reason === 'not_request_comment') {
      return new TRPCError({ code: 'BAD_REQUEST', message: err.message });
    }
    return new TRPCError({ code: 'FORBIDDEN', message: err.message });
  }
  return err instanceof TRPCError
    ? err
    : new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Comment mutation failed.' });
}
