/**
 * @build-unit bu-coordination-board (build seq #2 — first chunk)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0009
 *
 * Assignment service — multi-assignee join between Request and User.
 * Replaces the single-owner pattern of Request.claimedByUserId
 * (consumer-side migration in a later PR; this service runs alongside
 * the legacy field).
 *
 * Auto-rules (Tier-2 default #4):
 *   - Self-assign creates an Assignment row AND a RequestSubscription
 *     row with source = auto_assignee (idempotent: re-assigning a user
 *     who has been unassigned undeletes the subscription too).
 *   - Unassign sets Assignment.unassignedAt; the corresponding
 *     RequestSubscription is intentionally LEFT IN PLACE — explicit
 *     unsubscribe is a separate gesture (Surface 2's Follow / Unfollow
 *     pair, not the Assign-me / Unassign pair).
 *
 * No "owner" vocabulary — first-assignee gets no special status.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { Assignment } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';

export interface AssigneeSummary {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  assignedAt: Date;
}

export interface AssignInput {
  requestId: string;
  userId: string;
  /** Whoever performed the action (often the same as userId for self-assign). */
  actorId: string;
}

export interface UnassignInput {
  requestId: string;
  userId: string;
  actorId: string;
}

/**
 * Assign a user to a Request. Idempotent: returns the existing active
 * Assignment if the user is already assigned. If a previous assignment
 * was unassigned (unassignedAt non-null), un-deletes by clearing it.
 *
 * Side effect: ensures a RequestSubscription with source = auto_assignee
 * exists for this (requestId, userId). If a subscription was previously
 * soft-deleted, undeletes it; if it exists with a different source
 * (e.g. auto_author), leaves source unchanged but ensures it's active.
 */
export async function assignToRequest(
  input: AssignInput,
): Promise<{ assignment: Assignment; created: boolean; reactivated: boolean }> {
  const { requestId, userId, actorId } = input;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.assignment.findUnique({
      where: { requestId_userId: { requestId, userId } },
    });

    let assignment: Assignment;
    let created = false;
    let reactivated = false;

    if (existing && existing.unassignedAt === null) {
      assignment = existing;
    } else if (existing) {
      assignment = await tx.assignment.update({
        where: { id: existing.id },
        data: { unassignedAt: null, assignedAt: new Date() },
      });
      reactivated = true;
    } else {
      assignment = await tx.assignment.create({ data: { requestId, userId } });
      created = true;
    }

    // Auto-subscribe per Tier-2 default #4. Idempotent: leaves the
    // source label alone if a stronger subscription (e.g. author)
    // already exists; just makes sure the row is active.
    const sub = await tx.requestSubscription.findUnique({
      where: { requestId_userId: { requestId, userId } },
    });
    if (!sub) {
      await tx.requestSubscription.create({
        data: { requestId, userId, source: 'auto_assignee' },
      });
    } else if (sub.deletedAt !== null) {
      await tx.requestSubscription.update({
        where: { id: sub.id },
        data: { deletedAt: null },
      });
    }

    return { assignment, created, reactivated };
  });

  if (result.created || result.reactivated) {
    await auditLog({
      action: result.reactivated ? 'assignment_reactivated' : 'assignment_created',
      entityType: 'Assignment',
      entityId: result.assignment.id,
      userId: actorId,
      targetUserId: userId,
      context: { requestId },
    });
  }

  return result;
}

/**
 * Unassign a user from a Request. Sets unassignedAt on the matching
 * Assignment row; idempotent (no-op if already unassigned or no row).
 *
 * Subscription is intentionally NOT cleared — Tier-2 default + brief.
 * Members who unassign keep getting notifications until they explicitly
 * unsubscribe via Follow / Unfollow.
 */
export async function unassign(input: UnassignInput): Promise<Assignment | null> {
  const { requestId, userId, actorId } = input;

  const existing = await prisma.assignment.findUnique({
    where: { requestId_userId: { requestId, userId } },
  });
  if (!existing || existing.unassignedAt !== null) {
    return existing;
  }

  const updated = await prisma.assignment.update({
    where: { id: existing.id },
    data: { unassignedAt: new Date() },
  });

  await auditLog({
    action: 'assignment_unassigned',
    entityType: 'Assignment',
    entityId: updated.id,
    userId: actorId,
    targetUserId: userId,
    context: { requestId },
  });

  return updated;
}

/**
 * List active assignees for a Request, sorted by `assignedAt` (oldest
 * first — visual stability in the avatar row, ADR-0009 + Surface 2).
 * Inactive (unassigned) rows excluded.
 */
export async function listAssigneesForRequest(requestId: string): Promise<AssigneeSummary[]> {
  const rows = await prisma.assignment.findMany({
    where: { requestId, unassignedAt: null },
    orderBy: { assignedAt: 'asc' },
    include: {
      user: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return rows.map((r) => ({
    userId: r.user.id,
    displayName: r.user.displayName,
    avatarUrl: r.user.avatarUrl,
    assignedAt: r.assignedAt,
  }));
}

/**
 * List active Assignments for a user. For the "Assigned to me" filter
 * inside Surface 3 (Notifications) and the future "My work" lens.
 */
export async function listActiveAssignmentsForUser(userId: string): Promise<Assignment[]> {
  return prisma.assignment.findMany({
    where: { userId, unassignedAt: null },
    orderBy: { assignedAt: 'desc' },
  });
}

/**
 * Has this user been assigned to this Request and is currently active?
 * Used by the action-pair component on Surface 2.
 */
export async function isAssigneeActive(requestId: string, userId: string): Promise<boolean> {
  const row = await prisma.assignment.findUnique({
    where: { requestId_userId: { requestId, userId } },
    select: { unassignedAt: true },
  });
  return row !== null && row.unassignedAt === null;
}
