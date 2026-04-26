/**
 * Unit tests for the comment tRPC router.
 *
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052)
 * @spec architecture/api-contract.md
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
    },
    reaction: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn(),
    },
    featureFlag: {
      findUnique: vi.fn(),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const mockPostFindFirst = vi.mocked(prisma.post.findFirst);
const mockCommentCreate = vi.mocked(prisma.comment.create);
const mockCommentFindMany = vi.mocked(prisma.comment.findMany);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);
const mockFlagFindUnique = vi.mocked(prisma.featureFlag.findUnique);

function authedContext(): TRPCContext {
  return {
    user: {
      id: 'user-1',
      email: 'test@test.com',
      displayName: 'Test User',
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    activeRoles: [],
  };
}

function publicContext(): TRPCContext {
  return { user: null, activeRoles: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditCreate.mockResolvedValue({} as never);
  mockFlagFindUnique.mockResolvedValue({ enabledGlobally: true } as never);
});

describe('comment.add', () => {
  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const caller = createCaller(publicContext());

    await expect(
      caller.comment.add({
        postId: '00000000-0000-0000-0000-000000000001',
        body: 'hello',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects when ff_comments is off (FORBIDDEN)', async () => {
    mockFlagFindUnique.mockResolvedValueOnce({ enabledGlobally: false } as never);
    const caller = createCaller(authedContext());

    await expect(
      caller.comment.add({
        postId: '00000000-0000-0000-0000-000000000001',
        body: 'hello',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects empty body via Zod', async () => {
    const caller = createCaller(authedContext());

    await expect(
      caller.comment.add({
        postId: '00000000-0000-0000-0000-000000000001',
        body: '   ',
      }),
    ).rejects.toThrow();
  });

  it('rejects body over 5000 chars via Zod', async () => {
    const caller = createCaller(authedContext());
    const longBody = 'a'.repeat(5001);

    await expect(
      caller.comment.add({
        postId: '00000000-0000-0000-0000-000000000001',
        body: longBody,
      }),
    ).rejects.toThrow();
  });

  it('rejects malformed postId via Zod', async () => {
    const caller = createCaller(authedContext());

    await expect(caller.comment.add({ postId: 'not-a-uuid', body: 'hello' })).rejects.toThrow();
  });

  it('returns id on a valid call', async () => {
    mockPostFindFirst.mockResolvedValueOnce({ id: 'p1', visibility: 'public' } as never);
    mockCommentCreate.mockResolvedValueOnce({ id: 'c1' } as never);
    const caller = createCaller(authedContext());

    const result = await caller.comment.add({
      postId: '00000000-0000-0000-0000-000000000001',
      body: 'hello',
    });

    expect(result).toEqual({ id: 'c1' });
  });
});

describe('comment.listForPost', () => {
  it('works for unauthenticated callers on public posts', async () => {
    mockPostFindFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    mockCommentFindMany.mockResolvedValueOnce([] as never);
    const caller = createCaller(publicContext());

    const result = await caller.comment.listForPost({
      postId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result).toEqual([]);
  });

  it('returns CommentListItem[] shape correctly', async () => {
    mockPostFindFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    mockCommentFindMany.mockResolvedValueOnce([
      {
        id: 'c1',
        body: 'hello',
        createdAt: new Date('2026-04-25T10:00:00Z'),
        author: {
          id: 'user-1',
          displayName: 'Eddie',
          createdAt: new Date(),
          roleGrants: [],
        },
      },
    ] as never);
    const caller = createCaller(authedContext());

    const result = await caller.comment.listForPost({
      postId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'c1',
      body: 'hello',
      author: { displayName: 'Eddie', isNewMember: true },
    });
  });
});
