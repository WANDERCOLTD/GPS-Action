/**
 * @build-unit bu-coordination-board (build seq #2b)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0008 0009
 *
 * Subscription service — RequestSubscription CRUD for the kanban
 * surface. Drives Surface 3 notification fan-out (Tier-2 defaults
 * #4 + #10: author + assignees + ever-mentioned + manually-subscribed).
 *
 * Source rules:
 *   - explicit          — manual Follow gesture (Surface 2 button).
 *                         Wins over any other source on subscribe;
 *                         persists across re-subscribe.
 *   - auto_author       — Request creator is auto-subscribed at
 *                         create time. Set ONCE; doesn't overwrite
 *                         later sources.
 *   - auto_assignee     — set by assignments.ts on self-assign. See
 *                         that service for the assign/unassign flow.
 *   - auto_mention      — set when an @mention is parsed in a kanban
 *                         comment. The mentioned user is subscribed.
 *   - team_blast_optin  — subscriber-driven opt-in to team-wide
 *                         blasts (per ADR-0008 trigger rules).
 *
 * Strength: an explicit gesture is the strongest signal — it wins
 * even over a previously stronger source. Auto-rules respect any
 * existing source (no clobbering). Soft-delete (deletedAt) is the
 * unfollow state; auto-rules undelete on next event so members who
 * unfollow then later @mention or self-assign are re-subscribed
 * (matching the brief's "subscribers definition" rule).
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { RequestSubscription, SubscriptionSource } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';

export interface SubscriberSummary {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  source: SubscriptionSource;
  subscribedAt: Date;
}

export interface SubscribeInput {
  requestId: string;
  userId: string;
  source: SubscriptionSource;
  /** Whoever performed the action (often the same as userId for self). */
  actorId: string;
}

export interface UnsubscribeInput {
  requestId: string;
  userId: string;
  actorId: string;
}

/**
 * Subscribe a user to a Request. Idempotent.
 *
 * Behaviour matrix:
 *   - No row exists       → create with the given source.
 *   - Active row exists   → if source is `explicit`, overwrite the
 *                           existing source label (manual gesture
 *                           wins). Otherwise leave source unchanged
 *                           (auto-rules don't clobber).
 *   - Deleted row exists  → undelete. Source is set to the new
 *                           source, including for auto-rules — the
 *                           previous unfollow is overridden by the
 *                           new event (per brief: subscriber set
 *                           includes "ever-mentioned").
 *
 * Returns the row plus a `created`/`reactivated` discriminator so
 * callers can decide whether to emit downstream side effects (e.g.
 * a notification on first subscribe).
 */
export async function subscribe(
  input: SubscribeInput,
): Promise<{ subscription: RequestSubscription; created: boolean; reactivated: boolean }> {
  const { requestId, userId, source, actorId } = input;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.requestSubscription.findUnique({
      where: { requestId_userId: { requestId, userId } },
    });

    if (!existing) {
      const subscription = await tx.requestSubscription.create({
        data: { requestId, userId, source },
      });
      return { subscription, created: true, reactivated: false };
    }

    if (existing.deletedAt !== null) {
      const subscription = await tx.requestSubscription.update({
        where: { id: existing.id },
        data: { deletedAt: null, source },
      });
      return { subscription, created: false, reactivated: true };
    }

    // Active row — explicit gesture overwrites source; auto-rules
    // leave it alone.
    if (source === 'explicit' && existing.source !== 'explicit') {
      const subscription = await tx.requestSubscription.update({
        where: { id: existing.id },
        data: { source: 'explicit' },
      });
      return { subscription, created: false, reactivated: false };
    }

    return { subscription: existing, created: false, reactivated: false };
  });

  if (result.created || result.reactivated) {
    await auditLog({
      action: result.reactivated ? 'subscription_reactivated' : 'subscription_created',
      entityType: 'RequestSubscription',
      entityId: result.subscription.id,
      userId: actorId,
      targetUserId: userId,
      context: { requestId, source },
    });
  }

  return result;
}

/**
 * Unsubscribe a user from a Request. Soft-deletes the row.
 * Idempotent — no-op if already deleted or no row exists.
 *
 * Audited as `subscription_unsubscribed`. Distinct from a hard
 * delete (which would lose the audit trail of the user's
 * subscription history).
 */
export async function unsubscribe(input: UnsubscribeInput): Promise<RequestSubscription | null> {
  const { requestId, userId, actorId } = input;

  const existing = await prisma.requestSubscription.findUnique({
    where: { requestId_userId: { requestId, userId } },
  });
  if (!existing || existing.deletedAt !== null) {
    return existing;
  }

  const updated = await prisma.requestSubscription.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  await auditLog({
    action: 'subscription_unsubscribed',
    entityType: 'RequestSubscription',
    entityId: updated.id,
    userId: actorId,
    targetUserId: userId,
    context: { requestId },
  });

  return updated;
}

/**
 * Is this user actively subscribed to this Request? Used by
 * Surface 2's Follow/Unfollow toggle to render initial state.
 */
export async function isSubscribed(requestId: string, userId: string): Promise<boolean> {
  const row = await prisma.requestSubscription.findUnique({
    where: { requestId_userId: { requestId, userId } },
    select: { deletedAt: true },
  });
  return row !== null && row.deletedAt === null;
}

/**
 * List active subscribers for a Request. Used by Surface 2's
 * subscribers list (read-only +N overflow).
 *
 * Sorted by `createdAt` (oldest first) for visual stability — the
 * author shows first when they're auto-subscribed at create time.
 */
export async function listSubscribersForRequest(requestId: string): Promise<SubscriberSummary[]> {
  const rows = await prisma.requestSubscription.findMany({
    where: { requestId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
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
    source: r.source,
    subscribedAt: r.createdAt,
  }));
}

/**
 * List active subscriptions for a user. Drives the "Subscribed-to"
 * lens in Surface 3's notifications and the future "My subscriptions"
 * setting page.
 */
export async function listActiveSubscriptionsForUser(
  userId: string,
): Promise<RequestSubscription[]> {
  return prisma.requestSubscription.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Count active subscribers per Request. Used by board cards / ticket
 * detail to show "+N subscribers" without loading every row.
 */
export async function countActiveSubscribers(requestId: string): Promise<number> {
  return prisma.requestSubscription.count({
    where: { requestId, deletedAt: null },
  });
}
