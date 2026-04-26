/**
 * @build-unit BU-reactions
 * @spec architecture/decision-log.md (D050, D052)
 * @spec architecture/api-contract.md
 * @spec product/scenarios.md (SCN-3, SCN-20)
 *
 * Reaction tRPC router. Add, remove, list per post + per comment.
 * Add* is feature-flag-gated by `ff_reactions` (per D036, D050,
 * D052). Auth gate via authedProcedure.
 */

import { TRPCError } from '@trpc/server';
import { router, publicProcedure, authedProcedure } from '@/server/lib/trpc';
import {
  addReaction,
  removeReaction,
  listReactionsForPost,
  addReactionToComment,
  removeReactionFromComment,
  listReactionsForComment,
} from '@/server/services/reaction';
import { isFeatureEnabled } from '@/server/services/flags';
import {
  reactionAddSchema,
  reactionRemoveSchema,
  reactionListForPostSchema,
  reactionAddToCommentSchema,
  reactionRemoveFromCommentSchema,
} from '@/shared/validation/reaction';
import { z } from 'zod';

const FLAG_NAME = 'ff_reactions';

export const reactionRouter = router({
  add: authedProcedure.input(reactionAddSchema).mutation(async ({ ctx, input }) => {
    if (!(await isFeatureEnabled(FLAG_NAME))) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Reactions are disabled.',
      });
    }
    return addReaction({
      postId: input.postId,
      emoji: input.emoji,
      userId: ctx.user.id,
    });
  }),

  remove: authedProcedure.input(reactionRemoveSchema).mutation(async ({ ctx, input }) => {
    return removeReaction({
      postId: input.postId,
      emoji: input.emoji,
      userId: ctx.user.id,
    });
  }),

  listForPost: publicProcedure.input(reactionListForPostSchema).query(async ({ ctx, input }) => {
    return listReactionsForPost({
      postId: input.postId,
      callerId: ctx.user?.id ?? null,
    });
  }),

  // ── Comment-target variants (D052) ────────────────────────────────

  addToComment: authedProcedure
    .input(reactionAddToCommentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!(await isFeatureEnabled(FLAG_NAME))) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Reactions are disabled.',
        });
      }
      return addReactionToComment({
        commentId: input.commentId,
        emoji: input.emoji,
        userId: ctx.user.id,
      });
    }),

  removeFromComment: authedProcedure
    .input(reactionRemoveFromCommentSchema)
    .mutation(async ({ ctx, input }) => {
      return removeReactionFromComment({
        commentId: input.commentId,
        emoji: input.emoji,
        userId: ctx.user.id,
      });
    }),

  listForComment: publicProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return listReactionsForComment({
        commentId: input.commentId,
        callerId: ctx.user?.id ?? null,
      });
    }),
});
