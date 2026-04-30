/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Round-trip CRUD tests for the Post entity through the generic
 * admin engine. Confirms the engine handles a second entity end-
 * to-end with no entity-specific code in the router.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const mFindMany = vi.mocked(prisma.post.findMany);
const mCount = vi.mocked(prisma.post.count);
const mCreate = vi.mocked(prisma.post.create);
const mUpdate = vi.mocked(prisma.post.update);
const mFindUnique = vi.mocked(prisma.post.findUnique);

function adminContext(): TRPCContext {
  return {
    user: {
      id: 'admin-1',
      email: 'admin@test.com',
      displayName: 'Admin',
      avatarUrl: null,
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    activeRoles: ['admin'],
    activeScopes: [],
  };
}

function fakePostRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'post-x',
    authorId: 'user-1',
    title: 'Hello',
    body: 'Body',
    visibility: 'public',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    author: { id: 'user-1', displayName: 'Eddie' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // BU-admin-audit-integration: mutations pre-load / re-fetch the row.
  mFindUnique.mockResolvedValue(
    fakePostRow() as unknown as Awaited<ReturnType<typeof prisma.post.findUnique>>,
  );
});

describe('admin.list / post', () => {
  it('returns rows with author.displayName resolved via include', async () => {
    mFindMany.mockResolvedValueOnce([fakePostRow()] as unknown as Awaited<
      ReturnType<typeof prisma.post.findMany>
    >);
    mCount.mockResolvedValueOnce(1);

    const caller = createCaller(adminContext());
    const result = await caller.admin.list({ entity: 'post' });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.['author.displayName']).toBe('Eddie');
    const call = mFindMany.mock.calls[0]?.[0];
    expect(call?.include).toEqual({
      author: { select: { id: true, displayName: true } },
    });
  });

  it('search uses contains on title + body', async () => {
    mFindMany.mockResolvedValueOnce(
      [] as unknown as Awaited<ReturnType<typeof prisma.post.findMany>>,
    );
    mCount.mockResolvedValueOnce(0);

    const caller = createCaller(adminContext());
    await caller.admin.list({ entity: 'post', search: 'hello' });

    const where = mFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown> | undefined;
    expect(where?.OR).toEqual([
      { title: { contains: 'hello', mode: 'insensitive' } },
      { body: { contains: 'hello', mode: 'insensitive' } },
    ]);
  });
});

describe('admin.create / post', () => {
  it('creates a post and returns the id', async () => {
    mCreate.mockResolvedValueOnce({ id: 'post-new' } as Awaited<
      ReturnType<typeof prisma.post.create>
    >);
    const caller = createCaller(adminContext());
    const result = await caller.admin.create({
      entity: 'post',
      data: {
        authorId: '00000000-0000-4000-8000-000000000001',
        title: 'New post',
        body: 'Body content',
        visibility: 'public',
      },
    });
    expect(result).toEqual({ id: 'post-new' });
  });
});

describe('admin.update / post', () => {
  it('updates only the provided fields', async () => {
    mUpdate.mockResolvedValueOnce({ id: 'post-x' } as Awaited<
      ReturnType<typeof prisma.post.update>
    >);
    const caller = createCaller(adminContext());
    await caller.admin.update({
      entity: 'post',
      id: '00000000-0000-4000-8000-000000000002',
      data: { visibility: 'authenticated_only' },
    });
    const call = mUpdate.mock.calls[0]?.[0];
    expect(call?.data).toEqual({ visibility: 'authenticated_only' });
  });
});

describe('admin.delete / post — soft', () => {
  it('soft-delete sets deletedAt', async () => {
    mUpdate.mockResolvedValueOnce({ id: 'post-x' } as Awaited<
      ReturnType<typeof prisma.post.update>
    >);
    const caller = createCaller(adminContext());
    await caller.admin.delete({
      entity: 'post',
      id: '00000000-0000-4000-8000-000000000003',
      mode: 'soft',
    });
    expect(mUpdate.mock.calls[0]?.[0]?.data).toMatchObject({ deletedAt: expect.any(Date) });
  });
});

describe('admin.get / post — flatten dotted paths', () => {
  it('returns flattened row keyed by listColumns', async () => {
    mFindUnique.mockResolvedValueOnce(
      fakePostRow() as unknown as Awaited<ReturnType<typeof prisma.post.findUnique>>,
    );
    const caller = createCaller(adminContext());
    const row = await caller.admin.get({
      entity: 'post',
      id: '00000000-0000-4000-8000-000000000004',
    });
    expect(row['author.displayName']).toBe('Eddie');
    expect(row.title).toBe('Hello');
  });
});
