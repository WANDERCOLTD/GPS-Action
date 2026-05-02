/**
 * @build-unit BU-postcode-or-place
 * @spec docs/build/session-briefs/bu-postcode-or-place.md
 *
 * Integration tests for /api/geocode/place. Stubs `fetch` to simulate
 * Nominatim responses and asserts the proxy enforces:
 *
 *   - Min query length (≥ 3 chars per locked decision Q6).
 *   - Max query length (≤ 100 chars).
 *   - 1 req/s global budget (returns 429 + Retry-After: 1).
 *   - Required `User-Agent` header on the upstream call.
 *   - UK country bias (`countrycodes=gb`).
 *   - Friendly status codes for each failure mode.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, __resetRateLimitForTests } from '@/app/api/geocode/place/route';

const realFetch = globalThis.fetch;

function makeRequest(query: string): Request {
  const url = new URL('http://localhost/api/geocode/place');
  url.searchParams.set('q', query);
  return new Request(url, { method: 'GET' });
}

function nominatimRow(lat: string, lon: string): unknown {
  return [{ lat, lon }];
}

describe('GET /api/geocode/place', () => {
  beforeEach(() => {
    __resetRateLimitForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('returns 200 + lat/lng on a successful Nominatim hit', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => nominatimRow('51.4545', '-2.5879'),
    } as unknown as Response);

    const res = await GET(makeRequest('Bristol'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lat: 51.4545, lng: -2.5879 });
  });

  it('sets the policy-required User-Agent on the upstream call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => nominatimRow('51.4545', '-2.5879'),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await GET(makeRequest('Bristol'));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['User-Agent']).toMatch(/^gps-action\//);
    expect(headers?.['User-Agent']).toContain('paul@thewanders.com');
  });

  it('biases the upstream to UK results (countrycodes=gb)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => nominatimRow('51.4545', '-2.5879'),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await GET(makeRequest('Manchester'));
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('countrycodes=gb');
    expect(url).toContain('limit=1');
  });

  it('returns 404 / no-result when Nominatim returns an empty array', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);

    const res = await GET(makeRequest('asdfjkl'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no-result' });
  });

  it('returns 400 / invalid-query for inputs shorter than the min length', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    const res = await GET(makeRequest('ab'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-query' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 / invalid-query for inputs longer than 100 chars', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    const res = await GET(makeRequest('a'.repeat(101)));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 429 + Retry-After when the second call lands inside the 1s budget', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => nominatimRow('51', '-2'),
    } as unknown as Response);

    const first = await GET(makeRequest('Bristol'));
    expect(first.status).toBe(200);

    const second = await GET(makeRequest('Manchester'));
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBe('1');
    expect(await second.json()).toEqual({ error: 'rate-limited' });
  });

  it('returns 429 when Nominatim itself rate-limits us', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as unknown as Response);

    const res = await GET(makeRequest('Bristol'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1');
  });

  it('returns 502 / upstream-error on Nominatim 5xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);

    const res = await GET(makeRequest('Bristol'));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'upstream-error' });
  });

  it('returns 502 / upstream-error on a network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await GET(makeRequest('Bristol'));
    expect(res.status).toBe(502);
  });

  it('returns 502 when Nominatim returns malformed JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('parse fail');
      },
    } as unknown as Response);

    const res = await GET(makeRequest('Bristol'));
    expect(res.status).toBe(502);
  });

  it('returns 502 when Nominatim returns rows with invalid lat/lon strings', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ lat: 'not-a-number', lon: 'also-bad' }],
    } as unknown as Response);

    const res = await GET(makeRequest('Bristol'));
    expect(res.status).toBe(502);
  });

  it('treats whitespace-only input as invalid (matches client-side guard)', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    const res = await GET(makeRequest('   '));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
