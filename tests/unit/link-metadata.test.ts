/**
 * Unit tests for the OG / favicon metadata extractor.
 *
 * @build-unit bu-network-unfurl-fixes
 *
 * Pure parser — drives `extractMetadata` indirectly through the public
 * `fetchLinkMetadata` entry point by stubbing global `fetch`. Each test
 * primes a canned HTML response and asserts what we pull out of `<head>`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchLinkMetadata } from '@/server/services/link-metadata';

function htmlResponse(body: string, finalUrl = 'https://example.test/page'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    // jsdom-less Response doesn't expose `url` on construction — patch it
    // so `res.url` (which the extractor uses as the base for relative URL
    // resolution) reflects the post-redirect URL.
  }) as Response & { url: string };
}

function primeFetch(body: string, finalUrl: string): ReturnType<typeof vi.fn> {
  const res = htmlResponse(body);
  Object.defineProperty(res, 'url', { value: finalUrl, configurable: true });
  const stub = vi.fn().mockResolvedValue(res);
  vi.stubGlobal('fetch', stub);
  return stub;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLinkMetadata · favicon', () => {
  it('extracts <link rel="icon"> as the favicon', async () => {
    primeFetch(
      `<html><head>
        <title>x</title>
        <link rel="icon" href="/static/favicon.ico" />
      </head><body></body></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.faviconUrl).toBe('https://example.test/static/favicon.ico');
    }
  });

  it('extracts <link rel="shortcut icon">', async () => {
    primeFetch(
      `<html><head>
        <link rel="shortcut icon" href="https://cdn.example.test/icon.png" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.faviconUrl).toBe('https://cdn.example.test/icon.png');
    }
  });

  it('extracts apple-touch-icon when present (preferred over basic icon when larger)', async () => {
    primeFetch(
      `<html><head>
        <link rel="icon" sizes="16x16" href="/small.ico" />
        <link rel="apple-touch-icon" href="/touch-180.png" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // apple-touch-icon scores 180; 16x16 icon scores 16 → apple wins.
      expect(result.data.faviconUrl).toBe('https://example.test/touch-180.png');
    }
  });

  it('prefers the icon entry with the largest declared sizes', async () => {
    primeFetch(
      `<html><head>
        <link rel="icon" sizes="16x16" href="/16.png" />
        <link rel="icon" sizes="192x192" href="/192.png" />
        <link rel="icon" sizes="32x32" href="/32.png" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.faviconUrl).toBe('https://example.test/192.png');
    }
  });

  it('falls back to /favicon.ico when no <link rel="icon"> is present', async () => {
    primeFetch(
      `<html><head><title>x</title></head><body></body></html>`,
      'https://www.cufi.org.uk/events/11feb2026/',
    );

    const result = await fetchLinkMetadata({ url: 'https://www.cufi.org.uk/events/11feb2026/' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.faviconUrl).toBe('https://www.cufi.org.uk/favicon.ico');
    }
  });

  it('resolves relative href against the post-redirect URL', async () => {
    primeFetch(
      `<html><head>
        <link rel="icon" href="../assets/icon.png" />
      </head></html>`,
      'https://example.test/section/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/section/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.faviconUrl).toBe('https://example.test/assets/icon.png');
    }
  });

  it('tolerates href before rel in attribute order', async () => {
    primeFetch(
      `<html><head>
        <link href="/icon.svg" rel="icon" type="image/svg+xml" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.faviconUrl).toBe('https://example.test/icon.svg');
    }
  });
});

describe('fetchLinkMetadata · HTML entity decoding', () => {
  it('decodes hex numeric refs in og:title (e.g. &#xb7; → ·)', async () => {
    primeFetch(
      `<html><head>
        <meta property="og:title" content="455K views &#xb7; 30K reactions" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('455K views · 30K reactions');
    }
  });

  it('decodes hex refs for curly apostrophe (&#x2019;) in og:description', async () => {
    primeFetch(
      `<html><head>
        <meta property="og:title" content="t" />
        <meta property="og:description" content="Republic&#x2019;s dictators" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.description).toBe('Republic’s dictators');
    }
  });

  it('decodes decimal numeric refs (&#8217; → ’)', async () => {
    primeFetch(
      `<html><head>
        <meta property="og:title" content="That&#8217;s great" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('That’s great');
    }
  });

  it('still decodes the named-ref short list (&amp; &quot; &lt; &gt; &nbsp;)', async () => {
    primeFetch(
      `<html><head>
        <meta property="og:title" content="A &amp; B &quot;C&quot; &lt;D&gt;&nbsp;E" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('A & B "C" <D> E');
    }
  });

  it('passes through unknown / malformed refs unchanged', async () => {
    primeFetch(
      `<html><head>
        <meta property="og:title" content="Unknown &foo; ref" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('Unknown &foo; ref');
    }
  });

  it('passes through out-of-range codepoints unchanged (no throw)', async () => {
    primeFetch(
      // 0x110000 is one beyond the Unicode max — fromCodePoint throws.
      `<html><head>
        <meta property="og:title" content="bad &#x110000; ref" />
      </head></html>`,
      'https://example.test/page',
    );

    const result = await fetchLinkMetadata({ url: 'https://example.test/page' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('bad &#x110000; ref');
    }
  });
});
