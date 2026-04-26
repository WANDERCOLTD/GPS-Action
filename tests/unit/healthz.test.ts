/**
 * Unit tests for the /healthz liveness route handler.
 *
 * @build-unit BU-healthcheck
 * @spec docs/build/phase-0-foundations.md
 *
 * The handler is a thin function: returns 200 with status 'ok' and
 * the current process uptime. No dependencies, so no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/healthz/route';

describe('GET /healthz', () => {
  it('returns 200', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('returns status: ok', async () => {
    const response = await GET();
    const body = (await response.json()) as { status: string; uptime: number };
    expect(body.status).toBe('ok');
  });

  it('returns a numeric uptime', async () => {
    const response = await GET();
    const body = (await response.json()) as { status: string; uptime: number };
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});
