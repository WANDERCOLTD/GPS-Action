/**
 * @build-unit bu-network-shares
 * @spec adrs/0018-share-event-polymorphic.md
 * @spec build/session-briefs/bu-network-shares.md
 *
 * Unit tests for the polymorphic share-event service. Mocks Prisma at
 * the boundary. Exercises:
 *
 *   - recordShareIntent: created vs updated vs rate-limited paths
 *   - confirmShareSent: confirmed vs already_confirmed; create-on-missing
 *   - getNetworkCardShareCounts: zero-fill, per-destination breakdown
 *   - typedForeignKeys branching: post → postId, network_card → networkCardStateId
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    shareEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import {
  recordShareIntent,
  confirmShareSent,
  getNetworkCardShareCounts,
} from '@/server/services/share-event';
import { prisma } from '@/server/db/client';

const mockFindUnique = vi.mocked(prisma.shareEvent.findUnique);
const mockCreate = vi.mocked(prisma.shareEvent.create);
const mockUpdate = vi.mocked(prisma.shareEvent.update);
const mockUpsert = vi.mocked(prisma.shareEvent.upsert);
const mockGroupBy = vi.mocked(prisma.shareEvent.groupBy);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordShareIntent', () => {
  it('creates a row when none exists (network_card target)', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({} as never);

    const result = await recordShareIntent({
      userId: 'u1',
      targetType: 'network_card',
      targetId: '42',
      destination: 'x',
    });

    expect(result.kind).toBe('created');
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        targetType: 'network_card',
        targetId: '42',
        networkCardStateId: BigInt('42'),
        postId: null,
        destination: 'x',
      }),
    });
  });

  it('creates a row with postId set when targetType=post', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({} as never);

    await recordShareIntent({
      userId: 'u1',
      targetType: 'post',
      targetId: 'post-abc',
      destination: 'whatsapp',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        postId: 'post-abc',
        networkCardStateId: null,
        targetType: 'post',
      }),
    });
  });

  it('returns rate_limited when an existing row is inside the 30s window', async () => {
    mockFindUnique.mockResolvedValue({ intentAt: new Date(Date.now() - 5_000) } as never);

    const result = await recordShareIntent({
      userId: 'u1',
      targetType: 'network_card',
      targetId: '42',
      destination: 'x',
    });

    expect(result.kind).toBe('rate_limited');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates intentAt when an existing row is outside the 30s window', async () => {
    mockFindUnique.mockResolvedValue({ intentAt: new Date(Date.now() - 60_000) } as never);
    mockUpdate.mockResolvedValue({} as never);

    const result = await recordShareIntent({
      userId: 'u1',
      targetType: 'network_card',
      targetId: '42',
      destination: 'x',
    });

    expect(result.kind).toBe('updated');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('confirmShareSent', () => {
  it('upserts confirmedAt when no prior row exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({} as never);

    const result = await confirmShareSent({
      userId: 'u1',
      targetType: 'network_card',
      targetId: '42',
      destination: 'x',
    });

    expect(result.kind).toBe('confirmed');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0]?.[0] as {
      create: { confirmedAt: Date };
      update: { confirmedAt: Date };
    };
    expect(call.create.confirmedAt).toBeInstanceOf(Date);
    expect(call.update.confirmedAt).toBeInstanceOf(Date);
  });

  it('is a no-op when the row is already confirmed', async () => {
    mockFindUnique.mockResolvedValue({
      confirmedAt: new Date('2026-01-01'),
    } as never);

    const result = await confirmShareSent({
      userId: 'u1',
      targetType: 'network_card',
      targetId: '42',
      destination: 'x',
    });

    expect(result.kind).toBe('already_confirmed');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('promotes an existing intent-only row to confirmed', async () => {
    mockFindUnique.mockResolvedValue({ confirmedAt: null } as never);
    mockUpsert.mockResolvedValue({} as never);

    const result = await confirmShareSent({
      userId: 'u1',
      targetType: 'network_card',
      targetId: '42',
      destination: 'whatsapp',
    });

    expect(result.kind).toBe('confirmed');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

describe('getNetworkCardShareCounts', () => {
  it('returns an empty map when no ids passed', async () => {
    const out = await getNetworkCardShareCounts([]);
    expect(out.size).toBe(0);
    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it('zero-fills every requested id even when there are no rows', async () => {
    mockGroupBy.mockResolvedValue([]);
    const out = await getNetworkCardShareCounts(['1', '2', '3']);

    expect(out.size).toBe(3);
    for (const id of ['1', '2', '3']) {
      const c = out.get(id);
      expect(c?.total).toBe(0);
      expect(c?.perDestination.whatsapp).toBe(0);
      expect(c?.perDestination.x).toBe(0);
    }
  });

  it('aggregates per-destination counts and the total', async () => {
    mockGroupBy.mockResolvedValue([
      { targetId: '1', destination: 'x', _count: { _all: 3 } },
      { targetId: '1', destination: 'whatsapp', _count: { _all: 2 } },
      { targetId: '2', destination: 'facebook', _count: { _all: 1 } },
    ] as never);

    const out = await getNetworkCardShareCounts(['1', '2']);
    expect(out.get('1')?.total).toBe(5);
    expect(out.get('1')?.perDestination.x).toBe(3);
    expect(out.get('1')?.perDestination.whatsapp).toBe(2);
    expect(out.get('1')?.perDestination.facebook).toBe(0);
    expect(out.get('2')?.total).toBe(1);
    expect(out.get('2')?.perDestination.facebook).toBe(1);
  });

  it('passes confirmedAt: { not: null } filter to the DB query', async () => {
    mockGroupBy.mockResolvedValue([]);
    await getNetworkCardShareCounts(['1']);

    const call = mockGroupBy.mock.calls[0]?.[0] as { where: { confirmedAt: { not: null } } };
    expect(call.where.confirmedAt).toEqual({ not: null });
  });
});
