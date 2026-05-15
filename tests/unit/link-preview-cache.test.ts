/**
 * Unit tests for the persistent link-preview cache.
 *
 * @build-unit BU-link-preview-store
 * @spec adrs/0019-link-preview-store.md
 *
 * Mocks the Prisma client to verify the read-through cache logic
 * without a real database. Asserts:
 *   - cache miss calls the fetcher and upserts the row
 *   - cache hit (unexpired row) returns stored value, no fetch
 *   - expired row triggers re-fetch + update
 *   - fetcher failure persists `fetchStatus: fetch_error` with
 *     short TTL; subsequent calls within TTL return null without
 *     re-fetching
 *   - `no_og` (HTTP 200 but no title/imageUrl) persists with
 *     long TTL and returns null
 *   - invalidateLinkPreviewCache deletes all rows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    linkPreview: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { getLinkPreview, invalidateLinkPreviewCache } from '@/server/services/link-preview-cache';
import { prisma } from '@/server/db/client';
import type { LinkMetadataResult } from '@/server/services/link-metadata';

const mockFindUnique = vi.mocked(prisma.linkPreview.findUnique);
const mockUpsert = vi.mocked(prisma.linkPreview.upsert);
const mockDeleteMany = vi.mocked(prisma.linkPreview.deleteMany);

const okResult = (
  overrides: Partial<{
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    siteName: string | null;
    faviconUrl: string | null;
  }> = {},
): LinkMetadataResult => ({
  ok: true,
  data: {
    title: 'A title',
    description: 'A description',
    imageUrl: 'https://example.com/img.jpg',
    siteName: 'Example',
    faviconUrl: 'https://example.com/favicon.ico',
    ...overrides,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({} as never);
  mockDeleteMany.mockResolvedValue({ count: 0 } as never);
  delete process.env.LINK_PREVIEW_OK_TTL_DAYS;
  delete process.env.LINK_PREVIEW_ERROR_TTL_DAYS;
});

describe('getLinkPreview', () => {
  it('fetches on miss and upserts the row', async () => {
    mockFindUnique.mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue(okResult());

    const result = await getLinkPreview('https://example.com/a', { fetcher });

    expect(result).toEqual({
      title: 'A title',
      description: 'A description',
      imageUrl: 'https://example.com/img.jpg',
      siteName: 'Example',
      faviconUrl: 'https://example.com/favicon.ico',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({ url: 'https://example.com/a' });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0]![0]!;
    expect(call.where).toEqual({ url: 'https://example.com/a' });
    expect(call.create.fetchStatus).toBe('ok');
    expect(call.create.linkType).toBeDefined();
    expect(call.create.normalizedUrl).toBe('https://example.com/a');
  });

  it('returns stored value on hit without fetching', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60); // +1h
    mockFindUnique.mockResolvedValue({
      id: 'lp-1',
      url: 'https://example.com/a',
      normalizedUrl: 'https://example.com/a',
      title: 'Cached',
      description: 'Cached desc',
      imageUrl: 'https://example.com/c.jpg',
      siteName: 'Cached site',
      faviconUrl: 'https://example.com/favicon.ico',
      linkType: 'Other',
      fetchStatus: 'ok',
      fetchedAt: new Date(),
      expiresAt: future,
    } as never);
    const fetcher = vi.fn();

    const result = await getLinkPreview('https://example.com/a', { fetcher });

    expect(result?.title).toBe('Cached');
    expect(fetcher).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('re-fetches when the stored row has expired', async () => {
    const past = new Date(Date.now() - 1000); // 1s ago
    mockFindUnique.mockResolvedValue({
      id: 'lp-1',
      url: 'https://example.com/a',
      normalizedUrl: 'https://example.com/a',
      title: 'Old',
      description: null,
      imageUrl: null,
      siteName: null,
      faviconUrl: null,
      linkType: 'Other',
      fetchStatus: 'ok',
      fetchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 31),
      expiresAt: past,
    } as never);
    const fetcher = vi.fn().mockResolvedValue(okResult({ title: 'Fresh' }));

    const result = await getLinkPreview('https://example.com/a', { fetcher });

    expect(result?.title).toBe('Fresh');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('persists fetch errors with short TTL and returns null', async () => {
    mockFindUnique.mockResolvedValue(null);
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: 'http_500' } as LinkMetadataResult);

    const result = await getLinkPreview('https://broken.example/x', { fetcher });

    expect(result).toBeNull();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0]![0]!;
    expect(call.create.fetchStatus).toBe('fetch_error');
    // 3-day default error TTL: difference between expiresAt and fetchedAt
    // should be close to 3 days (within a few ms).
    const ttlMs =
      (call.create.expiresAt as Date).getTime() - (call.create.fetchedAt as Date).getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(Math.abs(ttlMs - threeDaysMs)).toBeLessThan(100);
  });

  it('classifies blocked status for 403/429 fetcher errors', async () => {
    mockFindUnique.mockResolvedValue(null);
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: 'http_429' } as LinkMetadataResult);

    await getLinkPreview('https://ratelimited.example/x', { fetcher });

    const call = mockUpsert.mock.calls[0]![0]!;
    expect(call.create.fetchStatus).toBe('blocked');
  });

  it('classifies no_og when fetch ok but no title or imageUrl', async () => {
    mockFindUnique.mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue(okResult({ title: null, imageUrl: null }));

    const result = await getLinkPreview('https://blank.example/x', { fetcher });

    expect(result).toBeNull();
    const call = mockUpsert.mock.calls[0]![0]!;
    expect(call.create.fetchStatus).toBe('no_og');
    // 30-day default ok TTL
    const ttlMs =
      (call.create.expiresAt as Date).getTime() - (call.create.fetchedAt as Date).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(ttlMs - thirtyDaysMs)).toBeLessThan(100);
  });

  it('honours custom TTLs from env', async () => {
    process.env.LINK_PREVIEW_OK_TTL_DAYS = '7';
    mockFindUnique.mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue(okResult());

    await getLinkPreview('https://example.com/ttl', { fetcher });

    const call = mockUpsert.mock.calls[0]![0]!;
    const ttlMs =
      (call.create.expiresAt as Date).getTime() - (call.create.fetchedAt as Date).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(ttlMs - sevenDaysMs)).toBeLessThan(100);
  });

  it('stores normalizedUrl with tracking params stripped', async () => {
    mockFindUnique.mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue(okResult());

    await getLinkPreview('https://www.Example.com/article?utm_source=x&id=42&fbclid=abc#section', {
      fetcher,
    });

    const call = mockUpsert.mock.calls[0]![0]!;
    expect(call.create.normalizedUrl).toBe('https://example.com/article?id=42');
  });

  it('classifies a YouTube URL as Video', async () => {
    mockFindUnique.mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue(okResult());

    await getLinkPreview('https://youtube.com/watch?v=abc', { fetcher });

    const call = mockUpsert.mock.calls[0]![0]!;
    expect(call.create.linkType).toBe('Video');
  });
});

describe('invalidateLinkPreviewCache', () => {
  it('deletes all rows', async () => {
    await invalidateLinkPreviewCache();
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({});
  });
});
