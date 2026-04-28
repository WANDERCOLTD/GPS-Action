/**
 * @build-unit BU-feed BU-composer BU-tick-or-cross
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D045, D069)
 *
 * Post tRPC router. Exposes post.list for the feed,
 * post.create for composing new posts, and
 * post.markSharedToNetwork for the BU-tick-or-cross handoff confirm.
 */

import { z } from 'zod';
import { router, publicProcedure, authedProcedure } from '@/server/lib/trpc';
import { listPosts, createPost, markSharedToNetwork } from '@/server/services/post';
import { postCreateSchema } from '@/shared/validation/post';
import { FEED_FILTERS, type FeedFilter } from '@/shared/feed-filters';

const cursorSchema = z.object({
  createdAt: z.date(),
  id: z.string(),
});

const feedFilterSchema = z.enum([...FEED_FILTERS] as [FeedFilter, ...FeedFilter[]]);

export const postRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          cursor: cursorSchema.optional(),
          limit: z.number().int().min(1).max(50).optional(),
          filter: feedFilterSchema.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return listPosts({
        cursor: input?.cursor,
        limit: input?.limit,
        callerId: ctx.user?.id ?? null,
        filter: input?.filter,
      });
    }),

  create: authedProcedure.input(postCreateSchema).mutation(async ({ ctx, input }) => {
    return createPost(input, ctx.user.id);
  }),

  // BU-tick-or-cross / D069. Idempotent confirm: stamps sharedToNetworkAt
  // on the first call, no-op afterwards. Anyone authenticated may call —
  // the demo trusts the self-report. Service-side audit log captures the
  // identity of the caller.
  markSharedToNetwork: authedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return markSharedToNetwork(input.postId, ctx.user.id);
    }),
});
