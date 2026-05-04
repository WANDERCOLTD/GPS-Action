/**
 * Integration tests for the notifications-kanban service
 * (bu-coordination-board / ADR-0008). Mocks the Prisma client + the
 * subscriptions service. Asserts:
 *
 * - emitKanbanNotification:
 *   - writes lifecycle=new + reasonKind + legacy `type` fallback.
 *   - 'mention' maps to legacy type 'request_mention'; everything else
 *     maps to 'request_status_changed'.
 * - fanOutToRequestSubscribers:
 *   - reads subscribers from the subscriptions service.
 *   - excludes excludeUserIds (typically the actor).
 *   - returns count = 0 when no recipients (no createMany call).
 *   - createMany is called once with the right rows.
 * - fanOutTeamBlast:
 *   - reads active GroupMembership rows.
 *   - actor is auto-excluded even when not in excludeUserIds.
 *   - excludeUserIds (mute list) further trims the recipient set.
 * - acknowledgeNotification:
 *   - only transitions 'new' rows; sets lifecycle + readAt.
 *   - returns ok=true on real transition, false on no-op.
 * - dismissNotification:
 *   - allows transition from 'new' OR 'acknowledged'.
 *   - sets lifecycle=dismissed + readAt.
 * - listKanbanInboxForUser:
 *   - default scope = 'active' (filters out dismissed).
 *   - scope='new' filters lifecycle=new.
 *   - scope='all' applies no lifecycle filter.
 *   - limit clamps to 100.
 * - countNewForUser counts only lifecycle=new rows for the user.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    groupMembership: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/subscriptions', () => ({
  listSubscribersForRequest: vi.fn(),
}));

import {
  emitKanbanNotification,
  fanOutToRequestSubscribers,
  fanOutTeamBlast,
  acknowledgeNotification,
  dismissNotification,
  listKanbanInboxForUser,
  countNewForUser,
} from '@/server/services/notifications-kanban';
import { prisma } from '@/server/db/client';
import { listSubscribersForRequest } from '@/server/services/subscriptions';

const mockedNotification = vi.mocked(prisma.notification);
const mockedMembership = vi.mocked(prisma.groupMembership);
const mockedSubs = vi.mocked(listSubscribersForRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('emitKanbanNotification — reasonKind dispatch', () => {
  it("'mention' maps to legacy type 'request_mention'", async () => {
    mockedNotification.create.mockResolvedValue({ id: 'n1' } as never);

    await emitKanbanNotification({
      recipientUserId: 'u1',
      reasonKind: 'mention',
      requestId: 'r1',
      fromUserId: 'u2',
      message: '@u1',
    });

    expect(mockedNotification.create).toHaveBeenCalledWith({
      data: {
        recipientUserId: 'u1',
        type: 'request_mention',
        reasonKind: 'mention',
        lifecycle: 'new',
        requestId: 'r1',
        fromUserId: 'u2',
        message: '@u1',
      },
      select: { id: true },
    });
  });

  it.each([['assignment'], ['status_change'], ['comment'], ['urgent_flip'], ['team_blast']])(
    "'%s' maps to legacy type 'request_status_changed'",
    async (reason) => {
      mockedNotification.create.mockResolvedValue({ id: 'nx' } as never);

      await emitKanbanNotification({
        recipientUserId: 'u1',
        reasonKind: reason as never,
      });

      expect(mockedNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'request_status_changed',
          reasonKind: reason,
          lifecycle: 'new',
        }),
        select: { id: true },
      });
    },
  );
});

describe('fanOutToRequestSubscribers', () => {
  it('writes one row per subscriber, excluding excludeUserIds', async () => {
    mockedSubs.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }] as never);
    mockedNotification.createMany.mockResolvedValue({ count: 2 });

    const result = await fanOutToRequestSubscribers({
      requestId: 'r1',
      reasonKind: 'comment',
      fromUserId: 'u2',
      message: 'new comment',
      excludeUserIds: ['u2'],
    });

    expect(result.count).toBe(2);
    expect(mockedSubs).toHaveBeenCalledWith('r1');
    expect(mockedNotification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ recipientUserId: 'u1', reasonKind: 'comment' }),
        expect.objectContaining({ recipientUserId: 'u3', reasonKind: 'comment' }),
      ],
    });
  });

  it('skips createMany when no recipients remain', async () => {
    mockedSubs.mockResolvedValue([{ userId: 'u1' }] as never);

    const result = await fanOutToRequestSubscribers({
      requestId: 'r1',
      reasonKind: 'status_change',
      fromUserId: 'u1',
      excludeUserIds: ['u1'],
    });

    expect(result.count).toBe(0);
    expect(mockedNotification.createMany).not.toHaveBeenCalled();
  });
});

describe('fanOutTeamBlast', () => {
  it('queries active members of the group + auto-excludes the actor', async () => {
    mockedMembership.findMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' },
    ] as never);
    mockedNotification.createMany.mockResolvedValue({ count: 2 });

    const result = await fanOutTeamBlast({
      groupId: 'g1',
      fromUserId: 'u2',
      message: 'team-wide announcement',
    });

    expect(result.count).toBe(2);
    expect(mockedMembership.findMany).toHaveBeenCalledWith({
      where: {
        groupId: 'g1',
        leftAt: null,
        deletedAt: null,
        group: { deletedAt: null },
      },
      select: { userId: true },
    });
    // u2 (actor) skipped automatically.
    expect(mockedNotification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ recipientUserId: 'u1', reasonKind: 'team_blast' }),
        expect.objectContaining({ recipientUserId: 'u3', reasonKind: 'team_blast' }),
      ],
    });
  });

  it('excludeUserIds (mute list) further trims the recipient set', async () => {
    mockedMembership.findMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' },
    ] as never);
    mockedNotification.createMany.mockResolvedValue({ count: 1 });

    await fanOutTeamBlast({
      groupId: 'g1',
      fromUserId: 'u2',
      message: 'announce',
      excludeUserIds: ['u3'], // muted
    });

    expect(mockedNotification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ recipientUserId: 'u1' })],
    });
  });

  it('returns count=0 when membership is empty', async () => {
    mockedMembership.findMany.mockResolvedValue([]);

    const result = await fanOutTeamBlast({
      groupId: 'g1',
      fromUserId: 'u1',
      message: 'silent',
    });

    expect(result.count).toBe(0);
    expect(mockedNotification.createMany).not.toHaveBeenCalled();
  });
});

describe('acknowledgeNotification', () => {
  it('transitions only "new" rows to acknowledged + sets readAt', async () => {
    mockedNotification.updateMany.mockResolvedValue({ count: 1 });

    const result = await acknowledgeNotification({
      notificationId: 'n1',
      userId: 'u1',
    });

    expect(result.ok).toBe(true);
    expect(mockedNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', recipientUserId: 'u1', lifecycle: 'new' },
      data: { lifecycle: 'acknowledged', readAt: expect.any(Date) },
    });
  });

  it('returns ok=false when row is already acknowledged or dismissed', async () => {
    mockedNotification.updateMany.mockResolvedValue({ count: 0 });

    const result = await acknowledgeNotification({
      notificationId: 'n1',
      userId: 'u1',
    });

    expect(result.ok).toBe(false);
  });
});

describe('dismissNotification', () => {
  it('allows transition from new OR acknowledged → dismissed', async () => {
    mockedNotification.updateMany.mockResolvedValue({ count: 1 });

    await dismissNotification({ notificationId: 'n1', userId: 'u1' });

    expect(mockedNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'n1',
        recipientUserId: 'u1',
        lifecycle: { in: ['new', 'acknowledged'] },
      },
      data: { lifecycle: 'dismissed', readAt: expect.any(Date) },
    });
  });
});

describe('listKanbanInboxForUser', () => {
  beforeEach(() => {
    mockedNotification.findMany.mockResolvedValue([] as never);
  });

  it("default scope is 'active' — filters new + acknowledged, excludes dismissed", async () => {
    await listKanbanInboxForUser({ userId: 'u1' });

    expect(mockedNotification.findMany).toHaveBeenCalledWith({
      where: {
        recipientUserId: 'u1',
        lifecycle: { in: ['new', 'acknowledged'] },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
      include: { fromUser: { select: { displayName: true } } },
    });
  });

  it("scope='new' filters lifecycle=new only", async () => {
    await listKanbanInboxForUser({ userId: 'u1', scope: 'new' });

    expect(mockedNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientUserId: 'u1', lifecycle: 'new' },
      }),
    );
  });

  it("scope='all' applies no lifecycle filter", async () => {
    await listKanbanInboxForUser({ userId: 'u1', scope: 'all' });

    expect(mockedNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientUserId: 'u1' },
      }),
    );
  });

  it('limit clamps to 100', async () => {
    await listKanbanInboxForUser({ userId: 'u1', limit: 500 });

    expect(mockedNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});

describe('countNewForUser', () => {
  it('counts only lifecycle=new rows for the user', async () => {
    mockedNotification.count.mockResolvedValue(7);

    const result = await countNewForUser('u1');

    expect(result).toBe(7);
    expect(mockedNotification.count).toHaveBeenCalledWith({
      where: { recipientUserId: 'u1', lifecycle: 'new' },
    });
  });
});
