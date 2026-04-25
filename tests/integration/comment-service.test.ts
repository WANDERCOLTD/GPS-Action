/**
 * Integration tests for the comment service.
 *
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052)
 * @spec product/scenarios.md (SCN-20)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      findFirst: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import {
  createComment,
  listCommentsForPost,
  listCommentCountsForPosts,
} from '@/server/services/comment';
import { prisma } from '@/server/db/client';

const mockPostFindFirst = vi.mocked(prisma.post.findFirst);
const mockCommentCreate = vi.mocked(prisma.comment.create);
const mockCommentFindMany = vi.mocked(prisma.comment.findMany);
const mockCommentGroupBy = vi.mocked(prisma.comment.groupBy);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditCreate.mockResolvedValue({} as never);
});

describe('createComment', () => {
  it('writes a row + audit entry when post is visible', async () => {
    mockPostFindFirst.mockResolvedValueOnce({ id: 'p1', visibility: 'public' } as never);
    mockCommentCreate.mockResolvedValueOnce({ id: 'c1' } as never);

    const result = await createComment({
      postId: 'p1',
      body: '  hello world  ',
      authorId: 'user-1',
    });

    expect(result).toEqual({ id: 'c1' });
    expect(mockCommentCreate).toHaveBeenCalledWith({
      data: {
        postId: 'p1',
        authorId: 'user-1',
        body: 'hello world',
      },
      select: { id: true },
    });
    expect(mockAuditCreate).toHaveBeenCalledOnce();
  });

  it('throws when post not found', async () => {
    mockPostFindFirst.mockResolvedValueOnce(null);

    await expect(createComment({ postId: 'p1', body: 'hi', authorId: 'user-1' })).rejects.toThrow(
      'Post not found',
    );
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });
});

describe('listCommentsForPost', () => {
  it('returns oldest-first with isNewMember flag derived from author createdAt', async () => {
    const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

    mockPostFindFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    mockCommentFindMany.mockResolvedValueOnce([
      {
        id: 'c1',
        body: 'first',
        createdAt: new Date('2026-04-25T10:00:00Z'),
        author: {
          id: 'user-1',
          displayName: 'Eddie',
          createdAt: recent,
          roleGrants: [],
        },
      },
      {
        id: 'c2',
        body: 'second',
        createdAt: new Date('2026-04-25T11:00:00Z'),
        author: {
          id: 'user-2',
          displayName: 'Bette',
          createdAt: old,
          roleGrants: [{ role: 'admin' }],
        },
      },
    ] as never);

    const result = await listCommentsForPost({ postId: 'p1', callerId: 'user-1' });

    expect(result).toHaveLength(2);
    expect(result[0]?.author.isNewMember).toBe(true); // 3 days < 14 days
    expect(result[1]?.author.isNewMember).toBe(false); // 30 days
    expect(result[1]?.author.roles).toEqual(['admin']);
  });

  it('returns empty array when post is not visible to caller', async () => {
    mockPostFindFirst.mockResolvedValueOnce(null);

    const result = await listCommentsForPost({ postId: 'p1', callerId: null });

    expect(result).toEqual([]);
    expect(mockCommentFindMany).not.toHaveBeenCalled();
  });

  it('passes a public-only visibility filter for unauthed callers', async () => {
    mockPostFindFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    mockCommentFindMany.mockResolvedValueOnce([] as never);

    await listCommentsForPost({ postId: 'p1', callerId: null });

    const where = mockPostFindFirst.mock.calls[0]![0]!.where;
    expect(where).toMatchObject({ visibility: { equals: 'public' } });
  });
});

describe('listCommentCountsForPosts', () => {
  it('returns 0 for posts with no comments', async () => {
    mockCommentGroupBy.mockResolvedValueOnce([] as never);

    const result = await listCommentCountsForPosts({ postIds: ['p1', 'p2'] });

    expect(result.get('p1')).toBe(0);
    expect(result.get('p2')).toBe(0);
  });

  it('returns counts grouped by postId', async () => {
    mockCommentGroupBy.mockResolvedValueOnce([
      { postId: 'p1', _count: { _all: 5 } },
      { postId: 'p2', _count: { _all: 2 } },
    ] as never);

    const result = await listCommentCountsForPosts({ postIds: ['p1', 'p2', 'p3'] });

    expect(result.get('p1')).toBe(5);
    expect(result.get('p2')).toBe(2);
    expect(result.get('p3')).toBe(0); // not in results — defaults to 0
  });

  it('returns empty Map when no postIds', async () => {
    const result = await listCommentCountsForPosts({ postIds: [] });
    expect(result.size).toBe(0);
    expect(mockCommentGroupBy).not.toHaveBeenCalled();
  });
});
