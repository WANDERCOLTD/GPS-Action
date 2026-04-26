/**
 * Unit tests for the pingDatabase health service.
 *
 * @build-unit BU-healthcheck
 * @spec docs/build/phase-0-foundations.md
 *
 * The service is a thin wrapper around prisma.$queryRaw `SELECT 1`
 * that resolves a boolean and swallows errors. The tests pin both
 * paths via a vi.mock of the Prisma client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { pingDatabase } from '@/server/services/health';
import { prisma } from '@/server/db/client';

const mockQueryRaw = vi.mocked(prisma.$queryRaw);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pingDatabase', () => {
  it('resolves true when $queryRaw resolves', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const result = await pingDatabase();

    expect(result).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('resolves false when $queryRaw rejects', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));

    const result = await pingDatabase();

    expect(result).toBe(false);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not rethrow on database errors', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('timeout'));

    // Asserting "no throw" is the contract — the route handler
    // depends on this so it can assemble the structured `checks` payload.
    await expect(pingDatabase()).resolves.toBe(false);
  });
});
