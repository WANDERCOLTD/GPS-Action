/**
 * @build-unit BU-feed BU-composer BU-tick-or-cross BU-event-time
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D045, D069, D073)
 *
 * Post tRPC router. Exposes:
 *  - post.list        — feed listing
 *  - post.create      — composer mutation
 *  - post.update      — edit-page mutation (BU-event-time / D073)
 *  - post.listUpcoming — agenda query for bu-calendar-view (D073)
 *  - post.markSharedToNetwork — BU-tick-or-cross handoff confirm
 */

import { z } from 'zod';
import { router, publicProcedure, authedProcedure } from '@/server/lib/trpc';
import {
  listPosts,
  createPost,
  updatePost,
  listUpcoming,
  markSharedToNetwork,
} from '@/server/services/post';
import { postCreateSchema, postUpdateSchema } from '@/shared/validation/post';
import { FEED_FILTERS, type FeedFilter } from '@/shared/feed-filters';

const cursorSchema = z.object({
  createdAt: z.date(),
  id: z.string(),
});

const feedFilterSchema = z.enum([...FEED_FILTERS] as [FeedFilter, ...FeedFilter[]]);

// BU-event-time / D073. Coerce ISO strings to Date so callers from
// the client (where dates serialise as strings over the wire) and
// callers from server contexts (where Date instances are passed
// directly) both work without ceremony.
const isoOrDate = z
  .union([z.string(), z.date()])
  .transform((v): Date => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !isNaN(d.getTime()), { message: 'invalid date' });

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

  // BU-event-time / D073. Agenda query for bu-calendar-view. `from`
  // defaults to today 00:00 Europe/London inside the service. `to` is
  // optional (no upper bound by default). `kindSlugs` filters to a
  // subset (e.g. just `meeting`); empty / omitted = all kinds with
  // an eventAt set.
  listUpcoming: publicProcedure
    .input(
      z
        .object({
          from: isoOrDate.optional(),
          to: isoOrDate.optional(),
          kindSlugs: z.array(z.string().min(1)).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return listUpcoming({
        callerId: ctx.user?.id ?? null,
        from: input?.from,
        to: input?.to,
        kindSlugs: input?.kindSlugs,
        limit: input?.limit,
      });
    }),

  create: authedProcedure.input(postCreateSchema).mutation(async ({ ctx, input }) => {
    return createPost(input, ctx.user.id);
  }),

  // BU-event-time / D073. Edit an existing post. Permissions enforced
  // in the service layer: own post (any role) / coordinator / director.
  update: authedProcedure.input(postUpdateSchema).mutation(async ({ ctx, input }) => {
    return updatePost(input, ctx.user.id);
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
