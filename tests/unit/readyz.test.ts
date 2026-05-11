/**
 * Unit tests for the /readyz readiness route handler.
 *
 * @build-unit BU-healthcheck
 * @spec docs/build/phase-0-foundations.md
 *
 * The handler delegates to pingDatabase + pingSupabase (mocked here)
 * and translates their results into a structured `checks` payload +
 * status code.
 *
 *   - database OK + supabase ok      → 200 ready
 *   - database OK + supabase config-missing → 200 ready (non-fatal)
 *   - database OK + supabase unreachable    → 200 ready (non-fatal)
 *   - database FAIL                  → 503 not_ready
 *
 * Database is the only fatal upstream. Supabase is reported in the
 * payload but does not flip the status — its absence/failure degrades
 * the /network surface, not the whole app.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the health service ──────────────────────────────────────────────

vi.mock('@/server/services/health', () => ({
  pingDatabase: vi.fn(),
  pingSupabase: vi.fn(),
}));

import { GET } from '@/app/api/readyz/route';
import { pingDatabase, pingSupabase } from '@/server/services/health';

const mockPingDatabase = vi.mocked(pingDatabase);
const mockPingSupabase = vi.mocked(pingSupabase);

beforeEach(() => {
  vi.clearAllMocks();
  // Default supabase to ok so each test only sets it when relevant.
  mockPingSupabase.mockResolvedValue('ok');
});

describe('GET /readyz', () => {
  it('returns 200 with database: ok + supabase: ok when both pass', async () => {
    mockPingDatabase.mockResolvedValueOnce(true);
    mockPingSupabase.mockResolvedValueOnce('ok');

    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      checks: Record<string, string>;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ready',
      checks: { database: 'ok', supabase: 'ok' },
    });
  });

  it('returns 503 with database: fail when pingDatabase resolves false', async () => {
    mockPingDatabase.mockResolvedValueOnce(false);

    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      checks: Record<string, string>;
    };

    expect(response.status).toBe(503);
    expect(body.status).toBe('not_ready');
    expect(body.checks.database).toBe('fail');
  });

  it('still returns 200 when supabase is config-missing (non-fatal)', async () => {
    mockPingDatabase.mockResolvedValueOnce(true);
    mockPingSupabase.mockResolvedValueOnce('config-missing');

    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      checks: Record<string, string>;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.checks.supabase).toBe('config-missing');
  });

  it('still returns 200 when supabase is unreachable (non-fatal)', async () => {
    mockPingDatabase.mockResolvedValueOnce(true);
    mockPingSupabase.mockResolvedValueOnce('unreachable');

    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      checks: Record<string, string>;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.checks.supabase).toBe('unreachable');
  });

  it('calls pingDatabase and pingSupabase exactly once per request', async () => {
    mockPingDatabase.mockResolvedValueOnce(true);

    await GET();

    expect(mockPingDatabase).toHaveBeenCalledTimes(1);
    expect(mockPingSupabase).toHaveBeenCalledTimes(1);
  });
});
