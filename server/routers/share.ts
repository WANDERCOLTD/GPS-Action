/**
 * @build-unit bu-coordination-board (build seq #3 — routers)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0009
 *
 * Share-with-team router — wraps `server/services/request-group.ts`.
 * Two surfaces: per-Request shares (RequestGroup) and per-team
 * allow-list (GroupShareWorkflow).
 *
 * Permission gates:
 *   - shareToGroup: caller must be a member of the source group.
 *     Ad-hoc mode requires isGroupAdmin || isSystemAdmin (resolved
 *     from group-kanban's getGroupAccess); the service then enforces.
 *   - unshareFromGroup: caller must be member of the group or sysadmin.
 *   - addWorkflow / removeWorkflow: group-admin of source or sysadmin.
 *   - list endpoints: group-member or sysadmin.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from '@/server/lib/trpc';
import {
  shareRequestToGroup,
  unshareRequestFromGroup,
  listGroupsForRequest,
  checkAccessLossOnUnshare,
  addShareWorkflow,
  removeShareWorkflow,
  listShareWorkflowTargets,
  listAddableShareTargets,
  ShareError,
} from '@/server/services/request-group';
import {
  getGroupAccess,
  assertCanViewBoard,
  assertCanAdminBoard,
  GroupAccessError,
} from '@/server/services/group-kanban';

const requestIdSchema = z.object({ requestId: z.string().min(1) });
const sourceGroupSchema = z.object({ sourceGroupId: z.string().min(1) });

const shareSchema = z.object({
  requestId: z.string().min(1),
  sourceGroupId: z.string().min(1),
  targetGroupId: z.string().min(1),
  mode: z.enum(['workflow', 'ad_hoc']),
});

const unshareSchema = z.object({
  requestId: z.string().min(1),
  groupId: z.string().min(1),
});

const workflowPairSchema = z.object({
  sourceGroupId: z.string().min(1),
  targetGroupId: z.string().min(1),
});

function shareErrorToTRPC(err: unknown): TRPCError {
  if (err instanceof ShareError) {
    const code =
      err.kind === 'self_share' || err.kind === 'workflow_required'
        ? 'BAD_REQUEST'
        : err.kind === 'forbidden_ad_hoc'
          ? 'FORBIDDEN'
          : 'NOT_FOUND';
    return new TRPCError({ code, message: err.message });
  }
  if (err instanceof GroupAccessError) {
    return new TRPCError({
      code: err.kind === 'forbidden' ? 'FORBIDDEN' : 'NOT_FOUND',
      message: err.message,
    });
  }
  if (err instanceof Error) {
    return new TRPCError({ code: 'BAD_REQUEST', message: err.message });
  }
  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected' });
}

export const shareRouter = router({
  /** Share a Request from sourceGroup to targetGroup. */
  toGroup: authedProcedure.input(shareSchema).mutation(async ({ ctx, input }) => {
    const isSystemAdmin = ctx.activeRoles.includes('admin');
    const sourceAccess = await getGroupAccess({
      groupId: input.sourceGroupId,
      userId: ctx.user.id,
      isSystemAdmin,
    });
    if (!sourceAccess.canViewBoard) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Source group ${input.sourceGroupId} not accessible`,
      });
    }

    try {
      const result = await shareRequestToGroup({
        requestId: input.requestId,
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
        mode: input.mode,
        actorId: ctx.user.id,
        isSystemAdmin,
        isGroupAdminOfSource: sourceAccess.isGroupAdmin,
      });
      return {
        ok: true as const,
        created: result.created,
        reactivated: result.reactivated,
      };
    } catch (err) {
      throw shareErrorToTRPC(err);
    }
  }),

  /**
   * Unshare — soft-deletes the link. Refuses originating row.
   *
   * Permission per Q1 of bu-ticket-view-fixes (Item 4): allowed if the
   * caller is (a) a system admin, OR (b) a member of the *target*
   * group ("leave the share" — receiving team's self-unshare), OR
   * (c) a member of the *originating* group (revoke the share). Any
   * one of those three is sufficient.
   *
   * Idempotent per Q1 — receiving-team self-unshare must not error.
   * The service is already idempotent on already-deleted / missing
   * rows (returns the deleted row / null without throwing); this
   * router translates that to `ok: true` either way so the UI doesn't
   * surface a "you couldn't unshare what was already unshared" error.
   */
  fromGroup: authedProcedure.input(unshareSchema).mutation(async ({ ctx, input }) => {
    const isSystemAdmin = ctx.activeRoles.includes('admin');

    // Path (b): direct membership of the target group being unshared.
    const targetAccess = await getGroupAccess({
      groupId: input.groupId,
      userId: ctx.user.id,
      isSystemAdmin,
    });

    let permitted = targetAccess.canViewBoard;

    if (!permitted) {
      // Path (c): caller belongs to the originating group of this
      // Request. Look up the originating RequestGroup row to find
      // which group authored the ticket, then check membership there.
      // We do this only when path (b) fails so the common case stays
      // a single membership query.
      const requestGroups = await listGroupsForRequest(input.requestId);
      const originating = requestGroups.find((rg) => rg.link.origin === 'originating');
      if (originating) {
        const originAccess = await getGroupAccess({
          groupId: originating.group.id,
          userId: ctx.user.id,
          isSystemAdmin,
        });
        permitted = originAccess.canViewBoard;
      }
    }

    if (!permitted) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not accessible',
      });
    }

    try {
      // Idempotent per Q1 — the service returns the existing
      // (already-deleted) row or null when the share was already
      // gone; we report ok=true in either case so a receiving-team
      // member's self-unshare never surfaces an error.
      await unshareRequestFromGroup({
        requestId: input.requestId,
        groupId: input.groupId,
        actorId: ctx.user.id,
      });
      return { ok: true as const };
    } catch (err) {
      throw shareErrorToTRPC(err);
    }
  }),

  /** Active groups a Request is shared to — feeds Surface 2 pill row. */
  listGroupsForRequest: authedProcedure
    .input(requestIdSchema)
    .query(async ({ input }) => listGroupsForRequest(input.requestId)),

  /**
   * Detect whether the caller has just lost access via unshare. Used
   * by the ticket-detail page to redirect gracefully instead of 404
   * when a share was removed while the viewer had the page open. See
   * Item 4 of bu-ticket-view-fixes (Sub-build B).
   */
  checkAccessLoss: authedProcedure
    .input(z.object({ requestId: z.string().min(1), groupId: z.string().min(1) }))
    .query(async ({ input }) => {
      return checkAccessLossOnUnshare(input.requestId, input.groupId);
    }),

  /** Add a workflow allow-list entry. Group-admin of source or sysadmin. */
  addWorkflow: authedProcedure.input(workflowPairSchema).mutation(async ({ ctx, input }) => {
    try {
      await assertCanAdminBoard({
        groupId: input.sourceGroupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw shareErrorToTRPC(err);
    }
    try {
      const result = await addShareWorkflow({
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
        actorId: ctx.user.id,
      });
      return {
        ok: true as const,
        created: result.created,
        reactivated: result.reactivated,
      };
    } catch (err) {
      throw shareErrorToTRPC(err);
    }
  }),

  /** Remove a workflow allow-list entry. */
  removeWorkflow: authedProcedure.input(workflowPairSchema).mutation(async ({ ctx, input }) => {
    try {
      await assertCanAdminBoard({
        groupId: input.sourceGroupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw shareErrorToTRPC(err);
    }
    const row = await removeShareWorkflow({
      sourceGroupId: input.sourceGroupId,
      targetGroupId: input.targetGroupId,
      actorId: ctx.user.id,
    });
    return { ok: row !== null && row.deletedAt !== null };
  }),

  /** List active workflow targets — feeds the share-with-team picker. */
  listWorkflowTargets: authedProcedure.input(sourceGroupSchema).query(async ({ ctx, input }) => {
    try {
      await assertCanViewBoard({
        groupId: input.sourceGroupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw shareErrorToTRPC(err);
    }
    return listShareWorkflowTargets(input.sourceGroupId);
  }),

  /**
   * List groups eligible to be added as workflow targets from this
   * source. Admin-only — drives the "Add target" picker on
   * `/board/<slug>/settings`.
   */
  listAddableTargets: authedProcedure.input(sourceGroupSchema).query(async ({ ctx, input }) => {
    try {
      await assertCanAdminBoard({
        groupId: input.sourceGroupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    } catch (err) {
      throw shareErrorToTRPC(err);
    }
    return listAddableShareTargets(input.sourceGroupId);
  }),
});
