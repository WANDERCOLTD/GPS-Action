/**
 * @build-unit BU-feed BU-composer
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D045)
 *
 * Post tRPC router. Exposes post.list for the feed and
 * post.create for composing new posts.
 */

import { z } from 'zod';
import { router, publicProcedure, authedProcedure } from '@/server/lib/trpc';
import { listPosts, createPost } from '@/server/services/post';
import { postCreateSchema } from '@/shared/validation/post';

const cursorSchema = z.object({
  createdAt: z.date(),
  id: z.string(),
});

export const postRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          cursor: cursorSchema.optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return listPosts({
        cursor: input?.cursor,
        limit: input?.limit,
        callerId: ctx.user?.id ?? null,
      });
    }),

  create: authedProcedure.input(postCreateSchema).mutation(async ({ ctx, input }) => {
    return createPost(input, ctx.user.id);
  }),
});
