/**
 * @build-unit bu-coordination-board (build seq #2 — share-with-team chunk)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0009
 *
 * Share-with-team primitives. Two entities, one service:
 *
 *   - RequestGroup: per-link state for cross-team shares. Each Request
 *     has exactly one row with origin = originating (the group it was
 *     authored in) plus zero-or-more shared rows.
 *   - GroupShareWorkflow: per-source-group admin allow-list of share
 *     targets. Constrains the picker; doesn't replace the role-level
 *     permission check.
 *
 * Permission envelope (follows the brief's permission table; service is
 * permission-agnostic at the system level — caller passes resolved flags):
 *   - Workflow share (mode = 'workflow'): any member of the source group
 *     can share to a target listed in GroupShareWorkflow(source → target).
 *     Service verifies the workflow row exists.
 *   - Ad-hoc share (mode = 'ad_hoc'): caller must be group admin of the
 *     source group OR a system admin. Caller-supplied via flags.
 *   - Self-share rejected at both layers (sourceGroupId !== targetGroupId).
 *
 * Errors are typed via ShareError so routers can map kind → TRPCError.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { Group, GroupShareWorkflow, RequestGroup, RequestGroupOrigin } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { emitKanbanSystemEvent } from '@/server/services/kanban-system-events';

export type ShareMode = 'workflow' | 'ad_hoc';

export type ShareErrorKind = 'self_share' | 'workflow_required' | 'forbidden_ad_hoc' | 'not_found';

export class ShareError extends Error {
  constructor(
    public readonly kind: ShareErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ShareError';
  }
}

// ─── RequestGroup ────────────────────────────────────────────────────────────

export interface CreateOriginatingRequestGroupInput {
  requestId: string;
  groupId: string;
  /** Mirror of Request.columnId at create time, when status = active. */
  columnId?: string | null;
  /** Mirror of Request.boardPosition at create time. */
  boardPosition?: Prisma.Decimal | number | null;
  actorId: string;
}

/**
 * Create the originating RequestGroup row for a freshly-authored
 * Request. Idempotent: if the originating row already exists, returns
 * it unchanged (no audit). Called from the request-create flow in
 * PR #2g; this service exposes the primitive.
 *
 * Invariants enforced (per ADR-0009):
 *   - Exactly one row per Request has origin = originating (the unique
 *     constraint on (requestId, groupId) plus the create-once contract).
 *   - The originating row's columnId/boardPosition mirror Request's
 *     fields at write time. Drift fixes live in board.ts (out of scope).
 */
export async function createOriginatingRequestGroup(
  input: CreateOriginatingRequestGroupInput,
): Promise<RequestGroup> {
  const existing = await prisma.requestGroup.findUnique({
    where: { requestId_groupId: { requestId: input.requestId, groupId: input.groupId } },
  });
  if (existing) return existing;

  const row = await prisma.requestGroup.create({
    data: {
      requestId: input.requestId,
      groupId: input.groupId,
      columnId: input.columnId ?? null,
      boardPosition: (input.boardPosition ?? null) as Prisma.Decimal | null,
      origin: 'originating',
    },
  });

  await auditLog({
    action: 'request_group_originating_created',
    entityType: 'RequestGroup',
    entityId: row.id,
    userId: input.actorId,
    context: { requestId: input.requestId, groupId: input.groupId },
  });

  return row;
}

export interface ShareRequestInput {
  requestId: string;
  /** Caller's current context group (for audit + workflow lookup). */
  sourceGroupId: string;
  targetGroupId: string;
  mode: ShareMode;
  actorId: string;
  /** Caller-resolved: true for system admin OR group admin of sourceGroupId. */
  isSystemAdmin: boolean;
  isGroupAdminOfSource: boolean;
}

/**
 * Share a Request to a target group. Idempotent: if a soft-deleted row
 * exists, undeletes it; if an active row exists, returns it unchanged.
 *
 * Throws ShareError on permission / validation failure:
 *   - 'self_share': sourceGroupId === targetGroupId.
 *   - 'workflow_required': mode='workflow' but no allow-list row.
 *   - 'forbidden_ad_hoc': mode='ad_hoc' without admin role.
 *
 * Sets origin = workflow_share or ad_hoc_share. The originating row
 * (origin = originating) is created separately by createOriginatingRequestGroup.
 */
export async function shareRequestToGroup(
  input: ShareRequestInput,
): Promise<{ row: RequestGroup; created: boolean; reactivated: boolean }> {
  if (input.sourceGroupId === input.targetGroupId) {
    throw new ShareError('self_share', 'Cannot share a Request to its own group');
  }

  if (input.mode === 'workflow') {
    const workflow = await prisma.groupShareWorkflow.findUnique({
      where: {
        sourceGroupId_targetGroupId: {
          sourceGroupId: input.sourceGroupId,
          targetGroupId: input.targetGroupId,
        },
      },
    });
    if (!workflow || workflow.deletedAt !== null) {
      throw new ShareError(
        'workflow_required',
        `No active GroupShareWorkflow ${input.sourceGroupId} → ${input.targetGroupId}`,
      );
    }
  } else if (!input.isGroupAdminOfSource && !input.isSystemAdmin) {
    throw new ShareError('forbidden_ad_hoc', 'Ad-hoc share requires group admin or system admin');
  }

  const origin: RequestGroupOrigin = input.mode === 'workflow' ? 'workflow_share' : 'ad_hoc_share';

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.requestGroup.findUnique({
      where: {
        requestId_groupId: { requestId: input.requestId, groupId: input.targetGroupId },
      },
    });

    if (existing && existing.deletedAt === null) {
      return { row: existing, created: false, reactivated: false };
    }
    if (existing) {
      const row = await tx.requestGroup.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          origin,
          sharedByUserId: input.actorId,
          updatedAt: new Date(),
        },
      });
      return { row, created: false, reactivated: true };
    }
    const row = await tx.requestGroup.create({
      data: {
        requestId: input.requestId,
        groupId: input.targetGroupId,
        origin,
        sharedByUserId: input.actorId,
      },
    });
    return { row, created: true, reactivated: false };
  });

  if (result.created || result.reactivated) {
    await auditLog({
      action: result.reactivated ? 'request_group_reshared' : 'request_group_shared',
      entityType: 'RequestGroup',
      entityId: result.row.id,
      userId: input.actorId,
      context: {
        requestId: input.requestId,
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
        mode: input.mode,
      },
    });

    await emitKanbanSystemEvent({
      requestId: input.requestId,
      actorId: input.actorId,
      event: { kind: 'share_to_team', targetGroupId: input.targetGroupId },
    });
  }

  return result;
}

export interface UnshareRequestInput {
  requestId: string;
  groupId: string;
  actorId: string;
}

/**
 * Soft-delete the link between Request and group. Idempotent (no-op
 * + no audit on already-deleted row, returns null when no row exists).
 *
 * Refuses to unshare the originating row — a Request can't be removed
 * from its origin group without deleting the Request itself.
 */
export async function unshareRequestFromGroup(
  input: UnshareRequestInput,
): Promise<RequestGroup | null> {
  const existing = await prisma.requestGroup.findUnique({
    where: { requestId_groupId: { requestId: input.requestId, groupId: input.groupId } },
  });
  if (!existing) return null;
  if (existing.deletedAt !== null) return existing;
  if (existing.origin === 'originating') {
    throw new ShareError(
      'forbidden_ad_hoc',
      'Cannot unshare the originating group; delete the Request instead',
    );
  }

  const row = await prisma.requestGroup.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  await auditLog({
    action: 'request_group_unshared',
    entityType: 'RequestGroup',
    entityId: row.id,
    userId: input.actorId,
    context: {
      requestId: input.requestId,
      groupId: input.groupId,
      origin: existing.origin,
    },
  });

  return row;
}

/**
 * List the active groups a Request is shared to, including the
 * originating group. Drives Surface 2's "Shared with: Writers, IT" pill
 * row. Excludes soft-deleted links and soft-deleted groups.
 */
export async function listGroupsForRequest(
  requestId: string,
): Promise<Array<{ group: Group; link: RequestGroup }>> {
  const rows = await prisma.requestGroup.findMany({
    where: { requestId, deletedAt: null, group: { deletedAt: null } },
    include: { group: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(({ group, ...link }) => ({ group, link }));
}

// ─── GroupShareWorkflow ──────────────────────────────────────────────────────

export interface AddShareWorkflowInput {
  sourceGroupId: string;
  targetGroupId: string;
  actorId: string;
}

/**
 * Add a workflow allow-list entry. Idempotent: undeletes a soft-deleted
 * row, no-ops on an active one. Refuses self-share (Open Q #4 from the
 * session-3 handoff: enforced at the service layer; no DB-level CHECK).
 */
export async function addShareWorkflow(
  input: AddShareWorkflowInput,
): Promise<{ row: GroupShareWorkflow; created: boolean; reactivated: boolean }> {
  if (input.sourceGroupId === input.targetGroupId) {
    throw new ShareError('self_share', 'GroupShareWorkflow source must differ from target');
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.groupShareWorkflow.findUnique({
      where: {
        sourceGroupId_targetGroupId: {
          sourceGroupId: input.sourceGroupId,
          targetGroupId: input.targetGroupId,
        },
      },
    });

    if (existing && existing.deletedAt === null) {
      return { row: existing, created: false, reactivated: false };
    }
    if (existing) {
      const row = await tx.groupShareWorkflow.update({
        where: { id: existing.id },
        data: { deletedAt: null, addedByUserId: input.actorId, updatedAt: new Date() },
      });
      return { row, created: false, reactivated: true };
    }
    const row = await tx.groupShareWorkflow.create({
      data: {
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
        addedByUserId: input.actorId,
      },
    });
    return { row, created: true, reactivated: false };
  });

  if (result.created || result.reactivated) {
    await auditLog({
      action: result.reactivated ? 'group_share_workflow_readded' : 'group_share_workflow_added',
      entityType: 'GroupShareWorkflow',
      entityId: result.row.id,
      userId: input.actorId,
      context: {
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
      },
    });
  }

  return result;
}

export interface RemoveShareWorkflowInput {
  sourceGroupId: string;
  targetGroupId: string;
  actorId: string;
}

/**
 * Soft-delete a workflow allow-list entry. Idempotent (no-op on
 * already-deleted, returns null when no row exists).
 *
 * Existing RequestGroup links survive — removing the allow-list entry
 * only stops new shares of that route. Members keep their per-link state.
 */
export async function removeShareWorkflow(
  input: RemoveShareWorkflowInput,
): Promise<GroupShareWorkflow | null> {
  const existing = await prisma.groupShareWorkflow.findUnique({
    where: {
      sourceGroupId_targetGroupId: {
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
      },
    },
  });
  if (!existing) return null;
  if (existing.deletedAt !== null) return existing;

  const row = await prisma.groupShareWorkflow.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  await auditLog({
    action: 'group_share_workflow_removed',
    entityType: 'GroupShareWorkflow',
    entityId: row.id,
    userId: input.actorId,
    context: {
      sourceGroupId: input.sourceGroupId,
      targetGroupId: input.targetGroupId,
    },
  });

  return row;
}

/**
 * List active workflow targets for a source group. Drives the
 * "Allowed targets" section of the Share-with-team picker. Excludes
 * soft-deleted workflow rows and soft-deleted target groups.
 */
export async function listShareWorkflowTargets(
  sourceGroupId: string,
): Promise<Array<{ group: Group; workflow: GroupShareWorkflow }>> {
  const rows = await prisma.groupShareWorkflow.findMany({
    where: { sourceGroupId, deletedAt: null, targetGroup: { deletedAt: null } },
    include: { targetGroup: true },
    orderBy: { targetGroup: { displayName: 'asc' } },
  });
  return rows.map(({ targetGroup, ...workflow }) => ({ group: targetGroup, workflow }));
}
