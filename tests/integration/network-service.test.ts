/**
 * Integration tests for the network feed service.
 *
 * @build-unit BU-network-feed
 * @spec adrs/0017-network-card-state.md
 *
 * Mocks Prisma at the boundary and stubs the upstream Supabase fetcher
 * via the `deps.fetchUpstream` injection point. Exercises:
 *
 *   - cache hit / miss / refresh-bypass
 *   - default state for upstream rows with no NetworkCardState row
 *   - text_body suppression when it equals the URL
 *   - upsert + audit + cache invalidation in setNetworkCardState
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    networkCardState: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import {
  listNetworkCards,
  setNetworkCardState,
  invalidateNetworkListCache,
  _networkCacheSize,
} from '@/server/services/network';
import { prisma } from '@/server/db/client';

const mockFindMany = vi.mocked(prisma.networkCardState.findMany);
const mockUpsert = vi.mocked(prisma.networkCardState.upsert);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);

beforeEach(() => {
  vi.clearAllMocks();
  invalidateNetworkListCache();
  mockAuditCreate.mockResolvedValue({} as never);
  mockFindMany.mockResolvedValue([]);
});

const baseRow = {
  id: 1,
  sent_at: '2026-05-01T10:00:00.000Z',
  from_name: 'Sharon',
  sender_hash: 'hash-sharon',
  url: 'https://example.com/article',
  link_title: 'A useful article',
  text_body: 'Look at this',
  chat_id: 'gps-network@g.us',
};

describe('listNetworkCards', () => {
  it('returns cards with default NEW state when no NetworkCardState row exists', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false },
      { fetchUpstream },
    );

    expect(result.fromCache).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(1n);
    expect(result.items[0]!.state).toEqual({
      status: 'NEW',
      ownerUserId: null,
      ownerDisplayName: null,
      notes: null,
      updatedAt: null,
    });
  });

  it('joins NetworkCardState rows by messageId', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);
    mockFindMany.mockResolvedValueOnce([
      {
        messageId: 1n,
        status: 'TRIAGED',
        ownerUserId: 'user-1',
        ownerUser: { displayName: 'Bette' },
        notes: 'Following up',
        updatedAt: new Date('2026-05-09T12:00:00Z'),
      } as never,
    ]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false },
      { fetchUpstream },
    );

    expect(result.items[0]!.state.status).toBe('TRIAGED');
    expect(result.items[0]!.state.ownerDisplayName).toBe('Bette');
    expect(result.items[0]!.state.notes).toBe('Following up');
  });

  it('suppresses text_body when it equals the URL', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([{ ...baseRow, text_body: baseRow.url }]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false },
      { fetchUpstream },
    );

    expect(result.items[0]!.textBody).toBeNull();
  });

  it('preserves text_body when it differs from the URL', async () => {
    const fetchUpstream = vi
      .fn()
      .mockResolvedValue([{ ...baseRow, text_body: 'Worth a read this morning' }]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false },
      { fetchUpstream },
    );

    expect(result.items[0]!.textBody).toBe('Worth a read this morning');
  });

  it('hits cache on second identical call without refetching', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);

    const first = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false },
      { fetchUpstream },
    );
    const second = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false },
      { fetchUpstream },
    );

    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache when refresh: true', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);

    await listNetworkCards({ limit: 50, windowDays: 90, refresh: false }, { fetchUpstream });
    const refreshed = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: true },
      { fetchUpstream },
    );

    expect(refreshed.fromCache).toBe(false);
    expect(fetchUpstream).toHaveBeenCalledTimes(2);
  });

  it('emits a cursor when a full page is returned', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([
      { ...baseRow, id: 5 },
      { ...baseRow, id: 4 },
    ]);

    const result = await listNetworkCards(
      { limit: 2, windowDays: 90, refresh: false },
      { fetchUpstream },
    );

    expect(result.nextCursor).toBe('4');
  });

  it('emits no cursor when fewer rows than limit are returned', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([{ ...baseRow, id: 9 }]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false },
      { fetchUpstream },
    );

    expect(result.nextCursor).toBeNull();
  });

  it('preserves null from_name as anonymous-sender signal', async () => {
    const fetchUpstream = vi
      .fn()
      .mockResolvedValue([{ ...baseRow, from_name: null, sender_hash: 'hash-anon' }]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false },
      { fetchUpstream },
    );

    expect(result.items[0]!.fromName).toBeNull();
    expect(result.items[0]!.senderHash).toBe('hash-anon');
  });

  it('returns an empty list (does not throw) when SUPABASE_URL/ANON_KEY are missing', async () => {
    const { SupabaseConfigError } = await import('@/server/lib/supabase');
    const fetchUpstream = vi
      .fn()
      .mockRejectedValue(
        new SupabaseConfigError(
          'SUPABASE_URL and SUPABASE_ANON_KEY must be set. See .env.example.',
        ),
      );

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false },
      { fetchUpstream },
    );

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(result.fromCache).toBe(false);
    expect(_networkCacheSize()).toBe(0);
  });

  it('propagates non-config errors (e.g. SupabaseFetchError) to the caller', async () => {
    const { SupabaseFetchError } = await import('@/server/lib/supabase');
    const fetchUpstream = vi.fn().mockRejectedValue(new SupabaseFetchError('upstream 503', 503));

    await expect(
      listNetworkCards({ limit: 50, windowDays: 90, refresh: false }, { fetchUpstream }),
    ).rejects.toThrow('upstream 503');
  });
});

describe('setNetworkCardState', () => {
  it('upserts the state row, writes audit, and invalidates the cache', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);

    await listNetworkCards({ limit: 50, windowDays: 90, refresh: false }, { fetchUpstream });
    expect(_networkCacheSize()).toBe(1);

    mockUpsert.mockResolvedValueOnce({
      messageId: 1n,
      status: 'PROMOTED',
      ownerUserId: 'user-1',
      ownerUser: { displayName: 'Bette' },
      notes: null,
      updatedAt: new Date(),
    } as never);

    const state = await setNetworkCardState({
      messageId: 1n,
      status: 'PROMOTED',
      ownerUserId: 'user-1',
      callerId: 'user-1',
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messageId: 1n },
        create: expect.objectContaining({ messageId: 1n, status: 'PROMOTED' }),
        update: expect.objectContaining({ status: 'PROMOTED' }),
      }),
    );
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(state.status).toBe('PROMOTED');
    expect(_networkCacheSize()).toBe(0);
  });

  it('writes the audit action with the lowercased status', async () => {
    mockUpsert.mockResolvedValueOnce({
      messageId: 1n,
      status: 'DISCARDED',
      ownerUserId: null,
      ownerUser: null,
      notes: null,
      updatedAt: new Date(),
    } as never);

    await setNetworkCardState({
      messageId: 1n,
      status: 'DISCARDED',
      callerId: 'user-1',
    });

    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'network_card.discarded',
          entityType: 'networkCardState',
          entityId: '1',
          userId: 'user-1',
        }),
      }),
    );
  });
});
