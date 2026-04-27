/**
 * @build-unit BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 *
 * Integration tests for the share-intent stub endpoint.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/analytics/share-intent/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/analytics/share-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/analytics/share-intent', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('accepts a valid whatsapp share intent and emits to stdout', async () => {
    const res = await POST(makeRequest({ postId: 'abc123', destination: 'whatsapp' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = String(logSpy.mock.calls[0]?.[0] ?? '');
    expect(line).toContain('[ANALYTICS] post_shared_out');
    expect(line).toContain('destination=whatsapp');
  });

  it('hashes the postId so the raw id never reaches the log', async () => {
    const postId = 'sensitive-uuid-1234';
    await POST(makeRequest({ postId, destination: 'whatsapp' }));
    const line = String(logSpy.mock.calls[0]?.[0] ?? '');
    expect(line).not.toContain(postId);
    expect(line).toMatch(/post_id_hash=[A-Za-z0-9_-]{12}/);
  });

  it('rejects non-JSON bodies with 400', async () => {
    const res = await POST(makeRequest('not-json'));
    expect(res.status).toBe(400);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('rejects payload missing postId', async () => {
    const res = await POST(makeRequest({ destination: 'whatsapp' }));
    expect(res.status).toBe(400);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('rejects payload with unknown destination', async () => {
    const res = await POST(makeRequest({ postId: 'abc', destination: 'pigeon' }));
    expect(res.status).toBe(400);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('accepts the other catalogued destinations so BU-share-out can extend without contract change', async () => {
    for (const destination of ['x', 'email', 'copy_link', 'other'] as const) {
      logSpy.mockClear();
      const res = await POST(makeRequest({ postId: 'abc', destination }));
      expect(res.status).toBe(200);
      expect(logSpy).toHaveBeenCalledTimes(1);
    }
  });
});
