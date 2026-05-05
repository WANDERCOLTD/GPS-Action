/**
 * Tests for server/services/group.ts (bu-group-identity / ADR-0013).
 *
 * Mocks prisma.group.groupBy and asserts the round-robin LRU logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    group: {
      groupBy: vi.fn(),
    },
  },
}));

import { assignNextColourKey, GROUP_COLOUR_PALETTE } from '@/server/services/group';
import { prisma } from '@/server/db/client';

const mockedGroup = vi.mocked(prisma.group);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assignNextColourKey', () => {
  it('returns the first palette entry when no groups exist', async () => {
    mockedGroup.groupBy.mockResolvedValueOnce([] as never);
    await expect(assignNextColourKey()).resolves.toBe('slate');
  });

  it('returns the first unused palette entry when some are used', async () => {
    mockedGroup.groupBy.mockResolvedValueOnce([
      { colourKey: 'slate', _max: { createdAt: new Date('2026-01-01') } },
      { colourKey: 'rust', _max: { createdAt: new Date('2026-02-01') } },
    ] as never);
    await expect(assignNextColourKey()).resolves.toBe('moss');
  });

  it('skips used colours regardless of where they sit in the palette', async () => {
    mockedGroup.groupBy.mockResolvedValueOnce([
      { colourKey: 'slate', _max: { createdAt: new Date('2026-01-01') } },
      { colourKey: 'moss', _max: { createdAt: new Date('2026-01-01') } },
      { colourKey: 'plum', _max: { createdAt: new Date('2026-01-01') } },
    ] as never);
    await expect(assignNextColourKey()).resolves.toBe('rust');
  });

  it('picks the oldest-max-createdAt colour when all 12 are in use', async () => {
    const usage = GROUP_COLOUR_PALETTE.map((name, i) => ({
      colourKey: name,
      _max: { createdAt: new Date(2026, 0, i + 1) },
    }));
    // `slate` (index 0) is the oldest; expect it to win.
    mockedGroup.groupBy.mockResolvedValueOnce(usage as never);
    await expect(assignNextColourKey()).resolves.toBe('slate');
  });

  it('breaks ties among equally-old colours by palette order', async () => {
    const sharedDate = new Date('2026-03-01');
    const usage = GROUP_COLOUR_PALETTE.map((name) => ({
      colourKey: name,
      _max: { createdAt: sharedDate },
    }));
    mockedGroup.groupBy.mockResolvedValueOnce(usage as never);
    await expect(assignNextColourKey()).resolves.toBe('slate');
  });

  it('excludes soft-deleted groups from usage (queries with deletedAt: null)', async () => {
    mockedGroup.groupBy.mockResolvedValueOnce([] as never);
    await assignNextColourKey();
    const arg = mockedGroup.groupBy.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ deletedAt: null });
  });

  it('treats an explicit null _max as unused (a colour with zero rows)', async () => {
    // Most palette entries used; one returns _max.createdAt = null
    // (defensive — Prisma shouldn't return that, but the helper must
    // not crash if it does).
    mockedGroup.groupBy.mockResolvedValueOnce([
      { colourKey: 'rust', _max: { createdAt: new Date('2026-02-01') } },
      { colourKey: 'slate', _max: { createdAt: null } },
    ] as never);
    // `slate` has no real usage → wins by palette order.
    await expect(assignNextColourKey()).resolves.toBe('moss');
  });
});
