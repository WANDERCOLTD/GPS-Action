/**
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052)
 * @spec architecture/api-contract.md
 * @spec product/scenarios.md (SCN-20)
 *
 * Comment tRPC router. add (auth + ff_comments gated) and
 * listForPost (public, visibility-respecting at the parent level).
 */

import { TRPCError } from '@trpc/server';
import { router, publicProcedure, authedProcedure } from '@/server/lib/trpc';
import { createComment, listCommentsForPost } from '@/server/services/comment';
import { isFeatureEnabled } from '@/server/services/flags';
import { commentAddSchema, commentListForPostSchema } from '@/shared/validation/comment';

const FLAG_NAME = 'ff_comments';

export const commentRouter = router({
  add: authedProcedure.input(commentAddSchema).mutation(async ({ ctx, input }) => {
    if (!(await isFeatureEnabled(FLAG_NAME))) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Comments are disabled.',
      });
    }
    return createComment({
      postId: input.postId,
      body: input.body,
      authorId: ctx.user.id,
    });
  }),

  listForPost: publicProcedure.input(commentListForPostSchema).query(async ({ ctx, input }) => {
    return listCommentsForPost({
      postId: input.postId,
      callerId: ctx.user?.id ?? null,
    });
  }),
});
