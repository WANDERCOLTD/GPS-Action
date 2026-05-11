/**
 * Integration tests for the reaction service.
 *
 * @build-unit BU-reactions
 * @spec architecture/decision-log.md (D050)
 * @spec product/scenarios.md (SCN-3)
 *
 * Tests addReaction / removeReaction / listReactionsForPost(s) with
 * prisma mocked at the boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/server/db/client', () => ({
  prisma: {
    reaction: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    networkCardState: {
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import {
  addReaction,
  removeReaction,
  listReactionsForPost,
  listReactionsForPosts,
  addReactionToComment,
  removeReactionFromComment,
  listReactionsForComment,
  listReactionsForComments,
  addReactionToNetworkCard,
  removeReactionFromNetworkCard,
  listReactionsForNetworkCard,
  listReactionsForNetworkCards,
} from '@/server/services/reaction';
import { prisma } from '@/server/db/client';

const mockReactionCreate = vi.mocked(prisma.reaction.create);
const mockReactionDeleteMany = vi.mocked(prisma.reaction.deleteMany);
const mockReactionGroupBy = vi.mocked(prisma.reaction.groupBy);
const mockReactionFindMany = vi.mocked(prisma.reaction.findMany);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);
const mockNetworkCardStateUpsert = vi.mocked(prisma.networkCardState.upsert);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditCreate.mockResolvedValue({} as never);
  mockNetworkCardStateUpsert.mockResolvedValue({} as never);
});

describe('addReaction', () => {
  it('creates a reaction row and writes an audit entry', async () => {
    mockReactionCreate.mockResolvedValueOnce({} as never);

    const result = await addReaction({
      postId: '00000000-0000-4000-8000-000000000001',
      emoji: 'candle',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockReactionCreate).toHaveBeenCalledOnce();
    expect(mockReactionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        targetType: 'post',
        targetId: '00000000-0000-4000-8000-000000000001',
        postId: '00000000-0000-4000-8000-000000000001',
        emoji: 'candle',
      },
    });
    expect(mockAuditCreate).toHaveBeenCalledOnce();
  });

  it('is idempotent on unique-constraint violation', async () => {
    mockReactionCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.x',
      }),
    );

    const result = await addReaction({
      postId: '00000000-0000-4000-8000-000000000001',
      emoji: 'pray',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('rethrows non-P2002 errors', async () => {
    mockReactionCreate.mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      addReaction({
        postId: '00000000-0000-4000-8000-000000000001',
        emoji: 'heart',
        userId: 'user-1',
      }),
    ).rejects.toThrow('connection lost');
  });
});

describe('removeReaction', () => {
  it('deletes the matching row and writes audit when count > 0', async () => {
    mockReactionDeleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await removeReaction({
      postId: '00000000-0000-4000-8000-000000000001',
      emoji: 'candle',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockReactionDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        targetType: 'post',
        targetId: '00000000-0000-4000-8000-000000000001',
        emoji: 'candle',
      },
    });
    expect(mockAuditCreate).toHaveBeenCalledOnce();
  });

  it('is idempotent — returns success and writes no audit when nothing deleted', async () => {
    mockReactionDeleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await removeReaction({
      postId: '00000000-0000-4000-8000-000000000001',
      emoji: 'sad',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});

describe('listReactionsForPost', () => {
  it('aggregates by emoji and marks mine for the caller', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([
      { emoji: 'candle', _count: { _all: 3 } },
      { emoji: 'pray', _count: { _all: 1 } },
    ] as never);
    mockReactionFindMany.mockResolvedValueOnce([{ emoji: 'candle' }] as never);

    const result = await listReactionsForPost({
      postId: '00000000-0000-4000-8000-000000000001',
      callerId: 'user-1',
    });

    expect(result).toEqual([
      { emoji: 'candle', count: 3, mine: true },
      { emoji: 'pray', count: 1, mine: false },
    ]);
  });

  it('returns mine: false for unauthenticated callers', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([{ emoji: 'heart', _count: { _all: 2 } }] as never);

    const result = await listReactionsForPost({
      postId: '00000000-0000-4000-8000-000000000001',
      callerId: null,
    });

    expect(result).toEqual([{ emoji: 'heart', count: 2, mine: false }]);
    expect(mockReactionFindMany).not.toHaveBeenCalled();
  });

  it('sorts by count desc, then enum order', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([
      { emoji: 'sad', _count: { _all: 2 } },
      { emoji: 'candle', _count: { _all: 5 } },
      { emoji: 'pray', _count: { _all: 2 } },
    ] as never);

    const result = await listReactionsForPost({
      postId: '00000000-0000-4000-8000-000000000001',
      callerId: null,
    });

    // candle (5) first, then pray (2 — earlier in enum) before sad (2 — later)
    expect(result.map((r) => r.emoji)).toEqual(['candle', 'pray', 'sad']);
  });
});

describe('listReactionsForPosts (bulk)', () => {
  it('returns empty Map when no postIds', async () => {
    const result = await listReactionsForPosts({ postIds: [], callerId: null });
    expect(result.size).toBe(0);
    expect(mockReactionGroupBy).not.toHaveBeenCalled();
  });

  it('returns empty arrays for posts with no reactions', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([] as never);

    const result = await listReactionsForPosts({
      postIds: ['p1', 'p2'],
      callerId: null,
    });

    expect(result.get('p1')).toEqual([]);
    expect(result.get('p2')).toEqual([]);
  });

  it('groups reactions by post and marks mine correctly', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([
      { targetId: 'p1', emoji: 'candle', _count: { _all: 2 } },
      { targetId: 'p1', emoji: 'pray', _count: { _all: 1 } },
      { targetId: 'p2', emoji: 'heart', _count: { _all: 1 } },
    ] as never);
    mockReactionFindMany.mockResolvedValueOnce([
      { targetId: 'p1', emoji: 'candle' },
      { targetId: 'p2', emoji: 'heart' },
    ] as never);

    const result = await listReactionsForPosts({
      postIds: ['p1', 'p2'],
      callerId: 'user-1',
    });

    expect(result.get('p1')).toEqual([
      { emoji: 'candle', count: 2, mine: true },
      { emoji: 'pray', count: 1, mine: false },
    ]);
    expect(result.get('p2')).toEqual([{ emoji: 'heart', count: 1, mine: true }]);
  });
});

describe('addReactionToComment', () => {
  it('creates a reaction row with targetType=comment and writes audit', async () => {
    mockReactionCreate.mockResolvedValueOnce({} as never);

    const result = await addReactionToComment({
      commentId: '00000000-0000-4000-8000-00000000000c',
      emoji: 'heart',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockReactionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        targetType: 'comment',
        targetId: '00000000-0000-4000-8000-00000000000c',
        commentId: '00000000-0000-4000-8000-00000000000c',
        emoji: 'heart',
      },
    });
    expect(mockAuditCreate).toHaveBeenCalledOnce();
  });

  it('is idempotent on unique-constraint violation', async () => {
    mockReactionCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.x',
      }),
    );

    const result = await addReactionToComment({
      commentId: '00000000-0000-4000-8000-00000000000c',
      emoji: 'heart',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});

describe('removeReactionFromComment', () => {
  it('deletes the matching row when present', async () => {
    mockReactionDeleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await removeReactionFromComment({
      commentId: '00000000-0000-4000-8000-00000000000c',
      emoji: 'heart',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockReactionDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        targetType: 'comment',
        targetId: '00000000-0000-4000-8000-00000000000c',
        emoji: 'heart',
      },
    });
    expect(mockAuditCreate).toHaveBeenCalledOnce();
  });

  it('is idempotent when nothing to delete', async () => {
    mockReactionDeleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await removeReactionFromComment({
      commentId: '00000000-0000-4000-8000-00000000000c',
      emoji: 'heart',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});

describe('listReactionsForComment', () => {
  it('aggregates by emoji with mine for the caller', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([{ emoji: 'heart', _count: { _all: 2 } }] as never);
    mockReactionFindMany.mockResolvedValueOnce([{ emoji: 'heart' }] as never);

    const result = await listReactionsForComment({
      commentId: '00000000-0000-4000-8000-00000000000c',
      callerId: 'user-1',
    });

    expect(result).toEqual([{ emoji: 'heart', count: 2, mine: true }]);
  });
});

describe('listReactionsForComments (bulk)', () => {
  it('returns empty Map for empty input', async () => {
    const result = await listReactionsForComments({ commentIds: [], callerId: null });
    expect(result.size).toBe(0);
  });

  it('groups reactions by commentId', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([
      { targetId: 'c1', emoji: 'heart', _count: { _all: 3 } },
      { targetId: 'c2', emoji: 'pray', _count: { _all: 1 } },
    ] as never);

    const result = await listReactionsForComments({
      commentIds: ['c1', 'c2', 'c3'],
      callerId: null,
    });

    expect(result.get('c1')).toEqual([{ emoji: 'heart', count: 3, mine: false }]);
    expect(result.get('c2')).toEqual([{ emoji: 'pray', count: 1, mine: false }]);
    expect(result.get('c3')).toEqual([]);
  });
});

// ── BU-network-reactions ─────────────────────────────────────────────────

describe('addReactionToNetworkCard', () => {
  it('upserts a NetworkCardState row, creates a reaction with networkCardStateId, and writes audit', async () => {
    mockReactionCreate.mockResolvedValueOnce({} as never);

    const result = await addReactionToNetworkCard({
      messageId: '42',
      emoji: 'heart',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    // The state row must be ensured before the reaction is created so
    // the FK has a parent.
    expect(mockNetworkCardStateUpsert).toHaveBeenCalledWith({
      where: { messageId: 42n },
      create: { messageId: 42n, status: 'NEW' },
      update: {},
      select: { id: true },
    });
    expect(mockReactionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        targetType: 'network_card',
        targetId: '42',
        networkCardStateId: 42n,
        emoji: 'heart',
      },
    });
    expect(mockAuditCreate).toHaveBeenCalledOnce();
    const auditArg = mockAuditCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(auditArg.data.entityType).toBe('networkCardState');
    expect(auditArg.data.entityId).toBe('42');
  });

  it('is idempotent on unique-constraint violation', async () => {
    mockReactionCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.x',
      }),
    );

    const result = await addReactionToNetworkCard({
      messageId: '42',
      emoji: 'heart',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('rethrows non-P2002 errors and still leaves the upsert as best-effort', async () => {
    mockReactionCreate.mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      addReactionToNetworkCard({
        messageId: '42',
        emoji: 'heart',
        userId: 'user-1',
      }),
    ).rejects.toThrow('connection lost');
  });

  it('handles large bigint messageIds without precision loss', async () => {
    mockReactionCreate.mockResolvedValueOnce({} as never);
    const big = '9007199254740993'; // > Number.MAX_SAFE_INTEGER

    await addReactionToNetworkCard({
      messageId: big,
      emoji: 'pray',
      userId: 'user-1',
    });

    expect(mockReactionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        targetType: 'network_card',
        targetId: big,
        networkCardStateId: BigInt(big),
        emoji: 'pray',
      },
    });
  });
});

describe('removeReactionFromNetworkCard', () => {
  it('deletes the matching reaction and writes audit', async () => {
    mockReactionDeleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await removeReactionFromNetworkCard({
      messageId: '42',
      emoji: 'heart',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockReactionDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        targetType: 'network_card',
        targetId: '42',
        emoji: 'heart',
      },
    });
    expect(mockAuditCreate).toHaveBeenCalledOnce();
    const auditArg = mockAuditCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(auditArg.data.entityType).toBe('networkCardState');
  });

  it('is idempotent when nothing was deleted', async () => {
    mockReactionDeleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await removeReactionFromNetworkCard({
      messageId: '42',
      emoji: 'heart',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});

describe('listReactionsForNetworkCard', () => {
  it('aggregates by emoji with mine for the caller', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([
      { emoji: 'heart', _count: { _all: 4 } },
      { emoji: 'pray', _count: { _all: 1 } },
    ] as never);
    mockReactionFindMany.mockResolvedValueOnce([{ emoji: 'pray' }] as never);

    const result = await listReactionsForNetworkCard({
      messageId: '42',
      callerId: 'user-1',
    });

    expect(result).toEqual([
      { emoji: 'heart', count: 4, mine: false },
      { emoji: 'pray', count: 1, mine: true },
    ]);
  });

  it('returns mine: false for unauthenticated callers without hitting findMany', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([{ emoji: 'heart', _count: { _all: 2 } }] as never);

    const result = await listReactionsForNetworkCard({
      messageId: '42',
      callerId: null,
    });

    expect(result).toEqual([{ emoji: 'heart', count: 2, mine: false }]);
    expect(mockReactionFindMany).not.toHaveBeenCalled();
  });
});

describe('listReactionsForNetworkCards (bulk)', () => {
  it('returns empty Map for empty input', async () => {
    const result = await listReactionsForNetworkCards({ messageIds: [], callerId: null });
    expect(result.size).toBe(0);
    expect(mockReactionGroupBy).not.toHaveBeenCalled();
  });

  it('groups reactions by messageId and tags mine for the caller', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([
      { targetId: '42', emoji: 'heart', _count: { _all: 2 } },
      { targetId: '42', emoji: 'pray', _count: { _all: 1 } },
      { targetId: '43', emoji: 'sad', _count: { _all: 3 } },
    ] as never);
    mockReactionFindMany.mockResolvedValueOnce([
      { targetId: '42', emoji: 'heart' },
      { targetId: '43', emoji: 'sad' },
    ] as never);

    const result = await listReactionsForNetworkCards({
      messageIds: ['42', '43', '44'],
      callerId: 'user-1',
    });

    expect(result.get('42')).toEqual([
      { emoji: 'heart', count: 2, mine: true },
      { emoji: 'pray', count: 1, mine: false },
    ]);
    expect(result.get('43')).toEqual([{ emoji: 'sad', count: 3, mine: true }]);
    // Cards with zero reactions still get an empty array entry.
    expect(result.get('44')).toEqual([]);
  });
});
