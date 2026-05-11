/**
 * @build-unit BU-whatsapp-share bu-network-shares
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec build/session-briefs/bu-network-shares.md
 *
 * Integration tests for the share-intent endpoint. Covers the legacy
 * (post-only stub-log) shape and the new polymorphic shape that
 * writes to ShareEvent.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// bu-network-shares — the polymorphic branch calls share-event service
// which calls Prisma. Mock the boundary before importing the route.
vi.mock('@/server/db/client', () => ({
  prisma: {
    shareEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// Mock the dev-cookie auth helper so the polymorphic path can assert
// the authenticated branch without touching `next/headers`.
vi.mock('@/server/lib/auth', () => ({
  getUserIdFromCookie: vi.fn(),
}));

import { POST } from '@/app/api/analytics/share-intent/route';
import { prisma } from '@/server/db/client';
import { getUserIdFromCookie } from '@/server/lib/auth';

const mockFindUnique = vi.mocked(prisma.shareEvent.findUnique);
const mockCreate = vi.mocked(prisma.shareEvent.create);
const mockUpsert = vi.mocked(prisma.shareEvent.upsert);
const mockGetUserId = vi.mocked(getUserIdFromCookie);

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

// ── bu-network-shares — polymorphic shape ────────────────────────────────

describe('POST /api/analytics/share-intent — polymorphic shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserId.mockResolvedValue('user-123');
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({} as never);
    mockUpsert.mockResolvedValue({} as never);
  });

  it('writes an intent row when posted with { targetType, targetId, destination }', async () => {
    const res = await POST(
      makeRequest({ targetType: 'network_card', targetId: '42', destination: 'x' }),
    );
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0]?.[0] as {
      data: { targetType: string; targetId: string };
    };
    expect(args.data.targetType).toBe('network_card');
    expect(args.data.targetId).toBe('42');
  });

  it('stamps confirmedAt when verified=true is passed', async () => {
    const res = await POST(
      makeRequest({
        targetType: 'network_card',
        targetId: '42',
        destination: 'x',
        verified: true,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const args = mockUpsert.mock.calls[0]?.[0] as {
      create: { confirmedAt: Date };
    };
    expect(args.create.confirmedAt).toBeInstanceOf(Date);
  });

  it('returns 401 when no dev cookie is set', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ targetType: 'network_card', targetId: '42', destination: 'x' }),
    );
    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects unknown targetType', async () => {
    const res = await POST(makeRequest({ targetType: 'monkey', targetId: '42', destination: 'x' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('accepts targetType=post (forward-leaning polymorphic post target)', async () => {
    const res = await POST(
      makeRequest({ targetType: 'post', targetId: 'post-abc', destination: 'x' }),
    );
    expect(res.status).toBe(200);
    const args = mockCreate.mock.calls[0]?.[0] as { data: { postId: string; targetType: string } };
    expect(args.data.targetType).toBe('post');
    expect(args.data.postId).toBe('post-abc');
  });
});
