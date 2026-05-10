/**
 * Unit tests for `touchRequestActivity` (bu-ticket-view-fixes / Sub-build A — ADR-0015).
 *
 * Asserts the helper:
 *   - calls `prisma.request.update` exactly once with the right
 *     where clause + lastActivityAt timestamp;
 *   - does not touch any other field on the row;
 *   - accepts an explicit `now` parameter for testable determinism;
 *   - works with a transaction client (same shape).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { touchRequestActivity } from '@/server/services/request-activity';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeMockClient() {
  const update = vi.fn().mockResolvedValue({ id: 'r1' });
  return {
    update,
    client: {
      request: { update },
    } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('touchRequestActivity', () => {
  it('updates lastActivityAt on the target row exactly once', async () => {
    const { update, client } = makeMockClient();
    const now = new Date('2026-05-09T12:00:00Z');

    await touchRequestActivity(client, 'r1', now);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { lastActivityAt: now },
    });
  });

  it('defaults `now` to a fresh Date when not supplied', async () => {
    const { update, client } = makeMockClient();
    const before = Date.now();

    await touchRequestActivity(client, 'r1');

    const after = Date.now();
    expect(update).toHaveBeenCalledTimes(1);
    const call = update.mock.calls[0]?.[0];
    expect(call.where).toEqual({ id: 'r1' });
    const stamp = (call.data.lastActivityAt as Date).getTime();
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(after);
  });

  it('writes only the lastActivityAt field — no other Request data is touched', async () => {
    const { update, client } = makeMockClient();
    await touchRequestActivity(client, 'r1', new Date());
    const call = update.mock.calls[0]?.[0];
    expect(Object.keys(call.data)).toEqual(['lastActivityAt']);
  });

  it('accepts a transaction client with the same shape', async () => {
    // Transaction client has the same `request.update` surface — no
    // type-level distinction at runtime; we just exercise the path so
    // the call-site contract is documented in tests.
    const { update, client: tx } = makeMockClient();
    await touchRequestActivity(tx, 'r1', new Date('2026-05-09T13:00:00Z'));
    expect(update).toHaveBeenCalledTimes(1);
  });
});
