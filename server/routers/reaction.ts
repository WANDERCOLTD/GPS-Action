/**
 * @build-unit BU-reactions
 * @spec architecture/decision-log.md (D050)
 * @spec architecture/api-contract.md
 * @spec product/scenarios.md (SCN-3)
 *
 * Reaction tRPC router. Add, remove, list per post. Add is feature-
 * flag-gated by `ff_reactions` (per D036, D050). Auth gate is via
 * authedProcedure (no inline ctx.user.role checks — F06 rule 4).
 */

import { TRPCError } from '@trpc/server';
import { router, publicProcedure, authedProcedure } from '@/server/lib/trpc';
import { addReaction, removeReaction, listReactionsForPost } from '@/server/services/reaction';
import { isFeatureEnabled } from '@/server/services/flags';
import {
  reactionAddSchema,
  reactionRemoveSchema,
  reactionListForPostSchema,
} from '@/shared/validation/reaction';

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
});
