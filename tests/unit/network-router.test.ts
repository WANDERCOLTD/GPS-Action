/**
 * Unit tests for the network feed tRPC router.
 *
 * @build-unit BU-network-feed
 * @spec adrs/0017-network-card-state.md
 * @spec architecture/api-contract.md
 *
 * Tests:
 *   - feature-flag gate on `list` (FORBIDDEN when off)
 *   - feature-flag gate on `setCardState` (FORBIDDEN when off)
 *   - auth gate on `setCardState` (UNAUTHORIZED for public caller)
 *   - Zod rejection on bad inputs
 *   - response shape contract for `list`
 *
 * The Supabase-side fetch is intercepted at the global `fetch` level
 * so the router's downstream service path is exercised end-to-end
 * without hitting any real network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('@/server/db/client', () => ({
  prisma: {
    networkCardState: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    featureFlag: {
      findUnique: vi.fn(),
    },
    // bu-network-shares — listNetworkCards now projects share counts.
    // Default to an empty groupBy result so the existing assertions
    // (which don't care about shares) stay green.
    shareEvent: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';
import { invalidateNetworkListCache } from '@/server/services/network';

const mockFindMany = vi.mocked(prisma.networkCardState.findMany);
const mockUpsert = vi.mocked(prisma.networkCardState.upsert);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);
const mockFlagFindUnique = vi.mocked(prisma.featureFlag.findUnique);

function authedContext(): TRPCContext {
  return {
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'test@test.com',
      displayName: 'Test User',
      avatarUrl: null,
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    activeRoles: [],
    activeScopes: [],
  };
}

function publicContext(): TRPCContext {
  return { user: null, activeRoles: [], activeScopes: [] };
}

function mockSupabaseFetch(rows: unknown[] = []): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => rows,
    text: async () => '',
  } as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateNetworkListCache();
  mockAuditCreate.mockResolvedValue({} as never);
  mockFindMany.mockResolvedValue([]);
  mockFlagFindUnique.mockResolvedValue({ enabledGlobally: true } as never);
  vi.stubGlobal('fetch', mockSupabaseFetch([]));
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
});

describe('network.list', () => {
  it('rejects when network_feed flag is off (FORBIDDEN)', async () => {
    mockFlagFindUnique.mockResolvedValueOnce({ enabledGlobally: false } as never);
    const caller = createCaller(publicContext());

    await expect(caller.network.list({})).rejects.toBeInstanceOf(TRPCError);
  });

  it('returns the wire-shape contract on a valid call', async () => {
    vi.stubGlobal(
      'fetch',
      mockSupabaseFetch([
        {
          id: 1,
          sent_at: '2026-05-01T10:00:00.000Z',
          from_name: 'Sharon',
          sender_hash: 'hash-sharon',
          url: 'https://example.com/article',
          link_title: 'A useful article',
          text_body: 'Worth a read',
          chat_id: 'gps-network@g.us',
          is_forwarded: false,
          gps_chat_labels: {
            chat_id: 'gps-network@g.us',
            slug: 'gps-action-network',
            label: 'GPS Action Network!',
            description: null,
            display_order: 1,
            color: '#3fb950',
            icon: '🎯',
            member_count: 190,
          },
        },
      ]),
    );

    const caller = createCaller(publicContext());
    const result = await caller.network.list({});

    expect(result).toMatchObject({
      items: expect.any(Array),
      nextCursor: null,
      fromCache: false,
    });
    expect(result.items[0]).toMatchObject({
      id: 1n,
      url: 'https://example.com/article',
      linkTitle: 'A useful article',
      fromName: 'Sharon',
      senderHash: 'hash-sharon',
      state: { status: 'NEW', ownerUserId: null, notes: null },
    });
  });

  it('rejects an out-of-range windowDays via Zod', async () => {
    const caller = createCaller(publicContext());

    await expect(
      caller.network.list({ windowDays: 9999 } as Parameters<typeof caller.network.list>[0]),
    ).rejects.toThrow();
  });

  it('rejects an out-of-range limit via Zod', async () => {
    const caller = createCaller(publicContext());

    await expect(
      caller.network.list({ limit: 999 } as Parameters<typeof caller.network.list>[0]),
    ).rejects.toThrow();
  });
});

describe('network.setCardState', () => {
  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const caller = createCaller(publicContext());

    await expect(
      caller.network.setCardState({ messageId: 1n, status: 'TRIAGED' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects when network_feed flag is off (FORBIDDEN)', async () => {
    mockFlagFindUnique.mockResolvedValueOnce({ enabledGlobally: false } as never);
    const caller = createCaller(authedContext());

    await expect(
      caller.network.setCardState({ messageId: 1n, status: 'TRIAGED' }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('rejects an unknown status via Zod', async () => {
    const caller = createCaller(authedContext());
    const badInput = { messageId: 1n, status: 'DELETED' } as unknown as Parameters<
      typeof caller.network.setCardState
    >[0];

    await expect(caller.network.setCardState(badInput)).rejects.toThrow();
  });

  it('upserts state on a valid call and returns the new state', async () => {
    mockUpsert.mockResolvedValueOnce({
      messageId: 1n,
      status: 'PROMOTED',
      ownerUserId: '00000000-0000-4000-8000-000000000001',
      ownerUser: { displayName: 'Test User' },
      notes: 'Picked up',
      updatedAt: new Date('2026-05-10T12:00:00Z'),
    } as never);

    const caller = createCaller(authedContext());
    const result = await caller.network.setCardState({
      messageId: 1n,
      status: 'PROMOTED',
      ownerUserId: '00000000-0000-4000-8000-000000000001',
      notes: 'Picked up',
    });

    expect(result.ok).toBe(true);
    expect(result.state.status).toBe('PROMOTED');
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
  });
});
