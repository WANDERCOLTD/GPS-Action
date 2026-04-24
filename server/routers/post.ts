/**
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 *
 * Post tRPC router. Exposes post.list for the feed.
 * Uses publicProcedure — unauthenticated callers see public posts only;
 * visibility filtering is handled by the service layer.
 */

import { z } from 'zod';
import { router, publicProcedure } from '@/server/lib/trpc';
import { listPosts } from '@/server/services/post';

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
});
