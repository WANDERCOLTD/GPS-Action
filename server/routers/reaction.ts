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
  addReactionToNetworkCard,
  removeReactionFromNetworkCard,
  listReactionsForNetworkCard,
  listReactionsForNetworkCards,
} from '@/server/services/reaction';
import { isFeatureEnabled } from '@/server/services/flags';
import {
  reactionAddSchema,
  reactionRemoveSchema,
  reactionListForPostSchema,
  reactionAddToCommentSchema,
  reactionRemoveFromCommentSchema,
  reactionAddToNetworkCardSchema,
  reactionRemoveFromNetworkCardSchema,
  reactionListForNetworkCardSchema,
  reactionListForNetworkCardsSchema,
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

  // ── Network-card-target variants (BU-network-reactions) ──────────

  addToNetworkCard: authedProcedure
    .input(reactionAddToNetworkCardSchema)
    .mutation(async ({ ctx, input }) => {
      if (!(await isFeatureEnabled(FLAG_NAME))) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Reactions are disabled.',
        });
      }
      return addReactionToNetworkCard({
        messageId: input.messageId,
        emoji: input.emoji,
        userId: ctx.user.id,
      });
    }),

  removeFromNetworkCard: authedProcedure
    .input(reactionRemoveFromNetworkCardSchema)
    .mutation(async ({ ctx, input }) => {
      return removeReactionFromNetworkCard({
        messageId: input.messageId,
        emoji: input.emoji,
        userId: ctx.user.id,
      });
    }),

  listForNetworkCard: publicProcedure
    .input(reactionListForNetworkCardSchema)
    .query(async ({ ctx, input }) => {
      return listReactionsForNetworkCard({
        messageId: input.messageId,
        callerId: ctx.user?.id ?? null,
      });
    }),

  listForNetworkCards: publicProcedure
    .input(reactionListForNetworkCardsSchema)
    .query(async ({ ctx, input }) => {
      const map = await listReactionsForNetworkCards({
        messageIds: input.messageIds,
        callerId: ctx.user?.id ?? null,
      });
      // Wire-friendly serialisation — tRPC handles Map via superjson but
      // a plain Record keeps consumers (server actions, tests) simpler.
      const out: Record<string, Awaited<ReturnType<typeof listReactionsForNetworkCard>>> = {};
      for (const [key, val] of map) out[key] = val;
      return out;
    }),
});
