/**
 * Unit tests for `isEventEnabled` — the hot-path read that gates atom
 * 5d-3's system-Comment writes in the kanban thread.
 *
 * Mocks the Prisma client per the repo's integration-test convention
 * (see board-list-cards.test.ts). Real-DB seeding of the 9 default
 * rows is verified at migration time, not here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    kanbanEventConfig: {
      findUnique: vi.fn(),
    },
  },
}));

import { isEventEnabled } from '@/server/services/kanban-event-config';
import { prisma } from '@/server/db/client';

const findUniqueMock = vi.mocked(prisma.kanbanEventConfig.findUnique);

describe('isEventEnabled', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it('returns true when the config row says enabled', async () => {
    findUniqueMock.mockResolvedValueOnce({ enabled: true } as never);
    expect(await isEventEnabled('column_move')).toBe(true);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { eventKind: 'column_move' },
      select: { enabled: true },
    });
  });

  it('returns false when the config row says disabled', async () => {
    findUniqueMock.mockResolvedValueOnce({ enabled: false } as never);
    expect(await isEventEnabled('assign_self')).toBe(false);
  });

  it('returns false defensively when the row is missing', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await isEventEnabled('title_edit')).toBe(false);
  });
});
