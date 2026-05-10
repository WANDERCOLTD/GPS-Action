/**
 * Unit tests for the URL-keyed link-preview cache.
 *
 * @build-unit BU-network-link-previews
 *
 * Stubs the underlying `fetchLinkMetadata` via the `deps.fetcher`
 * injection point. Asserts:
 *
 *   - cache miss calls the fetcher; subsequent hit does not
 *   - failure result (ok: false) is cached as null — broken URLs
 *     don't re-fetch on every list call
 *   - LRU evicts the oldest entry past the size cap
 *   - TTL expiry forces a re-fetch
 *   - invalidateLinkPreviewCache() clears all entries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getLinkPreview,
  invalidateLinkPreviewCache,
  _linkPreviewCacheSize,
} from '@/server/services/link-preview-cache';
import type { LinkMetadataResult } from '@/server/services/link-metadata';

const okMetadata = (overrides: Partial<LinkMetadataResult & { ok: true }> = {}) =>
  ({
    ok: true,
    data: {
      title: 'A title',
      description: 'A description',
      imageUrl: 'https://example.com/img.jpg',
      siteName: 'Example',
      ...((overrides as { data?: object }).data ?? {}),
    },
  }) as LinkMetadataResult;

beforeEach(() => {
  invalidateLinkPreviewCache();
  delete process.env.NETWORK_LINK_PREVIEW_TTL_SECONDS;
  delete process.env.NETWORK_LINK_PREVIEW_MAX_ENTRIES;
});

afterEach(() => {
  invalidateLinkPreviewCache();
  delete process.env.NETWORK_LINK_PREVIEW_TTL_SECONDS;
  delete process.env.NETWORK_LINK_PREVIEW_MAX_ENTRIES;
});

describe('getLinkPreview', () => {
  it('calls the fetcher on miss and returns the metadata', async () => {
    const fetcher = vi.fn().mockResolvedValue(okMetadata());

    const result = await getLinkPreview('https://example.com/a', { fetcher });

    expect(result).toEqual({
      title: 'A title',
      description: 'A description',
      imageUrl: 'https://example.com/img.jpg',
      siteName: 'Example',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({ url: 'https://example.com/a' });
  });

  it('hits the cache on the second call without re-fetching', async () => {
    const fetcher = vi.fn().mockResolvedValue(okMetadata());

    await getLinkPreview('https://example.com/a', { fetcher });
    await getLinkPreview('https://example.com/a', { fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('caches a fetcher failure as null — broken URLs do not re-fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, reason: 'http_404' });

    const first = await getLinkPreview('https://broken.example/x', { fetcher });
    const second = await getLinkPreview('https://broken.example/x', { fetcher });

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keys by URL — different URLs both fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue(okMetadata());

    await getLinkPreview('https://example.com/a', { fetcher });
    await getLinkPreview('https://example.com/b', { fetcher });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(_linkPreviewCacheSize()).toBe(2);
  });

  it('re-fetches after TTL expires', async () => {
    process.env.NETWORK_LINK_PREVIEW_TTL_SECONDS = '1';
    const fetcher = vi.fn().mockResolvedValue(okMetadata());
    const realNow = Date.now;

    try {
      await getLinkPreview('https://example.com/ttl', { fetcher });
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Advance the clock past the 1-second TTL.
      Date.now = () => realNow() + 2000;

      await getLinkPreview('https://example.com/ttl', { fetcher });
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      Date.now = realNow;
    }
  });

  it('evicts the oldest entry when size cap is reached', async () => {
    process.env.NETWORK_LINK_PREVIEW_MAX_ENTRIES = '3';
    const fetcher = vi.fn().mockResolvedValue(okMetadata());

    await getLinkPreview('https://example.com/1', { fetcher });
    await getLinkPreview('https://example.com/2', { fetcher });
    await getLinkPreview('https://example.com/3', { fetcher });
    expect(_linkPreviewCacheSize()).toBe(3);

    // 4th URL pushes out the oldest (url 1).
    await getLinkPreview('https://example.com/4', { fetcher });
    expect(_linkPreviewCacheSize()).toBe(3);

    // url 1 should now miss; url 2 should still hit.
    await getLinkPreview('https://example.com/2', { fetcher });
    await getLinkPreview('https://example.com/1', { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('promotes a hit to most-recently-used (LRU touch)', async () => {
    process.env.NETWORK_LINK_PREVIEW_MAX_ENTRIES = '3';
    const fetcher = vi.fn().mockResolvedValue(okMetadata());

    await getLinkPreview('https://example.com/1', { fetcher });
    await getLinkPreview('https://example.com/2', { fetcher });
    await getLinkPreview('https://example.com/3', { fetcher });

    // Touch url 1 — it becomes the most-recently-used.
    await getLinkPreview('https://example.com/1', { fetcher });

    // url 4 evicts the oldest, which is now url 2 (not url 1).
    await getLinkPreview('https://example.com/4', { fetcher });

    // url 1 still cached, url 2 evicted.
    await getLinkPreview('https://example.com/1', { fetcher });
    await getLinkPreview('https://example.com/2', { fetcher });

    // 1, 2, 3, 4, then re-fetch of evicted 2 = 5 total.
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('invalidateLinkPreviewCache wipes every entry', async () => {
    const fetcher = vi.fn().mockResolvedValue(okMetadata());

    await getLinkPreview('https://example.com/x', { fetcher });
    await getLinkPreview('https://example.com/y', { fetcher });
    expect(_linkPreviewCacheSize()).toBe(2);

    invalidateLinkPreviewCache();
    expect(_linkPreviewCacheSize()).toBe(0);

    await getLinkPreview('https://example.com/x', { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
