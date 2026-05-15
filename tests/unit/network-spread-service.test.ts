/**
 * Unit tests for the network-spread service.
 *
 * @build-unit BU-network-spread-gallery
 * @spec build/session-briefs/bu-network-spread-gallery.md
 *
 * Mocks both upstream (Grant's Supabase view) and the local
 * LinkPreview cache to verify dedup, source/type filtering, three
 * sort modes, and trending-score computation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    linkPreview: {
      findMany: vi.fn(),
    },
    sourceIconOverride: {
      findMany: vi.fn(),
    },
  },
}));

import { listNetworkSpread } from '@/server/services/network-spread';
import { prisma } from '@/server/db/client';
import type { GpsChatLabelRow, GpsGroupMessageRow } from '@/server/lib/supabase';

const mockFindMany = vi.mocked(prisma.linkPreview.findMany);

const labels: GpsChatLabelRow[] = [
  {
    chat_id: 'chat-action',
    slug: 'action',
    label: 'GPS Action Network!',
    description: null,
    display_order: 1,
    color: '#d85a30',
    icon: '🎯',
    member_count: 100,
  },
  {
    chat_id: 'chat-hendon',
    slug: 'hendon',
    label: 'Hendon WhatsApp',
    description: null,
    display_order: 2,
    color: '#6b3045',
    icon: '🟣',
    member_count: 50,
  },
];

function makeRow(
  overrides: Partial<GpsGroupMessageRow> & { id: number; chat_id: string },
): GpsGroupMessageRow {
  return {
    sent_at: new Date().toISOString(),
    from_name: 'Sender',
    sender_hash: 'hash',
    url: 'https://example.com/x',
    link_title: null,
    text_body: null,
    is_forwarded: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  delete process.env.NETWORK_SPREAD_TRENDING_WINDOW_HOURS;
});

describe('listNetworkSpread', () => {
  it('returns empty when upstream has no rows', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([]);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(result.tiles).toEqual([]);
    expect(result.windowDays).toBe(30);
  });

  it('dedups two messages with the same URL into one tile with ×2', async () => {
    const rows = [
      makeRow({
        id: 1,
        chat_id: 'chat-action',
        url: 'https://example.com/article',
        sent_at: '2026-05-14T09:00:00Z',
      }),
      makeRow({
        id: 2,
        chat_id: 'chat-hendon',
        url: 'https://example.com/article',
        sent_at: '2026-05-14T10:00:00Z',
      }),
    ];
    const fetchUpstream = vi.fn().mockResolvedValue(rows);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(result.tiles).toHaveLength(1);
    const tile = result.tiles[0]!;
    expect(tile.occurrenceCount).toBe(2);
    expect(tile.distinctSourceCount).toBe(2);
    expect(tile.firstSeenSource.slug).toBe('action');
  });

  it('dedups two messages with utm-different URLs into the same tile', async () => {
    const rows = [
      makeRow({
        id: 1,
        chat_id: 'chat-action',
        url: 'https://example.com/article?utm_source=a',
        sent_at: '2026-05-14T09:00:00Z',
      }),
      makeRow({
        id: 2,
        chat_id: 'chat-hendon',
        url: 'https://example.com/article?utm_source=b',
        sent_at: '2026-05-14T10:00:00Z',
      }),
    ];
    const fetchUpstream = vi.fn().mockResolvedValue(rows);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0]!.occurrenceCount).toBe(2);
  });

  it('keeps two distinct URLs as separate tiles', async () => {
    const rows = [
      makeRow({
        id: 1,
        chat_id: 'chat-action',
        url: 'https://example.com/a',
      }),
      makeRow({
        id: 2,
        chat_id: 'chat-hendon',
        url: 'https://example.com/b',
      }),
    ];
    const fetchUpstream = vi.fn().mockResolvedValue(rows);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(result.tiles).toHaveLength(2);
  });

  it('sorts by mostSpread descending by occurrence count', async () => {
    const rows = [
      makeRow({ id: 1, chat_id: 'chat-action', url: 'https://example.com/single' }),
      makeRow({ id: 2, chat_id: 'chat-action', url: 'https://example.com/triple' }),
      makeRow({ id: 3, chat_id: 'chat-action', url: 'https://example.com/triple' }),
      makeRow({ id: 4, chat_id: 'chat-action', url: 'https://example.com/triple' }),
    ];
    const fetchUpstream = vi.fn().mockResolvedValue(rows);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(result.tiles[0]!.url).toContain('triple');
    expect(result.tiles[0]!.occurrenceCount).toBe(3);
    expect(result.tiles[1]!.url).toContain('single');
  });

  it('sorts by mostRecent descending by lastSeenAt', async () => {
    const rows = [
      makeRow({
        id: 1,
        chat_id: 'chat-action',
        url: 'https://example.com/old',
        sent_at: '2026-05-10T09:00:00Z',
      }),
      makeRow({
        id: 2,
        chat_id: 'chat-action',
        url: 'https://example.com/new',
        sent_at: '2026-05-14T09:00:00Z',
      }),
    ];
    const fetchUpstream = vi.fn().mockResolvedValue(rows);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: [], sort: 'mostRecent' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(result.tiles[0]!.url).toContain('new');
  });

  it('applies the type filter using LinkPreview.linkType when cached', async () => {
    const rows = [
      makeRow({
        id: 1,
        chat_id: 'chat-action',
        url: 'https://youtube.com/watch?v=abc',
      }),
      makeRow({
        id: 2,
        chat_id: 'chat-action',
        url: 'https://x.com/some/post',
      }),
    ];
    const fetchUpstream = vi.fn().mockResolvedValue(rows);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: ['Video'], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0]!.linkType).toBe('Video');
  });

  it('resolves the source-chip filter into chat_ids passed upstream', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([]);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    await listNetworkSpread(
      { windowDays: 30, sources: ['hendon'], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(fetchUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        chatIds: ['chat-hendon'],
      }),
    );
  });

  it('returns empty if no chat_id matches the requested source slugs', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue([]);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: ['unknown-slug'], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(result.tiles).toEqual([]);
    // Upstream is NOT called when the source filter resolves to zero chats.
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it('caps at NETWORK_SPREAD_MAX_TILES', async () => {
    // 250 distinct URLs, capped at 200
    const rows: GpsGroupMessageRow[] = [];
    for (let i = 0; i < 250; i++) {
      rows.push(
        makeRow({
          id: i,
          chat_id: 'chat-action',
          url: `https://example.com/article-${i}`,
        }),
      );
    }
    const fetchUpstream = vi.fn().mockResolvedValue(rows);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    expect(result.tiles).toHaveLength(200);
  });

  it('carries URL-stripped textBody on each occurrence (ADR-0020)', async () => {
    const rows = [
      makeRow({
        id: 1,
        chat_id: 'chat-action',
        url: 'https://example.com/article',
        sent_at: '2026-05-14T09:00:00Z',
        text_body: 'Strong piece worth reading: https://example.com/article — thoughts?',
      }),
      makeRow({
        id: 2,
        chat_id: 'chat-hendon',
        url: 'https://example.com/article',
        sent_at: '2026-05-14T10:00:00Z',
        text_body: 'https://example.com/article',
      }),
    ];
    const fetchUpstream = vi.fn().mockResolvedValue(rows);
    const fetchLabels = vi.fn().mockResolvedValue(labels);

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides: async () => new Map() },
    );

    const occurrences = result.tiles[0]!.occurrences;
    expect(occurrences[0]!.textBody).toBe('Strong piece worth reading: — thoughts?');
    // Second occurrence was just the URL → stripped to '' → null on the wire.
    expect(occurrences[1]!.textBody).toBeNull();
  });

  it('decorates occurrence.source with iconOverride when one exists (ADR-0020)', async () => {
    const rows = [
      makeRow({
        id: 1,
        chat_id: 'chat-action',
        url: 'https://example.com/article',
      }),
    ];
    const fetchUpstream = vi.fn().mockResolvedValue(rows);
    const fetchLabels = vi.fn().mockResolvedValue(labels);
    const fetchOverrides = vi
      .fn()
      .mockResolvedValue(
        new Map([
          [
            'action',
            { iconKind: 'image' as const, imageUrl: '/source-icons/action.jpg', lucideKey: null },
          ],
        ]),
      );

    const result = await listNetworkSpread(
      { windowDays: 30, sources: [], types: [], sort: 'mostSpread' },
      { fetchUpstream, fetchLabels, fetchOverrides },
    );

    const occurrence = result.tiles[0]!.occurrences[0]!;
    expect(occurrence.source.iconOverride).toEqual({
      iconKind: 'image',
      imageUrl: '/source-icons/action.jpg',
      lucideKey: null,
    });
  });
});
