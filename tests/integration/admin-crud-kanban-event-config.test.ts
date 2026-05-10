/**
 * @build-unit BU-admin-crud BU-kanban-event-config
 * @spec architecture/admin-surface.md
 *
 * Regression: every entity registered in the admin registry must
 * also have a `getEntityRaw` case, otherwise audit-write throws and
 * `updateEntity` blows up when toggling the row through `/data`.
 * Pre-fix, toggling any `kanbanEventConfig` field surfaced
 * `Entity "kanbanEventConfig" is not registered for raw read`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    kanbanEventConfig: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/server/db/client';
import { getEntityRaw } from '@/server/services/admin/crud';

const mFindUnique = vi.mocked(prisma.kanbanEventConfig.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getEntityRaw — kanbanEventConfig', () => {
  it('returns the row including updatedBy', async () => {
    const row = {
      id: 'kec-1',
      eventType: 'urgent_off',
      enabled: true,
      updatedByUserId: 'user-1',
      updatedAt: new Date(),
      updatedBy: { id: 'user-1', displayName: 'Admin' },
    };
    mFindUnique.mockResolvedValueOnce(row as never);

    const result = await getEntityRaw('kanbanEventConfig', 'kec-1');

    expect(result).toEqual(row);
    expect(mFindUnique).toHaveBeenCalledWith({
      where: { id: 'kec-1' },
      include: {
        updatedBy: { select: { id: true, displayName: true } },
      },
    });
  });

  it('returns null when the row is missing', async () => {
    mFindUnique.mockResolvedValueOnce(null);
    const result = await getEntityRaw('kanbanEventConfig', 'nope');
    expect(result).toBeNull();
  });
});
