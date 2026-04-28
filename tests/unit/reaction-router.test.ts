/**
 * Unit tests for the reaction tRPC router.
 *
 * @build-unit BU-reactions
 * @spec architecture/decision-log.md (D050)
 * @spec architecture/api-contract.md
 *
 * Tests:
 *   - auth gate on add/remove
 *   - feature flag gate on add (FORBIDDEN when off)
 *   - Zod rejection on bad inputs
 *   - response shape contract for listForPost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('@/server/db/client', () => ({
  prisma: {
    reaction: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
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

const mockReactionCreate = vi.mocked(prisma.reaction.create);
const mockReactionDeleteMany = vi.mocked(prisma.reaction.deleteMany);
const mockReactionGroupBy = vi.mocked(prisma.reaction.groupBy);
const mockReactionFindMany = vi.mocked(prisma.reaction.findMany);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);
const mockFlagFindUnique = vi.mocked(prisma.featureFlag.findUnique);

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

function publicContext(): TRPCContext {
  return { user: null, activeRoles: [], activeScopes: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditCreate.mockResolvedValue({} as never);
  // Default: flag enabled
  mockFlagFindUnique.mockResolvedValue({ enabledGlobally: true } as never);
});

describe('reaction.add', () => {
  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const caller = createCaller(publicContext());

    await expect(
      caller.reaction.add({
        postId: '00000000-0000-4000-8000-000000000001',
        emoji: 'candle',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects when ff_reactions flag is off (FORBIDDEN)', async () => {
    mockFlagFindUnique.mockResolvedValueOnce({ enabledGlobally: false } as never);

    const caller = createCaller(authedContext());

    await expect(
      caller.reaction.add({
        postId: '00000000-0000-4000-8000-000000000001',
        emoji: 'candle',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('rejects unknown emoji via Zod', async () => {
    const caller = createCaller(authedContext());
    const badInput = {
      postId: '00000000-0000-4000-8000-000000000001',
      emoji: 'flame',
    } as unknown as Parameters<typeof caller.reaction.add>[0];

    await expect(caller.reaction.add(badInput)).rejects.toThrow();
  });

  it('rejects malformed postId via Zod', async () => {
    const caller = createCaller(authedContext());

    await expect(caller.reaction.add({ postId: 'not-a-uuid', emoji: 'candle' })).rejects.toThrow();
  });

  it('returns success on a valid call', async () => {
    mockReactionCreate.mockResolvedValueOnce({} as never);
    const caller = createCaller(authedContext());

    const result = await caller.reaction.add({
      postId: '00000000-0000-4000-8000-000000000001',
      emoji: 'candle',
    });

    expect(result).toEqual({ success: true });
  });
});

describe('reaction.remove', () => {
  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const caller = createCaller(publicContext());

    await expect(
      caller.reaction.remove({
        postId: '00000000-0000-4000-8000-000000000001',
        emoji: 'candle',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns success when authed', async () => {
    mockReactionDeleteMany.mockResolvedValueOnce({ count: 1 });
    const caller = createCaller(authedContext());

    const result = await caller.reaction.remove({
      postId: '00000000-0000-4000-8000-000000000001',
      emoji: 'candle',
    });

    expect(result).toEqual({ success: true });
  });
});

describe('reaction.listForPost', () => {
  it('works for unauthenticated callers — every entry has mine: false', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([{ emoji: 'heart', _count: { _all: 4 } }] as never);

    const caller = createCaller(publicContext());

    const result = await caller.reaction.listForPost({
      postId: '00000000-0000-4000-8000-000000000001',
    });

    expect(result).toEqual([{ emoji: 'heart', count: 4, mine: false }]);
  });

  it('returns mine: true for emoji the caller has reacted with', async () => {
    mockReactionGroupBy.mockResolvedValueOnce([
      { emoji: 'candle', _count: { _all: 2 } },
      { emoji: 'pray', _count: { _all: 1 } },
    ] as never);
    mockReactionFindMany.mockResolvedValueOnce([{ emoji: 'pray' }] as never);

    const caller = createCaller(authedContext());

    const result = await caller.reaction.listForPost({
      postId: '00000000-0000-4000-8000-000000000001',
    });

    expect(result).toContainEqual({ emoji: 'pray', count: 1, mine: true });
    expect(result).toContainEqual({ emoji: 'candle', count: 2, mine: false });
  });
});
