/**
 * @build-unit bu-network-shares
 * @spec build/session-briefs/bu-network-shares.md
 * @spec adrs/0018-share-event-polymorphic.md
 *
 * Integration test for the intent → verified flow on a network_card
 * target. Stubs Prisma at the boundary and asserts that the service
 * leaves the row in the expected state at each step.
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
const mockUpsert = vi.mocked(prisma.shareEvent.upsert);
const mockGroupBy = vi.mocked(prisma.shareEvent.groupBy);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('share-event intent → verified flow (network_card)', () => {
  const target = {
    userId: 'user-1',
    targetType: 'network_card' as const,
    targetId: '4242',
    destination: 'x' as const,
  };

  it('intent then confirm creates a single verified row', async () => {
    // Step 1: intent. No prior row.
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({} as never);

    const intentResult = await recordShareIntent(target);
    expect(intentResult.kind).toBe('created');

    // Step 2: confirm. A row exists with intent timestamp, no confirmedAt.
    mockFindUnique.mockResolvedValueOnce({ confirmedAt: null } as never);
    mockUpsert.mockResolvedValueOnce({} as never);

    const confirmResult = await confirmShareSent(target);
    expect(confirmResult.kind).toBe('confirmed');

    // The upsert payload should include confirmedAt
    const upsertArgs = mockUpsert.mock.calls[0]?.[0] as {
      update: { confirmedAt: Date };
    };
    expect(upsertArgs.update.confirmedAt).toBeInstanceOf(Date);
  });

  it('verified row appears in getNetworkCardShareCounts', async () => {
    mockGroupBy.mockResolvedValueOnce([
      { targetId: '4242', destination: 'x', _count: { _all: 1 } },
    ] as never);

    const counts = await getNetworkCardShareCounts(['4242']);
    const entry = counts.get('4242');
    expect(entry?.total).toBe(1);
    expect(entry?.perDestination.x).toBe(1);
  });

  it('intent-only (no confirm) does NOT appear in getNetworkCardShareCounts (verified filter)', async () => {
    // The service's groupBy carries `confirmedAt: { not: null }`, so an
    // intent-only row would not be returned. We assert the filter shape
    // here — the mock would return zero rows even if intent-only rows
    // existed in the DB.
    mockGroupBy.mockResolvedValueOnce([]);
    const counts = await getNetworkCardShareCounts(['4242']);
    expect(counts.get('4242')?.total).toBe(0);

    const where = (mockGroupBy.mock.calls[0]?.[0] as { where: { confirmedAt: unknown } }).where
      .confirmedAt;
    expect(where).toEqual({ not: null });
  });

  it('rate-limit window prevents intent duplication on rapid re-taps', async () => {
    mockFindUnique.mockResolvedValueOnce({ intentAt: new Date(Date.now() - 1_000) } as never);

    const result = await recordShareIntent(target);
    expect(result.kind).toBe('rate_limited');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
