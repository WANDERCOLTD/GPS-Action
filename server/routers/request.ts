/**
 * @build-unit BU-requests-urgent
 * @spec architecture/decision-log.md (D054, D055, D058)
 * @spec architecture/api-contract.md
 * @spec product/scenarios.md (SCN-23)
 *
 * Request router — claim/resolve actions for the urgent loop, plus
 * the polling endpoint backing the reviewer queue. List queries live
 * on the page server component (server/services/request.ts directly).
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure, requireRole, publicProcedure } from '@/server/lib/trpc';
import {
  createUrgentRequest,
  claimRequest,
  resolveRequest,
  listUrgentForPolling,
  type RequestListItem,
} from '@/server/services/request';

const createUrgentSchema = z.object({
  alertCategoryId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(2000),
  regionSlug: z.string().trim().max(100).optional(),
});

const requestIdSchema = z.object({ requestId: z.string().min(1) });

const resolveSchema = z.object({
  requestId: z.string().min(1),
  notes: z.string().trim().max(1000).optional(),
});

export const requestRouter = router({
  /** Create an urgent Request (alert) — any authenticated member. */
  createUrgent: authedProcedure.input(createUrgentSchema).mutation(async ({ ctx, input }) => {
    const result = await createUrgentRequest({
      callerId: ctx.user.id,
      alertCategoryId: input.alertCategoryId,
      title: input.title,
      body: input.body,
      regionSlug: input.regionSlug ?? null,
    });
    return result;
  }),

  /**
   * Claim a Request. Requires queue_manager role (any scope) — atomic
   * claim returns FORBIDDEN if a race lost or the row no longer exists.
   */
  claim: authedProcedure
    .use(requireRole('queue_manager'))
    .input(requestIdSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await claimRequest({ requestId: input.requestId, userId: ctx.user.id });
      if (!result.ok) {
        throw new TRPCError({
          code: result.reason === 'not_found' ? 'NOT_FOUND' : 'CONFLICT',
          message: result.reason === 'not_found' ? 'Request not found' : 'Already claimed',
        });
      }
      return { ok: true as const };
    }),

  /**
   * Resolve a claimed Request. Caller must be the claimer or admin.
   * Note text is optional (may be a one-line outcome).
   */
  resolve: authedProcedure
    .use(requireRole('queue_manager'))
    .input(resolveSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await resolveRequest({
        requestId: input.requestId,
        userId: ctx.user.id,
        isAdmin: ctx.activeRoles.includes('admin'),
        notes: input.notes ?? null,
      });
      if (!result.ok) {
        const code =
          result.reason === 'not_found'
            ? 'NOT_FOUND'
            : result.reason === 'not_claimer'
              ? 'FORBIDDEN'
              : 'BAD_REQUEST';
        throw new TRPCError({ code, message: result.reason });
      }
      return { ok: true as const };
    }),

  /**
   * Polling endpoint — returns urgent Requests visible to the caller.
   * Public-ish (any authenticated user). D058 visibility broadening:
   * scope is not required for VIEWING urgent items, only for ACTING.
   */
  pollUrgent: publicProcedure.query(async (): Promise<RequestListItem[]> => {
    return listUrgentForPolling();
  }),
});
