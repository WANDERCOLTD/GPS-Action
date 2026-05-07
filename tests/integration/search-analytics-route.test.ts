/**
 * Integration tests for the BU-search-surface analytics stub endpoint.
 *
 * @build-unit BU-search-surface
 * @spec product/analytics-events.md
 * @spec architecture/decision-log.md (D078)
 *
 * Mirrors the share-intent route's test style — invoke the route's
 * exported `POST` handler with a hand-rolled `Request` and assert
 * shape + status. The privacy gate is the headline test: payloads
 * carrying a raw query string MUST be rejected at the boundary.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // The stub logs to stdout; intercept so the test output stays clean.
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

const { POST } = await import('@/app/api/analytics/search/route');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/analytics/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/analytics/search — privacy gate', () => {
  it('rejects payloads carrying a raw `q` field', async () => {
    const res = await POST(makeRequest({ event: 'search_query_submitted', q: 'hendon' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('pii_rejected');
  });

  it('rejects payloads carrying a `query` field', async () => {
    const res = await POST(makeRequest({ event: 'search_query_submitted', query: 'sharon cohen' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('pii_rejected');
  });
});

describe('POST /api/analytics/search — event validation', () => {
  it('rejects an unknown event name', async () => {
    const res = await POST(makeRequest({ event: 'made_up_event' }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/analytics/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts a well-formed search_opened payload', async () => {
    const res = await POST(makeRequest({ event: 'search_opened', source: 'appnav' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('rejects search_opened with an unknown source', async () => {
    const res = await POST(makeRequest({ event: 'search_opened', source: 'mystery' }));
    expect(res.status).toBe(400);
  });

  it('accepts a well-formed search_query_submitted payload', async () => {
    const res = await POST(
      makeRequest({ event: 'search_query_submitted', q_length: 7, has_scope_chip: false }),
    );
    expect(res.status).toBe(200);
  });

  it('rejects search_query_submitted with non-numeric q_length', async () => {
    const res = await POST(
      makeRequest({ event: 'search_query_submitted', q_length: 'lots', has_scope_chip: false }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects search_query_submitted missing has_scope_chip', async () => {
    const res = await POST(makeRequest({ event: 'search_query_submitted', q_length: 5 }));
    expect(res.status).toBe(400);
  });

  it('accepts a well-formed search_result_clicked payload', async () => {
    const res = await POST(
      makeRequest({
        event: 'search_result_clicked',
        entity_type: 'posts',
        position_in_group: 0,
        group_position: 0,
      }),
    );
    expect(res.status).toBe(200);
  });

  it('rejects search_result_clicked with an unknown entity_type', async () => {
    const res = await POST(
      makeRequest({
        event: 'search_result_clicked',
        // `comments` is now valid (bu-search-includes-comments) — use
        // an obviously bogus value to lock the rejection path.
        entity_type: 'aliens',
        position_in_group: 0,
        group_position: 0,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts a well-formed search_see_all_clicked payload', async () => {
    const res = await POST(makeRequest({ event: 'search_see_all_clicked', entity_type: 'people' }));
    expect(res.status).toBe(200);
  });

  it('accepts entity_type=comments (bu-search-includes-comments)', async () => {
    const clicked = await POST(
      makeRequest({
        event: 'search_result_clicked',
        entity_type: 'comments',
        position_in_group: 1,
        group_position: 5,
      }),
    );
    expect(clicked.status).toBe(200);
    const seeAll = await POST(
      makeRequest({ event: 'search_see_all_clicked', entity_type: 'comments' }),
    );
    expect(seeAll.status).toBe(200);
  });

  it('logs the accepted payload to stdout (stub sink)', async () => {
    await POST(makeRequest({ event: 'search_opened', source: 'appnav' }));
    expect(consoleLogSpy).toHaveBeenCalled();
    const calls = consoleLogSpy.mock.calls.flat().join(' ');
    expect(calls).toContain('[ANALYTICS]');
    expect(calls).toContain('search_opened');
  });
});
