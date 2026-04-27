/**
 * @build-unit BU-tick-or-cross
 * @spec build/session-briefs/bu-tick-or-cross.md
 * @spec architecture/decision-log.md (D069)
 *
 * Unit tests for the service-layer signal/kind invariant in
 * `createPost`: signal is required iff the resolved kind is
 * `tick_or_cross`, and forbidden otherwise.
 *
 * Mocks Prisma to avoid touching a real DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      create: vi.fn(),
    },
    postKind: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/seed-images', () => ({
  isAllowedHeroImageUrl: vi.fn().mockReturnValue(true),
}));

import { createPost } from '@/server/services/post';
import { prisma } from '@/server/db/client';

const mockPostCreate = vi.mocked(prisma.post.create);
const mockKindFindUnique = vi.mocked(prisma.postKind.findUnique);

beforeEach(() => {
  mockPostCreate.mockReset();
  mockKindFindUnique.mockReset();
  mockPostCreate.mockResolvedValue({ id: 'post-new' } as never);
});

const baseInput = {
  title: 'Sky News bias',
  body: 'A clearly damaging article. Please amplify the response.',
  visibility: 'public' as const,
};

describe('createPost — signal/kind invariant (D069)', () => {
  it('rejects signal=promote without a tick_or_cross kind', async () => {
    mockKindFindUnique.mockResolvedValue({ slug: 'thought' } as never);
    await expect(
      createPost(
        { ...baseInput, kindId: 'kind-thought', signal: 'promote' },
        'user-1',
      ),
    ).rejects.toThrow('signal is only valid for tick_or_cross posts');
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('rejects signal=remove without a tick_or_cross kind', async () => {
    mockKindFindUnique.mockResolvedValue({ slug: 'happening_now' } as never);
    await expect(
      createPost(
        { ...baseInput, kindId: 'kind-happening', signal: 'remove' },
        'user-1',
      ),
    ).rejects.toThrow('signal is only valid for tick_or_cross posts');
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('rejects signal absent on a tick_or_cross kind', async () => {
    mockKindFindUnique.mockResolvedValue({ slug: 'tick_or_cross' } as never);
    await expect(
      createPost({ ...baseInput, kindId: 'kind-tc' }, 'user-1'),
    ).rejects.toThrow('signal is required for tick_or_cross posts');
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('accepts signal=promote on a tick_or_cross kind', async () => {
    mockKindFindUnique.mockResolvedValue({ slug: 'tick_or_cross' } as never);
    await createPost(
      { ...baseInput, kindId: 'kind-tc', signal: 'promote' },
      'user-1',
    );
    expect(mockPostCreate).toHaveBeenCalledTimes(1);
    const call = mockPostCreate.mock.calls[0]?.[0];
    expect(call?.data.signal).toBe('promote');
    expect(call?.data.kindId).toBe('kind-tc');
  });

  it('accepts signal=remove on a tick_or_cross kind', async () => {
    mockKindFindUnique.mockResolvedValue({ slug: 'tick_or_cross' } as never);
    await createPost(
      { ...baseInput, kindId: 'kind-tc', signal: 'remove' },
      'user-1',
    );
    expect(mockPostCreate).toHaveBeenCalledTimes(1);
    expect(mockPostCreate.mock.calls[0]?.[0]?.data.signal).toBe('remove');
  });

  it('rejects signal when no kindId is supplied at all', async () => {
    await expect(
      createPost({ ...baseInput, signal: 'promote' }, 'user-1'),
    ).rejects.toThrow('signal is only valid for tick_or_cross posts');
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('passes signal=null through when neither kind nor signal is set', async () => {
    await createPost({ ...baseInput }, 'user-1');
    expect(mockPostCreate).toHaveBeenCalledTimes(1);
    expect(mockPostCreate.mock.calls[0]?.[0]?.data.signal).toBe(null);
  });
});
