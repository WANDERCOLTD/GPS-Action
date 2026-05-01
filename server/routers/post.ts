/**
 * @build-unit BU-feed BU-composer BU-tick-or-cross BU-event-time BU-publish-router BU-calendar-near-me
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D045, D069, D072, D073, D076)
 *
 * Post tRPC router. Exposes:
 *  - post.list        — feed listing
 *  - post.create      — composer mutation
 *  - post.update      — edit-page mutation (BU-event-time / D073)
 *  - post.listUpcoming — agenda query for bu-calendar-view (D073)
 *  - post.listNearby   — distance-sorted query for bu-calendar-near-me (D076)
 *  - post.markSharedToNetwork — BU-tick-or-cross handoff confirm
 *  - publish-router lifecycle verbs (publish / sendForReview /
 *    saveDraft / discard / restore / autosaveDraft) called from
 *    app/compose/actions.ts (BU-publish-router / D072).
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, authedProcedure } from '@/server/lib/trpc';
import {
  listPosts,
  createPost,
  updatePost,
  listUpcoming,
  listNearby,
  markSharedToNetwork,
  publishPost,
  sendPostForReview,
  saveDraft,
  discardPost,
  restorePost,
  autosaveDraft,
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

  // BU-calendar-near-me / D076. Returns event-bearing posts with
  // structured coords, sorted by Haversine distance from `lat`/`lng`.
  // Excludes online events (`isOnline=true`) and posts with no
  // coordinates. Visibility honoured server-side.
  listNearby: publicProcedure
    .input(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        from: isoOrDate.optional(),
        kindSlugs: z.array(z.string().min(1)).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listNearby({
        callerId: ctx.user?.id ?? null,
        lat: input.lat,
        lng: input.lng,
        from: input.from,
        kindSlugs: input.kindSlugs,
        limit: input.limit,
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

  // BU-publish-router / D072. Lifecycle verbs the publish modal calls.
  // Each lifts the corresponding service result; the service returns
  // a discriminated `{ ok, reason }` so the router can map to TRPCError
  // codes consistently.
  publish: authedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await publishPost({ postId: input.postId, callerId: ctx.user.id });
      if (!result.ok) throw mapLifecycleError(result.reason);
      return { postId: result.postId, publishedAt: result.publishedAt };
    }),

  sendForReview: authedProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        alsoPublishToFeed: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await sendPostForReview({
        postId: input.postId,
        callerId: ctx.user.id,
        alsoPublishToFeed: input.alsoPublishToFeed,
      });
      if (!result.ok) throw mapLifecycleError(result.reason);
      return {
        postId: result.postId,
        reviewRequestId: result.reviewRequestId,
        publishedAt: result.publishedAt,
      };
    }),

  saveDraft: authedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await saveDraft({ postId: input.postId, callerId: ctx.user.id });
      if (!result.ok) throw mapLifecycleError(result.reason);
      return { ok: true as const };
    }),

  discard: authedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await discardPost({ postId: input.postId, callerId: ctx.user.id });
      if (!result.ok) throw mapLifecycleError(result.reason);
      return { postId: result.postId, deletedAt: result.deletedAt };
    }),

  restore: authedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await restorePost({ postId: input.postId, callerId: ctx.user.id });
      if (!result.ok) throw mapLifecycleError(result.reason);
      return { postId: result.postId };
    }),

  autosaveDraft: authedProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        fields: z
          .object({
            title: z.string().max(200).optional(),
            body: z.string().max(10000).optional(),
            visibility: z.enum(['public', 'authenticated_only']).optional(),
            linkUrl: z.string().nullable().optional(),
            linkTitle: z.string().nullable().optional(),
            linkDescription: z.string().nullable().optional(),
            linkImageUrl: z.string().nullable().optional(),
            linkSiteName: z.string().nullable().optional(),
            heroImageUrl: z.string().nullable().optional(),
            signal: z.enum(['promote', 'remove']).nullable().optional(),
            kindId: z.string().nullable().optional(),
            urgency: z.boolean().optional(),
          })
          .strict(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await autosaveDraft({
        postId: input.postId,
        callerId: ctx.user.id,
        fields: input.fields,
      });
      if (!result.ok) throw mapLifecycleError(result.reason);
      return { updatedAt: result.updatedAt };
    }),
});

type LifecycleErrorReason =
  | 'not_found'
  | 'not_owner'
  | 'discarded'
  | 'already_published'
  | 'already_in_review'
  | 'already_discarded'
  | 'no_kind'
  | 'in_review'
  | 'no_fields'
  | 'not_discarded';

function mapLifecycleError(reason: LifecycleErrorReason): TRPCError {
  switch (reason) {
    case 'not_found':
      return new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
    case 'not_owner':
      return new TRPCError({ code: 'FORBIDDEN', message: 'Not the post author' });
    case 'in_review':
      return new TRPCError({
        code: 'CONFLICT',
        message: 'In review — edits paused',
      });
    case 'discarded':
    case 'already_discarded':
    case 'already_published':
    case 'already_in_review':
    case 'not_discarded':
    case 'no_kind':
    case 'no_fields':
      return new TRPCError({ code: 'BAD_REQUEST', message: reason });
  }
}
