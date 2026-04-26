/**
 * Unit tests for the post service layer.
 *
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 *
 * Tests listPosts filtering logic: visibility, deletedAt, cursor
 * pagination, and author role inclusion. Mocks prisma.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
    },
    reaction: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    comment: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { listPosts } from '@/server/services/post';
import { prisma } from '@/server/db/client';

const mockFindMany = vi.mocked(prisma.post.findMany);

// ── Helpers ──────────────────────────────────────────────────────────────

function makePost(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'post-1',
    authorId: 'user-1',
    title: 'Test post',
    body: 'Test body',
    visibility: 'public' as const,
    activistMailerUrl: null,
    linkUrl: null,
    linkTitle: null,
    linkDescription: null,
    linkImageUrl: null,
    linkSiteName: null,
    groupTags: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    author: {
      id: 'user-1',
      displayName: 'Test User',
      roleGrants: [],
    },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listPosts', () => {
  it('returns posts in mapped format', async () => {
    const post = makePost();
    mockFindMany.mockResolvedValueOnce([post] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const result = await listPosts({ callerId: 'user-1' });

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toEqual({
      id: 'post-1',
      title: 'Test post',
      body: 'Test body',
      visibility: 'public',
      activistMailerUrl: null,
      linkUrl: null,
      linkTitle: null,
      linkDescription: null,
      linkImageUrl: null,
      linkSiteName: null,
      groupTags: [],
      createdAt: post.createdAt,
      author: {
        id: 'user-1',
        displayName: 'Test User',
        roles: [],
      },
      reactions: [],
      commentCount: 0,
    });
  });

  it('filters to public-only for unauthenticated callers', async () => {
    mockFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    await listPosts({ callerId: null });

    const call = mockFindMany.mock.calls[0]!;
    const where = call[0]?.where;
    expect(where).toMatchObject({
      visibility: { in: ['public'] },
      deletedAt: null,
    });
  });

  it('includes authenticated_only for authenticated callers', async () => {
    mockFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    await listPosts({ callerId: 'user-1' });

    const call = mockFindMany.mock.calls[0]!;
    const where = call[0]?.where;
    expect(where).toMatchObject({
      visibility: { in: ['public', 'authenticated_only'] },
      deletedAt: null,
    });
  });

  it('always excludes soft-deleted posts', async () => {
    mockFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    await listPosts({ callerId: 'user-1' });

    const call = mockFindMany.mock.calls[0]!;
    const where = call[0]?.where;
    expect(where?.deletedAt).toBeNull();
  });

  it('returns nextCursor when more posts exist', async () => {
    // Simulate limit+1 posts returned (hasMore = true)
    // Default limit is 20, so return 21 posts
    const posts = Array.from({ length: 21 }, (_, i) =>
      makePost({
        id: `post-${i}`,
        createdAt: new Date(Date.now() - i * 60000),
      }),
    );
    mockFindMany.mockResolvedValueOnce(posts as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const result = await listPosts({ callerId: 'user-1' });

    expect(result.posts).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
    expect(result.nextCursor?.id).toBe('post-19');
  });

  it('returns null nextCursor when no more posts', async () => {
    const posts = [makePost()];
    mockFindMany.mockResolvedValueOnce(posts as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const result = await listPosts({ callerId: 'user-1' });

    expect(result.posts).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('returns empty result when no posts exist', async () => {
    mockFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const result = await listPosts({ callerId: 'user-1' });

    expect(result.posts).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('includes cursor filter when cursor provided', async () => {
    mockFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const cursor = { createdAt: new Date('2026-04-10T10:00:00Z'), id: 'post-5' };
    await listPosts({ callerId: 'user-1', cursor });

    const call = mockFindMany.mock.calls[0]!;
    const where = call[0]?.where;
    expect(where?.OR).toEqual([
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: { equals: cursor.createdAt }, id: { lt: cursor.id } },
    ]);
  });

  it('caps limit at MAX_LIMIT (50)', async () => {
    mockFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    await listPosts({ callerId: 'user-1', limit: 100 });

    const call = mockFindMany.mock.calls[0]!;
    expect(call[0]?.take).toBe(51); // 50 + 1 for hasMore check
  });

  it('maps author roleGrants to roles array', async () => {
    const post = makePost({
      author: {
        id: 'user-admin',
        displayName: 'Admin User',
        roleGrants: [{ role: 'admin' }, { role: 'queue_manager' }],
      },
    });
    mockFindMany.mockResolvedValueOnce([post] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const result = await listPosts({ callerId: 'user-1' });

    expect(result.posts[0]?.author.roles).toEqual(['admin', 'queue_manager']);
  });

  it('orders by createdAt desc then id desc', async () => {
    mockFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    await listPosts({ callerId: 'user-1' });

    const call = mockFindMany.mock.calls[0]!;
    expect(call[0]?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });
});
