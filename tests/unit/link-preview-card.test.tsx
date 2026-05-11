/**
 * Unit tests for the LinkPreviewCard primitive.
 *
 * @build-unit BU-link-share
 * @spec architecture/decision-log.md (D060, D061)
 *
 * No DOM here (vitest env is `node`, no RTL). We invoke the component
 * function directly and walk the ReactElement tree to assert structure
 * and prop forwarding. The tap contract from D061 (single anchor, no
 * nested interactive elements) is verifiable from the element shape.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';

type AnyElement = ReactElement<Record<string, unknown>>;

function render(props: Parameters<typeof LinkPreviewCard>[0]): AnyElement {
  return LinkPreviewCard(props) as AnyElement;
}

function findChild(el: AnyElement, predicate: (e: AnyElement) => boolean): AnyElement | undefined {
  if (predicate(el)) return el;
  const children = (el.props.children ?? []) as unknown;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child && typeof child === 'object' && 'props' in child) {
      const found = findChild(child as AnyElement, predicate);
      if (found) return found;
    }
  }
  return undefined;
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return findChild(el, (e) => e.props['data-testid'] === testId);
}

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    const c = e.props.children;
    if (Array.isArray(c)) c.forEach(walk);
    else walk(c);
  };
  walk(el);
  return acc;
}

describe('LinkPreviewCard', () => {
  const baseProps = {
    linkUrl: 'https://www.theguardian.com/uk-news/2026/may/01/example',
    linkTitle: 'Bill X passes second reading — what it means',
    linkDescription: 'A clear summary of the changes the bill introduces.',
    linkImageUrl: 'https://images.guardian.example/article.jpg',
    linkSiteName: 'The Guardian',
    size: 'small' as const,
  };

  // ── monolithic anchor / D061 contract ────────────────────────────────

  it('renders a single anchor with target=_blank and rel=noopener noreferrer', () => {
    const el = render(baseProps);
    expect(el.type).toBe('a');
    expect(el.props.href).toBe(baseProps.linkUrl);
    expect(el.props.target).toBe('_blank');
    expect(el.props.rel).toBe('noopener noreferrer');
  });

  it('contains no nested interactive elements (D061: monolithic tap target)', () => {
    const el = render(baseProps);
    // Walk all descendants. Skip the root anchor itself.
    const descendants = flatChildren(el).slice(1);
    for (const child of descendants) {
      expect(child.type).not.toBe('a');
      expect(child.type).not.toBe('button');
    }
  });

  it('carries data-testid="link-preview-card" + data-link-url + data-size', () => {
    const el = render(baseProps);
    expect(el.props['data-testid']).toBe('link-preview-card');
    expect(el.props['data-link-url']).toBe(baseProps.linkUrl);
    expect(el.props['data-size']).toBe('small');
  });

  // ── fallback rules ───────────────────────────────────────────────────

  it('falls back to URL host when linkSiteName is missing', () => {
    const el = render({ ...baseProps, linkSiteName: null });
    const text = JSON.stringify(el);
    expect(text).toContain('theguardian.com');
  });

  it('falls back to URL host when linkTitle is missing', () => {
    const el = render({ ...baseProps, linkTitle: null });
    const text = JSON.stringify(el);
    expect(text).toContain('theguardian.com');
  });

  it('omits the description block when linkDescription is missing', () => {
    const el = render({ ...baseProps, linkDescription: null });
    // Find description text in the rendered tree
    const text = JSON.stringify(el);
    expect(text).not.toContain('A clear summary');
  });

  // ── size variants ────────────────────────────────────────────────────

  it('renders size="small" with data-size attribute set to "small"', () => {
    const el = render({ ...baseProps, size: 'small' });
    expect(el.props['data-size']).toBe('small');
  });

  it('renders size="large" with data-size attribute set to "large"', () => {
    const el = render({ ...baseProps, size: 'large' });
    expect(el.props['data-size']).toBe('large');
  });

  // ── AM brand mark (D060 §3) ──────────────────────────────────────────

  it('does NOT render the AM brand mark by default (isAmAction defaults false)', () => {
    const el = render(baseProps);
    const mark = findByTestId(el, 'link-preview-card-am-mark');
    expect(mark).toBeUndefined();
    expect(el.props['data-am-action']).toBeUndefined();
  });

  it('renders the AM brand mark when isAmAction=true', () => {
    const el = render({ ...baseProps, isAmAction: true });
    const mark = findByTestId(el, 'link-preview-card-am-mark');
    expect(mark).toBeDefined();
    expect(el.props['data-am-action']).toBe(true);
  });

  // ── BU-am-link-collapse: render-time auto-detection + CTA ────────────

  it('auto-detects an AM domain in linkUrl when isAmAction is undefined', () => {
    const el = render({
      ...baseProps,
      linkUrl: 'https://activistmailer.com/c/abc123',
      linkSiteName: null,
      linkTitle: null,
    });
    expect(el.props['data-am-action']).toBe(true);
    const mark = findByTestId(el, 'link-preview-card-am-mark');
    expect(mark).toBeDefined();
  });

  it('renders "Send email →" CTA when AM is detected', () => {
    const el = render({
      ...baseProps,
      linkUrl: 'https://activistmailer.com/c/abc123',
    });
    const cta = findByTestId(el, 'link-preview-card-cta');
    expect(cta).toBeDefined();
    expect(JSON.stringify(cta)).toContain('Send email');
  });

  it('renders "Open link →" CTA for non-AM domains', () => {
    const el = render(baseProps);
    const cta = findByTestId(el, 'link-preview-card-cta');
    expect(cta).toBeDefined();
    expect(JSON.stringify(cta)).toContain('Open link');
  });

  it('explicit isAmAction=false overrides auto-detection on AM URLs', () => {
    const el = render({
      ...baseProps,
      linkUrl: 'https://activistmailer.com/c/abc123',
      isAmAction: false,
    });
    const mark = findByTestId(el, 'link-preview-card-am-mark');
    expect(mark).toBeUndefined();
    const cta = findByTestId(el, 'link-preview-card-cta');
    expect(JSON.stringify(cta)).toContain('Open link');
  });

  // ── bu-network-unfurl-fixes: favicon fallback ────────────────────────

  describe('favicon fallback (no og:image)', () => {
    const baseFaviconProps = {
      linkUrl: 'https://www.cufi.org.uk/events/11feb2026/',
      linkTitle: 'An event title',
      linkDescription: null,
      linkImageUrl: null,
      linkSiteName: 'CUFI',
      linkFaviconUrl: 'https://www.cufi.org.uk/favicon.ico',
      size: 'large' as const,
    };

    it('collapses the hero block when linkImageUrl is null', () => {
      const el = render(baseFaviconProps);
      expect(el.props['data-has-hero']).toBe('false');
      // The image div is gated on hasHero — its presence is detectable
      // via the inline backgroundImage style key. With no hero, there
      // is no descendant carrying that style.
      const descendants = flatChildren(el).slice(1);
      const withBg = descendants.find((e) => {
        const s = e.props.style as { backgroundImage?: unknown } | undefined;
        return s && 'backgroundImage' in s;
      });
      expect(withBg).toBeUndefined();
    });

    it('renders the favicon img in the site row when no hero', () => {
      const el = render(baseFaviconProps);
      const favicon = findByTestId(el, 'link-preview-card-favicon');
      expect(favicon).toBeDefined();
      expect(favicon?.type).toBe('img');
      expect(favicon?.props.src).toBe('https://www.cufi.org.uk/favicon.ico');
      expect(favicon?.props.alt).toBe('');
    });

    it('does NOT render the favicon when a hero image IS present', () => {
      const el = render({
        ...baseFaviconProps,
        linkImageUrl: 'https://example.com/hero.jpg',
      });
      expect(el.props['data-has-hero']).toBe('true');
      expect(findByTestId(el, 'link-preview-card-favicon')).toBeUndefined();
    });

    it('does NOT render the favicon when no favicon URL is supplied', () => {
      const el = render({ ...baseFaviconProps, linkFaviconUrl: null });
      expect(findByTestId(el, 'link-preview-card-favicon')).toBeUndefined();
    });

    it('drops the min-height reservation on small variant when no hero', () => {
      const el = render({ ...baseFaviconProps, size: 'small' });
      const style = el.props.style as { minHeight?: number | undefined };
      expect(style.minHeight).toBeUndefined();
    });
  });

  // ── Host-duplication dedup (BU-link-preview-dedup) ───────────────────
  //
  // When linkTitle AND linkSiteName are both null, the naive fallback
  // would print the URL host twice (once as the small-caps site row,
  // once as the large-text title). Small-variant cards drop the site
  // row; large-variant cards keep the site row and put the path in the
  // title slot.

  describe('host-duplication dedup', () => {
    it('small + null title + null site → drops site row, host shown only once', () => {
      const el = render({
        linkUrl: 'https://example-host.test/news/uk-12345',
        linkTitle: null,
        linkSiteName: null,
        size: 'small',
      });
      const descendants = flatChildren(el).slice(1);

      // Site row is rendered as a <span> wrapping the host string. When
      // the row is dropped, no <span> in the tree should carry the host
      // as a direct text child.
      const siteRowSpans = descendants.filter(
        (e) =>
          e.type === 'span' &&
          typeof e.props.children === 'string' &&
          e.props.children === 'example-host.test',
      );
      expect(siteRowSpans).toHaveLength(0);

      // Title row (<h3>) shows the host exactly once.
      const titleNodes = descendants.filter(
        (e) =>
          e.type === 'h3' &&
          typeof e.props.children === 'string' &&
          e.props.children === 'example-host.test',
      );
      expect(titleNodes).toHaveLength(1);

      // Host as a display value appears exactly once across all
      // displayed text nodes (so no double-print).
      const displayedHostCount = descendants.filter(
        (e) => typeof e.props.children === 'string' && e.props.children === 'example-host.test',
      ).length;
      expect(displayedHostCount).toBe(1);
    });

    it('small + null title + populated site → both rows present, no dedup change', () => {
      const el = render({
        linkUrl: 'https://bbc.co.uk/news/uk-12345',
        linkTitle: null,
        linkSiteName: 'BBC News',
        size: 'small',
      });
      const text = JSON.stringify(el);
      // Site row shows the explicit site name; title row shows the host.
      expect(text).toContain('BBC News');
      expect(text).toContain('bbc.co.uk');
    });

    it('small + populated title → site row + title both render', () => {
      const el = render({
        linkUrl: 'https://bbc.co.uk/news/uk-12345',
        linkTitle: 'UK headline of the day',
        linkSiteName: null,
        size: 'small',
      });
      const text = JSON.stringify(el);
      expect(text).toContain('UK headline of the day');
      // Site row falls back to host (legacy behaviour preserved).
      expect(text).toContain('bbc.co.uk');
    });

    it('large + null title + null site → site row shows host, title shows pathname', () => {
      const el = render({
        linkUrl: 'https://bbc.co.uk/news/uk-12345',
        linkTitle: null,
        linkSiteName: null,
        size: 'large',
      });
      const text = JSON.stringify(el);
      // Site row keeps the host…
      expect(text).toContain('bbc.co.uk');
      // …and the title is the URL path (so the two rows show DIFFERENT
      // info, no duplication).
      expect(text).toContain('/news/uk-12345');
    });

    it('large + null title + null site + bare-domain URL → title falls back to full URL', () => {
      const el = render({
        linkUrl: 'https://bbc.co.uk/',
        linkTitle: null,
        linkSiteName: null,
        size: 'large',
      });
      const text = JSON.stringify(el);
      // Title slot shows the full URL when there's no meaningful path.
      expect(text).toContain('https://bbc.co.uk/');
    });

    it('large + null title + populated site → site row shows site name, title shows host', () => {
      const el = render({
        linkUrl: 'https://bbc.co.uk/news/uk-12345',
        linkTitle: null,
        linkSiteName: 'BBC News',
        size: 'large',
      });
      const text = JSON.stringify(el);
      expect(text).toContain('BBC News');
      // Title row gets the host (today's behaviour, unchanged).
      expect(text).toContain('bbc.co.uk');
    });
  });
});
