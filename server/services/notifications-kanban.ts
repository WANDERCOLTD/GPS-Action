/**
 * @build-unit bu-coordination-board (build seq #2 — notifications-kanban chunk)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0008
 *
 * Kanban-aware notification primitives. Sits alongside the legacy
 * notification.ts service from BU-requests-vetting (D057); doesn't
 * replace it. Surface 3 (Notifications pane) reads from this service;
 * the existing inbox keeps reading the legacy fields.
 *
 * Three jobs (per the session-3 handoff):
 *
 *   1. reasonKind dispatch — emit a notification with both new fields
 *      (lifecycle / reasonKind) and the legacy `type` set to a sane
 *      fallback so backward-compat readers stay correct (per ADR-0008
 *      service-layer dispatch table).
 *   2. Fan-out — to RequestSubscription rows (requests events) and to
 *      GroupMembership rows (team blasts).
 *   3. Lifecycle transitions — acknowledge (click-through) and dismiss
 *      (swipe). Both write `lifecycle` AND `readAt = now()` so legacy
 *      `WHERE readAt IS NULL` queries keep working.
 *
 * Cross-cutting reason rule (ADR-0008 Notes): when a single event
 * matches multiple reasons (e.g. a status transition that also mentions
 * someone), the more specific reason wins — `mention` beats
 * `status_change`. Callers pass the resolved reasonKind; this service
 * doesn't try to infer.
 *
 * Layer boundary: services → db + lib + shared only. May import other
 * services (subscriptions).
 */

import type {
  Notification,
  NotificationLifecycle,
  NotificationReasonKind,
  NotificationType,
} from '@prisma/client';
import { prisma } from '@/server/db/client';
import { listSubscribersForRequest } from '@/server/services/subscriptions';

/**
 * Legacy `type` fallback per `reasonKind`. Per ADR-0008, kanban-era
 * notifications always set `reasonKind`; the legacy `type` column is
 * still required so inbox readers that haven't migrated keep working.
 *
 *   mention      → request_mention      (1:1 — same concept)
 *   everything   → request_status_changed (closest generic fallback)
 *   else
 */
const LEGACY_TYPE_FOR_REASON: Record<NotificationReasonKind, NotificationType> = {
  mention: 'request_mention',
  assignment: 'request_status_changed',
  status_change: 'request_status_changed',
  comment: 'request_status_changed',
  urgent_flip: 'request_status_changed',
  team_blast: 'request_status_changed',
};

export interface KanbanNotificationSummary {
  id: string;
  reasonKind: NotificationReasonKind | null;
  /** Surface 3 falls back to `type` for legacy rows where reasonKind is null. */
  type: NotificationType;
  lifecycle: 'new' | 'acknowledged' | 'dismissed';
  requestId: string | null;
  /** Request title — null when the row has no request context (e.g. team blasts). */
  requestTitle: string | null;
  fromUserId: string | null;
  fromDisplayName: string | null;
  message: string | null;
  createdAt: Date;
  /**
   * URL to open from the row. Resolved via the request's first non-deleted
   * RequestGroup → Group.slug; null when there is no request context or no
   * attached group. The page falls back to `/notifications` when null.
   */
  targetHref: string | null;
}

function mapKanbanRow(
  row: Notification & {
    fromUser: { displayName: string } | null;
    request: { title: string } | null;
  },
  targetHref: string | null,
): KanbanNotificationSummary {
  return {
    id: row.id,
    reasonKind: row.reasonKind,
    type: row.type,
    lifecycle: row.lifecycle,
    requestId: row.requestId,
    requestTitle: row.request?.title ?? null,
    fromUserId: row.fromUserId,
    fromDisplayName: row.fromUser?.displayName ?? null,
    message: row.message,
    createdAt: row.createdAt,
    targetHref,
  };
}

// ─── Emit ────────────────────────────────────────────────────────────────────

export interface EmitKanbanNotificationInput {
  recipientUserId: string;
  reasonKind: NotificationReasonKind;
  requestId?: string | null;
  fromUserId?: string | null;
  message?: string | null;
}

/**
 * Write one Notification row for a single recipient. Sets both
 * `lifecycle = new` (default; explicit for clarity) and `reasonKind`,
 * plus the legacy `type` fallback. Returns the row id only — callers
 * don't typically need the row body.
 */
export async function emitKanbanNotification(
  input: EmitKanbanNotificationInput,
): Promise<{ id: string }> {
  const row = await prisma.notification.create({
    data: {
      recipientUserId: input.recipientUserId,
      type: LEGACY_TYPE_FOR_REASON[input.reasonKind],
      reasonKind: input.reasonKind,
      lifecycle: 'new',
      requestId: input.requestId ?? null,
      fromUserId: input.fromUserId ?? null,
      message: input.message ?? null,
    },
    select: { id: true },
  });
  return row;
}

// ─── Fan-out ─────────────────────────────────────────────────────────────────

export interface FanOutToSubscribersInput {
  requestId: string;
  reasonKind: NotificationReasonKind;
  fromUserId: string;
  message?: string | null;
  /**
   * Recipients to skip — typically the actor (no self-notify) and any
   * recipient already getting a more specific notification (e.g. the
   * mentioned user when a status-change also mentions them).
   */
  excludeUserIds?: ReadonlyArray<string>;
}

/**
 * Fan out a request-related notification to every active subscriber of
 * the Request, minus the exclude list. Uses `listSubscribersForRequest`
 * from #207 for the recipient set.
 *
 * Returns the count of rows written. Idempotent only at the row level
 * (Notification has no uniqueness constraint on (recipient, request,
 * reasonKind) — every emit creates a new row). Callers that need
 * dedup should pass `excludeUserIds`.
 */
export async function fanOutToRequestSubscribers(
  input: FanOutToSubscribersInput,
): Promise<{ count: number }> {
  const subscribers = await listSubscribersForRequest(input.requestId);
  const exclude = new Set(input.excludeUserIds ?? []);
  const recipients = subscribers.map((s) => s.userId).filter((id) => !exclude.has(id));

  if (recipients.length === 0) return { count: 0 };

  const result = await prisma.notification.createMany({
    data: recipients.map((recipientUserId) => ({
      recipientUserId,
      type: LEGACY_TYPE_FOR_REASON[input.reasonKind],
      reasonKind: input.reasonKind,
      lifecycle: 'new' as const,
      requestId: input.requestId,
      fromUserId: input.fromUserId,
      message: input.message ?? null,
    })),
  });
  return { count: result.count };
}

export interface FanOutTeamBlastInput {
  groupId: string;
  fromUserId: string;
  message: string;
  /** Optional Request context for the row's requestId. */
  requestId?: string | null;
  /** Skip the actor (typical) + anyone else (e.g. muted users — caller resolves). */
  excludeUserIds?: ReadonlyArray<string>;
}

/**
 * Fan out a team-blast notification (reasonKind = team_blast) to every
 * active member of the target group, minus the exclude list. Per
 * ADR-0008 Notes, mute-per-flag is a per-user preference handled in
 * account settings — muted users simply don't appear here. Caller
 * resolves the mute list and passes via `excludeUserIds`.
 */
export async function fanOutTeamBlast(input: FanOutTeamBlastInput): Promise<{ count: number }> {
  const memberships = await prisma.groupMembership.findMany({
    where: {
      groupId: input.groupId,
      leftAt: null,
      deletedAt: null,
      group: { deletedAt: null },
    },
    select: { userId: true },
  });

  const exclude = new Set([...(input.excludeUserIds ?? []), input.fromUserId]);
  const recipients = memberships.map((m) => m.userId).filter((id) => !exclude.has(id));

  if (recipients.length === 0) return { count: 0 };

  const result = await prisma.notification.createMany({
    data: recipients.map((recipientUserId) => ({
      recipientUserId,
      type: LEGACY_TYPE_FOR_REASON.team_blast,
      reasonKind: 'team_blast' as const,
      lifecycle: 'new' as const,
      requestId: input.requestId ?? null,
      fromUserId: input.fromUserId,
      message: input.message,
    })),
  });
  return { count: result.count };
}

// ─── Lifecycle transitions ───────────────────────────────────────────────────

export interface LifecycleInput {
  notificationId: string;
  /** Caller (must own the notification — service enforces). */
  userId: string;
}

/**
 * Acknowledge via click-through. Sets `lifecycle = acknowledged` AND
 * `readAt = now()` so legacy queries (`WHERE readAt IS NULL`) keep
 * working through the cutover (ADR-0008 dispatch table).
 *
 * Idempotent: if already acknowledged or dismissed, no-op (returns
 * `{ ok: false }` so the caller can distinguish a real transition).
 */
export async function acknowledgeNotification(input: LifecycleInput): Promise<{ ok: boolean }> {
  const result = await prisma.notification.updateMany({
    where: {
      id: input.notificationId,
      recipientUserId: input.userId,
      lifecycle: 'new',
    },
    data: { lifecycle: 'acknowledged', readAt: new Date() },
  });
  return { ok: result.count > 0 };
}

/**
 * Dismiss via swipe. Sets `lifecycle = dismissed` AND `readAt = now()`
 * (dismiss implies read). Refuses if already dismissed; allows
 * transition from acknowledged → dismissed (member changes their mind).
 */
export async function dismissNotification(input: LifecycleInput): Promise<{ ok: boolean }> {
  const dismissibleFrom: NotificationLifecycle[] = ['new', 'acknowledged'];
  const result = await prisma.notification.updateMany({
    where: {
      id: input.notificationId,
      recipientUserId: input.userId,
      lifecycle: { in: dismissibleFrom },
    },
    data: { lifecycle: 'dismissed', readAt: new Date() },
  });
  return { ok: result.count > 0 };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListKanbanInboxInput {
  userId: string;
  limit?: number;
  /**
   * 'new' = only unacknowledged (Surface 3 default).
   * 'active' = new + acknowledged (excludes dismissed).
   * 'all' = every lifecycle (View All page).
   */
  scope?: 'new' | 'active' | 'all';
}

/**
 * Surface 3's inbox query. Ordered newest-first. Defaults: limit 50,
 * scope 'active' (matches the brief's "tinted = unacknowledged, plain
 * = acknowledged" model — both visible; dismissed are gone).
 */
export async function listKanbanInboxForUser(
  input: ListKanbanInboxInput,
): Promise<KanbanNotificationSummary[]> {
  const scope = input.scope ?? 'active';
  const activeLifecycles: NotificationLifecycle[] = ['new', 'acknowledged'];
  const lifecycleFilter =
    scope === 'new'
      ? { lifecycle: 'new' as const }
      : scope === 'active'
        ? { lifecycle: { in: activeLifecycles } }
        : {};

  const rows = await prisma.notification.findMany({
    where: { recipientUserId: input.userId, ...lifecycleFilter },
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(input.limit ?? 50, 100),
    include: {
      fromUser: { select: { displayName: true } },
      request: { select: { title: true } },
    },
  });

  // Resolve a navigation href for each row carrying a requestId. We pick
  // the request's first non-deleted RequestGroup and route through that
  // group's kanban surface. One batched query covers every row.
  const requestIds = Array.from(
    new Set(rows.map((r) => r.requestId).filter((id): id is string => id !== null)),
  );
  const slugByRequest = new Map<string, string>();
  if (requestIds.length > 0) {
    const links = await prisma.requestGroup.findMany({
      where: { requestId: { in: requestIds }, deletedAt: null },
      select: { requestId: true, group: { select: { slug: true } } },
      orderBy: [{ createdAt: 'asc' }],
    });
    for (const link of links) {
      if (!slugByRequest.has(link.requestId)) {
        slugByRequest.set(link.requestId, link.group.slug);
      }
    }
  }

  return rows.map((row) => {
    const slug = row.requestId ? slugByRequest.get(row.requestId) : undefined;
    const targetHref = slug && row.requestId ? `/board/${slug}/${row.requestId}` : null;
    return mapKanbanRow(row, targetHref);
  });
}

/** Count of `lifecycle = new` rows. Drives the AppNav badge on Surface 3. */
export async function countNewForUser(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientUserId: userId, lifecycle: 'new' },
  });
}
