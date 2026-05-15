/**
 * @build-unit BU-hydration-fixes
 * @spec build/session-briefs/bu-hydration-fixes.md
 * @spec architecture/decision-log.md (D080)
 *
 * Asserts the deferred-origin behaviour added by BU-hydration-fixes.
 * We use `renderToString` to exercise the SSR pass exactly as Next.js
 * does:
 *
 *   - On the server, the rendered `href` is origin-independent — it
 *     embeds a relative `/post/<id>` path, NOT a fully-qualified URL.
 *     The server cannot read `window.location.origin`, so two requests
 *     landing on different hosts (e.g. `https://gpsaction.org.uk` vs
 *     `http://mba.local:3001` in dev) emit byte-identical HTML.
 *
 *   - The same render is deterministic regardless of the
 *     `NEXT_PUBLIC_SITE_ORIGIN` env var — i.e. the architectural fix
 *     no longer depends on the env var being set, which was the
 *     production risk surfaced in the brief.
 *
 *   - The visible UI on first paint still shows the WhatsApp glyph
 *     (the affordance is never hidden behind a disabled shell).
 *
 * The post-mount enrichment with the full origin is an effect that
 * fires only in a real DOM; tested manually per the brief (mDNS phone
 * testing). The analytics ping behaviour is unchanged from D067 and
 * is covered by `whatsapp-share-button-analytics.test.tsx`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { WhatsAppShareButton } from '@/components/WhatsAppShareButton';

// bu-spread-polish-responsive: WhatsAppShareButton was refactored to
// take a Shareable. Test fixture wraps the same fields as before.
const baseProps = {
  shareable: {
    url: '/post/p-12345',
    title: 'A boost-worthy post',
    body: 'Body of the post.',
    source: { type: 'post' as const, postId: 'p-12345' },
  },
};

describe('WhatsAppShareButton — server render is origin-independent (D080)', () => {
  let prevEnv: string | undefined;

  beforeEach(() => {
    prevEnv = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  });

  afterEach(() => {
    if (prevEnv === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
    } else {
      process.env.NEXT_PUBLIC_SITE_ORIGIN = prevEnv;
    }
  });

  it('emits an `href` whose embedded post URL is a relative `/post/<id>` path (no scheme, no host)', () => {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
    const html = renderToString(createElement(WhatsAppShareButton, baseProps));

    const hrefMatch = html.match(/href="([^"]+)"/);
    expect(hrefMatch).not.toBeNull();
    const href = hrefMatch![1]!;
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    const decoded = decodeURIComponent(href.replace('https://wa.me/?text=', ''));
    expect(decoded.endsWith('/post/p-12345')).toBe(true);
    // Crucially: no scheme/host in the embedded post link.
    expect(decoded).not.toMatch(/https?:\/\/[^/]+\/post\//);
  });

  it('emits the same `href` whether or not NEXT_PUBLIC_SITE_ORIGIN is set', () => {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
    const htmlA = renderToString(createElement(WhatsAppShareButton, baseProps));

    process.env.NEXT_PUBLIC_SITE_ORIGIN = 'https://gpsaction.org.uk';
    const htmlB = renderToString(createElement(WhatsAppShareButton, baseProps));

    process.env.NEXT_PUBLIC_SITE_ORIGIN = 'http://mba.local:3001';
    const htmlC = renderToString(createElement(WhatsAppShareButton, baseProps));

    expect(htmlA).toBe(htmlB);
    expect(htmlB).toBe(htmlC);
  });

  it('renders the WhatsApp glyph on first paint (button is never hidden)', () => {
    const html = renderToString(createElement(WhatsAppShareButton, baseProps));
    expect(html).toContain('data-testid="post-share-whatsapp"');
    expect(html).toContain('data-testid="whatsapp-share-icon"');
  });

  it('renders the pill variant with the "WhatsApp" label intact on SSR', () => {
    const html = renderToString(
      createElement(WhatsAppShareButton, { ...baseProps, variant: 'pill' as const }),
    );
    expect(html).toContain('WhatsApp');
    expect(html).toContain('data-variant="pill"');
  });
});
