/**
 * @build-unit BU-requests-vetting
 * @spec architecture/decision-log.md (D057)
 *
 * Notification service — write/read/mark-read the Notification entity.
 *
 * Emit paths:
 *   - @mention parser detects a mention in a Request comment
 *   - request.resolveRequest writes one for the submitter on resolve
 *   - request.claimRequest writes one for the submitter on claim
 *   - (D063 future) Send-for-Review publish/archive write one for the submitter
 *
 * Read surface: Notifications appear inside the Requests tab (Option B
 * from D057). MVP polling cadence — no real-time delivery.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { Notification, NotificationType } from '@prisma/client';
import { prisma } from '@/server/db/client';

export interface NotificationSummary {
  id: string;
  type: NotificationType;
  requestId: string | null;
  fromUserId: string | null;
  fromDisplayName: string | null;
  message: string | null;
  createdAt: Date;
  readAt: Date | null;
}

type NotificationWithFrom = Notification & {
  fromUser: { displayName: string } | null;
};

function mapNotification(row: NotificationWithFrom): NotificationSummary {
  return {
    id: row.id,
    type: row.type,
    requestId: row.requestId,
    fromUserId: row.fromUserId,
    fromDisplayName: row.fromUser?.displayName ?? null,
    message: row.message,
    createdAt: row.createdAt,
    readAt: row.readAt,
  };
}

export interface CreateNotificationInput {
  recipientUserId: string;
  type: NotificationType;
  requestId?: string | null;
  fromUserId?: string | null;
  message?: string | null;
}

export async function createNotification(input: CreateNotificationInput): Promise<{ id: string }> {
  const row = await prisma.notification.create({
    data: {
      recipientUserId: input.recipientUserId,
      type: input.type,
      requestId: input.requestId ?? null,
      fromUserId: input.fromUserId ?? null,
      message: input.message ?? null,
    },
    select: { id: true },
  });
  return row;
}

/** Recent notifications for a user, newest first. Defaults to 50. */
export async function listNotificationsForUser(input: {
  userId: string;
  limit?: number;
  unreadOnly?: boolean;
}): Promise<NotificationSummary[]> {
  const rows = await prisma.notification.findMany({
    where: {
      recipientUserId: input.userId,
      ...(input.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(input.limit ?? 50, 100),
    include: { fromUser: { select: { displayName: true } } },
  });
  return rows.map(mapNotification);
}

/** Count unread for a user. Used by the AppNav dot. */
export async function countUnreadForUser(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientUserId: userId, readAt: null },
  });
}

/** Mark a single notification read. Caller must own it. */
export async function markNotificationRead(input: {
  notificationId: string;
  userId: string;
}): Promise<{ ok: boolean }> {
  const result = await prisma.notification.updateMany({
    where: { id: input.notificationId, recipientUserId: input.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: result.count > 0 };
}

/** Mark all unread notifications for a user as read. Used when opening the Requests tab. */
export async function markAllReadForUser(userId: string): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: { recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { count: result.count };
}

/** Mark all notifications for a user related to a specific Request as read. */
export async function markReadForRequest(input: {
  userId: string;
  requestId: string;
}): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      recipientUserId: input.userId,
      requestId: input.requestId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return { count: result.count };
}
