/**
 * @build-unit bu-coordination-board (build seq #3 — routers)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0009
 *
 * Assignment router — tRPC endpoints for the multi-assignee join.
 * Wraps server/services/assignments.ts.
 *
 * Scoped to self-assign + self-unassign in the MVP. Assigning others
 * is a group-admin gesture that arrives with Surface 2's admin
 * controls; the service primitive (`assignToRequest`) accepts an
 * arbitrary userId, so the future router endpoint is a one-line addition.
 */

import { z } from 'zod';
import { router, authedProcedure } from '@/server/lib/trpc';
import {
  assignToRequest,
  unassign,
  listAssigneesForRequest,
  listActiveAssignmentsForUser,
  isAssigneeActive,
  type AssigneeSummary,
} from '@/server/services/assignments';

const requestIdSchema = z.object({ requestId: z.string().min(1) });

export const assignmentRouter = router({
  /** Self-assign — Tier-2 default #4 also auto-subscribes the caller. */
  assignSelf: authedProcedure.input(requestIdSchema).mutation(async ({ ctx, input }) => {
    const result = await assignToRequest({
      requestId: input.requestId,
      userId: ctx.user.id,
      actorId: ctx.user.id,
    });
    return { ok: true as const, created: result.created, reactivated: result.reactivated };
  }),

  /** Self-unassign — leaves any existing subscription in place (Surface 2 spec). */
  unassignSelf: authedProcedure.input(requestIdSchema).mutation(async ({ ctx, input }) => {
    const row = await unassign({
      requestId: input.requestId,
      userId: ctx.user.id,
      actorId: ctx.user.id,
    });
    return { ok: row !== null && row.unassignedAt !== null };
  }),

  /** Active assignees for a Request — feeds the avatar row on Surface 2. */
  listForRequest: authedProcedure
    .input(requestIdSchema)
    .query(async ({ input }): Promise<AssigneeSummary[]> => {
      return listAssigneesForRequest(input.requestId);
    }),

  /** Caller's active assignments — feeds the "Assigned to me" filter. */
  listMine: authedProcedure.query(async ({ ctx }) => {
    return listActiveAssignmentsForUser(ctx.user.id);
  }),

  /** Is the caller actively assigned? Drives BoardActionPair button state. */
  isMineActive: authedProcedure.input(requestIdSchema).query(async ({ ctx, input }) => {
    const active = await isAssigneeActive(input.requestId, ctx.user.id);
    return { active };
  }),
});
