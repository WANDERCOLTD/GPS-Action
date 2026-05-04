/**
 * @build-unit bu-coordination-board (build seq #3 — routers)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * RequestSubscription router — explicit Follow / Unfollow gestures
 * for Surface 2's BoardActionPair, plus list / count queries.
 *
 * Auto-rules (auto_author / auto_assignee / auto_mention) populate
 * the table from server-side hooks in other services; the explicit
 * follow / unfollow buttons set source = 'explicit' and survive
 * unassign (per ADR-0009 + brief Tier-2 default #4).
 */

import { z } from 'zod';
import { router, authedProcedure } from '@/server/lib/trpc';
import {
  subscribe,
  unsubscribe,
  isSubscribed,
  listSubscribersForRequest,
  listActiveSubscriptionsForUser,
  countActiveSubscribers,
  type SubscriberSummary,
} from '@/server/services/subscriptions';

const requestIdSchema = z.object({ requestId: z.string().min(1) });

export const subscriptionRouter = router({
  /** Explicit follow — manual gesture, source = 'explicit'. */
  followSelf: authedProcedure.input(requestIdSchema).mutation(async ({ ctx, input }) => {
    const result = await subscribe({
      requestId: input.requestId,
      userId: ctx.user.id,
      source: 'explicit',
      actorId: ctx.user.id,
    });
    return { ok: true as const, created: result.created, reactivated: result.reactivated };
  }),

  /** Explicit unfollow — soft-deletes the subscription row. */
  unfollowSelf: authedProcedure.input(requestIdSchema).mutation(async ({ ctx, input }) => {
    const row = await unsubscribe({
      requestId: input.requestId,
      userId: ctx.user.id,
      actorId: ctx.user.id,
    });
    return { ok: row !== null && row.deletedAt !== null };
  }),

  /** Is the caller actively subscribed? Drives BoardActionPair button state. */
  isMineSubscribed: authedProcedure.input(requestIdSchema).query(async ({ ctx, input }) => {
    const subscribed = await isSubscribed(input.requestId, ctx.user.id);
    return { subscribed };
  }),

  /** Active subscribers for a Request — feeds the read-only sidebar list. */
  listForRequest: authedProcedure
    .input(requestIdSchema)
    .query(async ({ input }): Promise<SubscriberSummary[]> => {
      return listSubscribersForRequest(input.requestId);
    }),

  /** Caller's active subscriptions — feeds the "Subscribed-to" filter. */
  listMine: authedProcedure.query(async ({ ctx }) => {
    return listActiveSubscriptionsForUser(ctx.user.id);
  }),

  /** Subscriber count — drives the "+N" overflow on the avatar row. */
  countForRequest: authedProcedure.input(requestIdSchema).query(async ({ input }) => {
    const count = await countActiveSubscribers(input.requestId);
    return { count };
  }),
});
