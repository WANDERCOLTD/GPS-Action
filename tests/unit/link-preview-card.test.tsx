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
});
