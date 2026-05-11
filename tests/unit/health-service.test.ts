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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { pingDatabase, pingSupabase } from '@/server/services/health';
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

describe('pingSupabase', () => {
  const ORIGINAL_URL = process.env.SUPABASE_URL;
  const ORIGINAL_KEY = process.env.SUPABASE_ANON_KEY;

  beforeEach(() => {
    // Reset env between tests so config-missing branch is testable.
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_URL !== undefined) process.env.SUPABASE_URL = ORIGINAL_URL;
    if (ORIGINAL_KEY !== undefined) process.env.SUPABASE_ANON_KEY = ORIGINAL_KEY;
  });

  it('returns config-missing when SUPABASE_URL is unset', async () => {
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const result = await pingSupabase();
    expect(result).toBe('config-missing');
  });

  it('returns config-missing when SUPABASE_ANON_KEY is unset', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    const result = await pingSupabase();
    expect(result).toBe('config-missing');
  });

  it('returns ok when fetch resolves with res.ok', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
    } as Response);

    const result = await pingSupabase();

    expect(result).toBe('ok');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/gps_group_messages'),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'anon-key',
          Authorization: 'Bearer anon-key',
        }),
      }),
    );
    fetchSpy.mockRestore();
  });

  it('returns unreachable when fetch resolves with !res.ok', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
    } as Response);

    const result = await pingSupabase();

    expect(result).toBe('unreachable');
    fetchSpy.mockRestore();
  });

  it('returns unreachable when fetch rejects', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network'));

    const result = await pingSupabase();

    expect(result).toBe('unreachable');
    fetchSpy.mockRestore();
  });
});
