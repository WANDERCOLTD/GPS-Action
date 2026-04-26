/**
 * Unit tests for the /readyz readiness route handler.
 *
 * @build-unit BU-healthcheck
 * @spec docs/build/phase-0-foundations.md
 *
 * The handler delegates to pingDatabase (mocked here) and translates
 * its boolean into a structured `checks` payload + status code.
 *   - database OK  → 200 { status: 'ready', checks: { database: 'ok' } }
 *   - database FAIL → 503 { status: 'not_ready', checks: { database: 'fail' } }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the health service ──────────────────────────────────────────────

vi.mock('@/server/services/health', () => ({
  pingDatabase: vi.fn(),
}));

import { GET } from '@/app/api/readyz/route';
import { pingDatabase } from '@/server/services/health';

const mockPingDatabase = vi.mocked(pingDatabase);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /readyz', () => {
  it('returns 200 with database: ok when pingDatabase resolves true', async () => {
    mockPingDatabase.mockResolvedValueOnce(true);

    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      checks: Record<string, string>;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ready',
      checks: { database: 'ok' },
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
    expect(body).toEqual({
      status: 'not_ready',
      checks: { database: 'fail' },
    });
  });

  it('calls pingDatabase exactly once per request', async () => {
    mockPingDatabase.mockResolvedValueOnce(true);

    await GET();

    expect(mockPingDatabase).toHaveBeenCalledTimes(1);
  });
});
