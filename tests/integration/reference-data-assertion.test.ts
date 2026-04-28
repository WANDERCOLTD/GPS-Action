/**
 * @build-unit BU-tick-or-cross
 * @spec architecture/decision-log.md (D070)
 *
 * Unit-level coverage for the reference-data invariant. The CI
 * reference-data gate (branch 2 — chore/ci-reference-data-gate) runs
 * the same assertion against a real Postgres after
 * `prisma migrate deploy`; this file just confirms the lookup logic
 * with prisma mocked at the DB boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    postKind: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/server/db/client';
import { assertReferenceData, MissingReferenceDataError } from '@/server/lib/assert-reference-data';
import { REQUIRED_POST_KIND_SLUGS } from '@/shared/post-kinds';

const mockFindMany = vi.mocked(prisma.postKind.findMany);

describe('assertReferenceData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns when every required slug is present', async () => {
    mockFindMany.mockResolvedValue(REQUIRED_POST_KIND_SLUGS.map((slug) => ({ slug })) as never);
    await expect(assertReferenceData()).resolves.toBeUndefined();
  });

  it('throws MissingReferenceDataError listing every missing slug', async () => {
    const present = REQUIRED_POST_KIND_SLUGS.filter((s) => s !== 'tick_or_cross' && s !== 'event');
    mockFindMany.mockResolvedValue(present.map((slug) => ({ slug })) as never);

    await expect(assertReferenceData()).rejects.toBeInstanceOf(MissingReferenceDataError);
    await expect(assertReferenceData()).rejects.toMatchObject({
      missing: ['event', 'tick_or_cross'],
    });
  });

  it('treats soft-deleted rows as missing (query filters deletedAt)', async () => {
    mockFindMany.mockResolvedValue([]);
    await expect(assertReferenceData()).rejects.toBeInstanceOf(MissingReferenceDataError);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('preserves declaration order in the missing list', async () => {
    const present = ['thought', 'meeting'];
    mockFindMany.mockResolvedValue(present.map((slug) => ({ slug })) as never);

    try {
      await assertReferenceData();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingReferenceDataError);
      const missing = (err as MissingReferenceDataError).missing;
      const expectedOrder = REQUIRED_POST_KIND_SLUGS.filter((s) => !present.includes(s));
      expect([...missing]).toEqual(expectedOrder);
    }
  });
});
