/**
 * Integration tests for the post.list tRPC procedure.
 *
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D045)
 *
 * Tests the router → service → prisma chain via createCaller.
 * Mocks prisma at the DB boundary (same pattern as auth-stub.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    roleGrant: {
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

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const mockPostFindMany = vi.mocked(prisma.post.findMany);

// ── Helpers ──────────────────────────────────────────────────────────────

function authedContext(): TRPCContext {
  return {
    user: {
      id: 'user-1',
      email: 'test@test.com',
      displayName: 'Test User',
      avatarUrl: null,
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    activeRoles: [],
    activeScopes: [],
  };
}

function anonContext(): TRPCContext {
  return { user: null, activeRoles: [], activeScopes: [] };
}

function makeDbPost(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'post-1',
    authorId: 'user-1',
    title: 'Test post',
    body: 'Test body content',
    visibility: 'public' as const,
    activistMailerUrl: null,
    linkUrl: null,
    linkTitle: null,
    linkDescription: null,
    linkImageUrl: null,
    linkSiteName: null,
    isActivistMailer: false,
    kindId: null,
    urgency: false,
    heroImageUrl: null,
    signal: null,
    sharedToNetworkAt: null,
    status: 'published' as const,
    publishedAt: now,
    reviewRequestId: null,
    reviewedByUserId: null,
    groupTags: [],
    eventAt: null,
    eventEndsAt: null,
    locationText: null,
    latitude: null,
    longitude: null,
    isOnline: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    author: {
      id: 'user-1',
      displayName: 'Test Author',
      roleGrants: [],
    },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('post.list', () => {
  it('returns posts in correct order for authenticated caller', async () => {
    const post1 = makeDbPost({ id: 'post-1', createdAt: new Date('2026-04-20T10:00:00Z') });
    const post2 = makeDbPost({ id: 'post-2', createdAt: new Date('2026-04-21T10:00:00Z') });
    mockPostFindMany.mockResolvedValueOnce([post2, post1] as Awaited<
      ReturnType<typeof prisma.post.findMany>
    >);

    const caller = createCaller(authedContext());
    const result = await caller.post.list();

    expect(result.posts).toHaveLength(2);
    expect(result.posts[0]?.id).toBe('post-2');
    expect(result.posts[1]?.id).toBe('post-1');
  });

  it('respects visibility for anonymous callers — public only', async () => {
    mockPostFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const caller = createCaller(anonContext());
    await caller.post.list();

    const call = mockPostFindMany.mock.calls[0]!;
    expect(call[0]?.where?.visibility).toEqual({ in: ['public'] });
  });

  it('respects visibility for authenticated callers — includes authenticated_only', async () => {
    mockPostFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const caller = createCaller(authedContext());
    await caller.post.list();

    const call = mockPostFindMany.mock.calls[0]!;
    expect(call[0]?.where?.visibility).toEqual({ in: ['public', 'authenticated_only'] });
  });

  it('excludes soft-deleted posts', async () => {
    mockPostFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const caller = createCaller(authedContext());
    await caller.post.list();

    const call = mockPostFindMany.mock.calls[0]!;
    expect(call[0]?.where?.deletedAt).toBeNull();
  });

  it('cursor pagination returns next batch correctly', async () => {
    // Return limit+1 items to signal hasMore
    const posts = Array.from({ length: 21 }, (_, i) =>
      makeDbPost({
        id: `post-${i}`,
        createdAt: new Date(Date.now() - i * 60000),
      }),
    );
    mockPostFindMany.mockResolvedValueOnce(
      posts as Awaited<ReturnType<typeof prisma.post.findMany>>,
    );

    const caller = createCaller(authedContext());
    const result = await caller.post.list();

    expect(result.posts).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
    expect(result.nextCursor?.id).toBe('post-19');
  });

  it('passes cursor to the query when provided', async () => {
    mockPostFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const cursor = {
      createdAt: new Date('2026-04-10T12:00:00Z'),
      id: 'post-5',
    };

    const caller = createCaller(authedContext());
    await caller.post.list({ cursor });

    const call = mockPostFindMany.mock.calls[0]!;
    expect(call[0]?.where?.OR).toEqual([
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: { equals: cursor.createdAt }, id: { lt: cursor.id } },
    ]);
  });

  it('returns empty result when no posts exist', async () => {
    mockPostFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const caller = createCaller(authedContext());
    const result = await caller.post.list();

    expect(result.posts).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('includes AM URL in post data', async () => {
    const post = makeDbPost({
      activistMailerUrl: 'https://activist-mailer.example.com/test',
    });
    mockPostFindMany.mockResolvedValueOnce([post] as Awaited<
      ReturnType<typeof prisma.post.findMany>
    >);

    const caller = createCaller(authedContext());
    const result = await caller.post.list();

    expect(result.posts[0]?.activistMailerUrl).toBe('https://activist-mailer.example.com/test');
  });

  it('maps author roles from roleGrants', async () => {
    const post = makeDbPost({
      author: {
        id: 'user-admin',
        displayName: 'Admin',
        roleGrants: [{ role: 'admin' }],
      },
    });
    mockPostFindMany.mockResolvedValueOnce([post] as Awaited<
      ReturnType<typeof prisma.post.findMany>
    >);

    const caller = createCaller(authedContext());
    const result = await caller.post.list();

    expect(result.posts[0]?.author.roles).toEqual(['admin']);
  });
});
