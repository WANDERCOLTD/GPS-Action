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
    // Link-preview enrichment reads `network_link_previews` via
    // `isFeatureEnabled`. Default to null (= flag absent = disabled)
    // so existing tests don't trigger the OG fetch path.
    featureFlag: {
      findUnique: vi.fn(),
    },
    // bu-network-shares — listNetworkCards now projects share counts
    // via prisma.shareEvent.groupBy. Default to an empty result so
    // existing tests (which don't care about shares) stay green.
    shareEvent: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

import {
  listNetworkCards,
  setNetworkCardState,
  invalidateNetworkListCache,
  invalidateNetworkSourcesCache,
  _networkCacheSize,
} from '@/server/services/network';
import { prisma } from '@/server/db/client';

const mockFindMany = vi.mocked(prisma.networkCardState.findMany);
const mockUpsert = vi.mocked(prisma.networkCardState.upsert);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);
const mockFlagFindUnique = vi.mocked(prisma.featureFlag.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
  invalidateNetworkListCache();
  invalidateNetworkSourcesCache();
  mockAuditCreate.mockResolvedValue({} as never);
  mockFindMany.mockResolvedValue([]);
  // Default: flag row absent → fail-closed disabled → no OG fetch.
  mockFlagFindUnique.mockResolvedValue(null);
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
  is_forwarded: false,
};

// bu-network-source-chips — labels rows used by the service-side join.
// Tests that exercise the source field / source filter pass this through
// `fetchLabels`. Tests that don't care still need to pass it so the
// labels fetcher doesn't try to reach Supabase and degrade to empty.
const defaultLabels = [
  {
    chat_id: 'gps-network@g.us',
    slug: 'gps-action-network',
    label: 'GPS Action Network!',
    description: null,
    display_order: 1,
    color: '#3fb950',
    icon: '🎯',
    member_count: 190,
  },
];
const fetchLabels = () => Promise.resolve(defaultLabels);

describe('listNetworkCards', () => {
  it('returns cards with default NEW state when no NetworkCardState row exists', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
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
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(result.items[0]!.state.status).toBe('TRIAGED');
    expect(result.items[0]!.state.ownerDisplayName).toBe('Bette');
    expect(result.items[0]!.state.notes).toBe('Following up');
  });

  it('suppresses text_body when it equals the URL', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([{ ...baseRow, text_body: baseRow.url }]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(result.items[0]!.textBody).toBeNull();
  });

  it('preserves text_body when it differs from the URL', async () => {
    const fetchUpstream = vi
      .fn()
      .mockResolvedValue([{ ...baseRow, text_body: 'Worth a read this morning' }]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(result.items[0]!.textBody).toBe('Worth a read this morning');
  });

  it('hits cache on second identical call without refetching', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);

    const first = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );
    const second = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache when refresh: true', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);

    await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );
    const refreshed = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: true, sources: [] },
      { fetchUpstream, fetchLabels },
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
      { limit: 2, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(result.nextCursor).toBe('4');
  });

  it('emits no cursor when fewer rows than limit are returned', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([{ ...baseRow, id: 9 }]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(result.nextCursor).toBeNull();
  });

  it('preserves null from_name as anonymous-sender signal', async () => {
    const fetchUpstream = vi
      .fn()
      .mockResolvedValue([{ ...baseRow, from_name: null, sender_hash: 'hash-anon' }]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
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
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(result.fromCache).toBe(false);
    expect(_networkCacheSize()).toBe(0);
  });

  it('logs a breadcrumb when SupabaseConfigError is caught', async () => {
    const { SupabaseConfigError } = await import('@/server/lib/supabase');
    const fetchUpstream = vi
      .fn()
      .mockRejectedValue(
        new SupabaseConfigError('SUPABASE_URL and SUPABASE_ANON_KEY must be set.'),
      );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('SUPABASE_URL / SUPABASE_ANON_KEY missing'),
    );
    errorSpy.mockRestore();
  });

  it('propagates non-config errors (e.g. SupabaseFetchError) to the caller', async () => {
    const { SupabaseFetchError } = await import('@/server/lib/supabase');
    const fetchUpstream = vi.fn().mockRejectedValue(new SupabaseFetchError('upstream 503', 503));

    await expect(
      listNetworkCards(
        { limit: 50, windowDays: 90, refresh: false, sources: [] },
        { fetchUpstream, fetchLabels },
      ),
    ).rejects.toThrow('upstream 503');
  });

  describe('link-preview enrichment', () => {
    it('attaches resolved linkPreview metadata to each card', async () => {
      const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);
      const resolveLinkPreview = vi.fn().mockResolvedValue({
        title: 'Resolved title',
        description: 'Resolved description',
        imageUrl: 'https://example.com/og.jpg',
        siteName: 'Example',
        faviconUrl: 'https://example.com/favicon.ico',
      });

      const result = await listNetworkCards(
        { limit: 50, windowDays: 90, refresh: false, sources: [] },
        { fetchUpstream, resolveLinkPreview },
      );

      expect(resolveLinkPreview).toHaveBeenCalledWith(baseRow.url);
      expect(result.items[0]!.linkPreview).toEqual({
        title: 'Resolved title',
        description: 'Resolved description',
        imageUrl: 'https://example.com/og.jpg',
        siteName: 'Example',
        faviconUrl: 'https://example.com/favicon.ico',
      });
    });

    it('leaves linkPreview null when the resolver returns null (FF off / failure)', async () => {
      const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);
      const resolveLinkPreview = vi.fn().mockResolvedValue(null);

      const result = await listNetworkCards(
        { limit: 50, windowDays: 90, refresh: false, sources: [] },
        { fetchUpstream, resolveLinkPreview },
      );

      expect(result.items[0]!.linkPreview).toBeNull();
    });

    it('resolves previews in parallel across cards', async () => {
      const fetchUpstream = vi.fn().mockResolvedValue([
        { ...baseRow, id: 1, url: 'https://example.com/a' },
        { ...baseRow, id: 2, url: 'https://example.com/b' },
        { ...baseRow, id: 3, url: 'https://example.com/c' },
      ]);
      const calls: string[] = [];
      const resolveLinkPreview = vi.fn().mockImplementation(async (url: string) => {
        calls.push(`start:${url}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        calls.push(`end:${url}`);
        return null;
      });

      await listNetworkCards(
        { limit: 50, windowDays: 90, refresh: false, sources: [] },
        { fetchUpstream, resolveLinkPreview },
      );

      // All three resolvers start before any of them finish — proves
      // parallelism. Sequential execution would interleave start/end.
      expect(calls.slice(0, 3)).toEqual([
        'start:https://example.com/a',
        'start:https://example.com/b',
        'start:https://example.com/c',
      ]);
    });
  });
});

describe('setNetworkCardState', () => {
  it('upserts the state row, writes audit, and invalidates the cache', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);

    await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );
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

// ── bu-network-source-chips ──────────────────────────────────────────────

describe('listNetworkCards source filter', () => {
  const otherChatRow = {
    ...baseRow,
    id: 2,
    chat_id: 'hendon-jag@g.us',
  };
  const twoSourcesLabels = [
    ...defaultLabels,
    {
      chat_id: 'hendon-jag@g.us',
      slug: 'hendon-jag',
      label: 'Hendon JAG',
      description: 'Local action group',
      display_order: 2,
      color: '#dc2626',
      icon: '🚩',
      member_count: 80,
    },
  ];
  const fetchTwoLabels = () => Promise.resolve(twoSourcesLabels);

  /**
   * Smart upstream mock that honours `args.chatIds` the same way the
   * real PostgREST query would — filters the canned row set by
   * chat_id when a list is supplied. Mirrors the production
   * `chat_id=in.(...)` semantics, so assertions on result length
   * reflect what the wire actually delivers.
   */
  function smartFetchUpstream(rows: (typeof baseRow)[]) {
    return vi.fn().mockImplementation(async (args: { chatIds?: string[] }) => {
      if (!args.chatIds || args.chatIds.length === 0) return rows;
      const allowed = new Set(args.chatIds);
      return rows.filter((r) => allowed.has(r.chat_id));
    });
  }

  it('returns every row when sources is empty (no chatIds passed upstream)', async () => {
    const fetchUpstream = smartFetchUpstream([baseRow, otherChatRow]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels: fetchTwoLabels },
    );

    expect(result.items).toHaveLength(2);
    expect(fetchUpstream).toHaveBeenCalledWith(expect.objectContaining({ chatIds: undefined }));
  });

  it('pushes the slug filter upstream as a chat_id allowlist', async () => {
    const fetchUpstream = smartFetchUpstream([baseRow, otherChatRow]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: ['hendon-jag'] },
      { fetchUpstream, fetchLabels: fetchTwoLabels },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.source.slug).toBe('hendon-jag');
    expect(fetchUpstream).toHaveBeenCalledWith(
      expect.objectContaining({ chatIds: ['hendon-jag@g.us'] }),
    );
  });

  it('accepts multiple slugs (OR semantics) — chat_id allowlist is union', async () => {
    const fetchUpstream = smartFetchUpstream([baseRow, otherChatRow]);

    const result = await listNetworkCards(
      {
        limit: 50,
        windowDays: 90,
        refresh: false,
        sources: ['gps-action-network', 'hendon-jag'],
      },
      { fetchUpstream, fetchLabels: fetchTwoLabels },
    );

    expect(result.items).toHaveLength(2);
    const calls = fetchUpstream.mock.calls[0]![0] as { chatIds?: string[] };
    expect(calls.chatIds).toEqual(expect.arrayContaining(['gps-network@g.us', 'hendon-jag@g.us']));
  });

  it('short-circuits to empty when sources matches no known slug (no upstream call)', async () => {
    const fetchUpstream = smartFetchUpstream([baseRow, otherChatRow]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: ['retired-slug'] },
      { fetchUpstream, fetchLabels: fetchTwoLabels },
    );

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it('caches separately by source set (order-independent)', async () => {
    const fetchUpstream = smartFetchUpstream([baseRow, otherChatRow]);

    await listNetworkCards(
      {
        limit: 50,
        windowDays: 90,
        refresh: false,
        sources: ['gps-action-network', 'hendon-jag'],
      },
      { fetchUpstream, fetchLabels: fetchTwoLabels },
    );
    const second = await listNetworkCards(
      // Reversed slug order — same cache slot expected.
      {
        limit: 50,
        windowDays: 90,
        refresh: false,
        sources: ['hendon-jag', 'gps-action-network'],
      },
      { fetchUpstream, fetchLabels: fetchTwoLabels },
    );

    expect(second.fromCache).toBe(true);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
  });
});

describe('upstreamToCard source + isForwarded', () => {
  it('populates source from the labels Map by chat_id', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([baseRow]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(result.items[0]!.source).toEqual({
      slug: 'gps-action-network',
      label: 'GPS Action Network!',
      description: null,
      displayOrder: 1,
      color: '#3fb950',
      icon: '🎯',
      memberCount: 190,
    });
  });

  it('falls back to a synthetic source when no label row matches the chat_id', async () => {
    // chat_id has no entry in the labels Map — simulates a SUPABASE
    // config miss on the labels fetch, or a Grant-side timing window.
    const orphanRow = { ...baseRow, chat_id: 'unknown-chat@g.us' };
    const fetchUpstream = vi.fn().mockResolvedValue([orphanRow]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(result.items[0]!.source.slug).toBe('unknown');
    expect(result.items[0]!.source.label).toBe('unknown-chat@g.us');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no gps_chat_labels row for chat_id=unknown-chat@g.us'),
    );
    warnSpy.mockRestore();
  });

  it('passes is_forwarded through to the card', async () => {
    const forwardedRow = { ...baseRow, is_forwarded: true };
    const fetchUpstream = vi.fn().mockResolvedValue([forwardedRow]);

    const result = await listNetworkCards(
      { limit: 50, windowDays: 90, refresh: false, sources: [] },
      { fetchUpstream, fetchLabels },
    );

    expect(result.items[0]!.isForwarded).toBe(true);
  });
});

describe('listNetworkSources', () => {
  it('returns source set with rows mapped to NetworkSource', async () => {
    const { listNetworkSources } = await import('@/server/services/network');
    const fetchSources = vi.fn().mockResolvedValue([
      {
        chat_id: 'gps-network@g.us',
        slug: 'gps-action-network',
        label: 'GPS Action Network!',
        description: null,
        display_order: 1,
        color: '#3fb950',
        icon: '🎯',
        member_count: 190,
      },
    ]);

    const sources = await listNetworkSources({ fetchSources, bypassCache: true });

    expect(sources).toEqual([
      {
        slug: 'gps-action-network',
        label: 'GPS Action Network!',
        description: null,
        displayOrder: 1,
        color: '#3fb950',
        icon: '🎯',
        memberCount: 190,
      },
    ]);
  });

  it('degrades to an empty list when SUPABASE config is missing', async () => {
    const { listNetworkSources } = await import('@/server/services/network');
    const { SupabaseConfigError } = await import('@/server/lib/supabase');
    const fetchSources = vi
      .fn()
      .mockRejectedValue(
        new SupabaseConfigError('SUPABASE_URL and SUPABASE_ANON_KEY must be set.'),
      );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const sources = await listNetworkSources({ fetchSources, bypassCache: true });

    expect(sources).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('SUPABASE_URL / SUPABASE_ANON_KEY missing'),
    );
    errorSpy.mockRestore();
  });

  it('caches the source set across calls', async () => {
    const { listNetworkSources, invalidateNetworkSourcesCache } =
      await import('@/server/services/network');
    invalidateNetworkSourcesCache();
    const fetchSources = vi.fn().mockResolvedValue([
      {
        chat_id: 'gps-network@g.us',
        slug: 'gps-action-network',
        label: 'GPS Action Network!',
        description: null,
        display_order: 1,
        color: '#3fb950',
        icon: '🎯',
        member_count: 190,
      },
    ]);

    await listNetworkSources({ fetchSources });
    await listNetworkSources({ fetchSources });

    expect(fetchSources).toHaveBeenCalledTimes(1);
  });
});
