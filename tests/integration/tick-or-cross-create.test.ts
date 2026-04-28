/**
 * Integration tests for the BU-tick-or-cross slice.
 *
 * @build-unit BU-tick-or-cross
 * @spec build/session-briefs/bu-tick-or-cross.md
 * @spec architecture/decision-log.md (D069)
 *
 * Covers the router → service → prisma chain for:
 *   - post.create with both signal values when kind === tick_or_cross
 *   - post.markSharedToNetwork: stamps once, no-op on second call
 *
 * Prisma is mocked at the DB boundary (same pattern as
 * post-list.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    postKind: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    roleGrant: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import { createCaller } from '@/server/routers/_app';
import { prisma } from '@/server/db/client';
import type { TRPCContext } from '@/server/lib/trpc';

const mockPostCreate = vi.mocked(prisma.post.create);
const mockKindFindUnique = vi.mocked(prisma.postKind.findUnique);
const mockPostFindUnique = vi.mocked(prisma.post.findUnique);
const mockPostUpdate = vi.mocked(prisma.post.update);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);

const callerCtx: TRPCContext = {
  user: {
    id: 'user-1',
    email: 'eddie@example.test',
    displayName: 'Eddie Test',
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

beforeEach(() => {
  mockPostCreate.mockReset();
  mockKindFindUnique.mockReset();
  mockPostFindUnique.mockReset();
  mockPostUpdate.mockReset();
  mockUserFindUnique.mockReset();
  mockPostCreate.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' } as never);
  mockUserFindUnique.mockResolvedValue({ id: 'user-1' } as never);
});

const baseInput = {
  title: 'Sky News bias',
  body: 'A clearly damaging article. Please amplify the response.',
  visibility: 'public' as const,
  kindId: 'kind-tc',
};

describe('post.create with signal (D069)', () => {
  it('creates a post with signal=promote when kind is tick_or_cross', async () => {
    mockKindFindUnique.mockResolvedValue({ slug: 'tick_or_cross' } as never);
    const caller = createCaller(callerCtx);
    await caller.post.create({ ...baseInput, signal: 'promote' });
    expect(mockPostCreate).toHaveBeenCalledTimes(1);
    expect(mockPostCreate.mock.calls[0]?.[0]?.data.signal).toBe('promote');
  });

  it('creates a post with signal=remove when kind is tick_or_cross', async () => {
    mockKindFindUnique.mockResolvedValue({ slug: 'tick_or_cross' } as never);
    const caller = createCaller(callerCtx);
    await caller.post.create({ ...baseInput, signal: 'remove' });
    expect(mockPostCreate.mock.calls[0]?.[0]?.data.signal).toBe('remove');
  });

  it('rejects signal on a non-tick_or_cross kind via the service invariant', async () => {
    mockKindFindUnique.mockResolvedValue({ slug: 'thought' } as never);
    const caller = createCaller(callerCtx);
    await expect(
      caller.post.create({ ...baseInput, kindId: 'kind-thought', signal: 'promote' }),
    ).rejects.toThrow('signal is only valid for tick_or_cross posts');
    expect(mockPostCreate).not.toHaveBeenCalled();
  });
});

describe('post.markSharedToNetwork (D069)', () => {
  it('stamps sharedToNetworkAt on first call', async () => {
    mockPostFindUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      sharedToNetworkAt: null,
      deletedAt: null,
    } as never);
    mockPostUpdate.mockResolvedValue({} as never);

    const caller = createCaller(callerCtx);
    const result = await caller.post.markSharedToNetwork({
      postId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.alreadyShared).toBe(false);
    expect(result.sharedToNetworkAt).toBeInstanceOf(Date);
    expect(mockPostUpdate).toHaveBeenCalledTimes(1);
    expect(mockPostUpdate.mock.calls[0]?.[0]?.where.id).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('is a no-op on second call (returns alreadyShared=true)', async () => {
    const firstStamp = new Date('2026-04-27T10:00:00Z');
    mockPostFindUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      sharedToNetworkAt: firstStamp,
      deletedAt: null,
    } as never);

    const caller = createCaller(callerCtx);
    const result = await caller.post.markSharedToNetwork({
      postId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.alreadyShared).toBe(true);
    expect(result.sharedToNetworkAt).toEqual(firstStamp);
    expect(mockPostUpdate).not.toHaveBeenCalled();
  });

  it('throws when the post does not exist', async () => {
    mockPostFindUnique.mockResolvedValue(null);
    const caller = createCaller(callerCtx);
    await expect(
      caller.post.markSharedToNetwork({ postId: '22222222-2222-4222-8222-222222222222' }),
    ).rejects.toThrow('post not found');
  });

  it('throws when the post is soft-deleted', async () => {
    mockPostFindUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      sharedToNetworkAt: null,
      deletedAt: new Date(),
    } as never);
    const caller = createCaller(callerCtx);
    await expect(
      caller.post.markSharedToNetwork({ postId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toThrow('post not found');
  });
});
