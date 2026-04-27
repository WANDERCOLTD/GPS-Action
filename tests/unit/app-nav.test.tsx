/**
 * Unit tests for AppNav.
 *
 * @build-unit BU-sticky-nav
 * @spec architecture/decision-log.md (D054, D061, D065)
 *
 * Vitest env is `node`, no RTL. We mock `next/navigation` so
 * `usePathname()` returns a controllable value; we then invoke AppNav
 * as a plain function and walk the ReactElement tree to assert the
 * contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const usePathnameMock = vi.fn<() => string | null>(() => '/feed');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

const { AppNav } = await import('@/components/AppNav');

type AnyElement = ReactElement<Record<string, unknown>>;

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

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return flatChildren(el).find((e) => e.props['data-testid'] === testId);
}

function isActive(link: AnyElement | undefined): boolean {
  // Active style sets fontWeight: 600. linkStyle does not set fontWeight.
  const style = link?.props.style as { fontWeight?: number } | undefined;
  return style?.fontWeight === 600;
}

function flatStrings(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatStrings).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return flatStrings((node as AnyElement).props.children);
  }
  return '';
}

describe('AppNav', () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  // ── pathname-driven active highlighting ────────────────────────────────

  it.each([
    ['/feed', 'nav-feed-link'],
    ['/feed/something', 'nav-feed-link'],
    ['/requests', 'nav-requests-link'],
    ['/requests/abc-123', 'nav-requests-link'],
    ['/data', 'nav-data-link'],
    ['/data/users', 'nav-data-link'],
    ['/settings', 'nav-settings-link'],
  ])('highlights the right link when pathname is %s', (pathname, expectedActiveTestId) => {
    usePathnameMock.mockReturnValue(pathname);
    const tree = AppNav({}) as AnyElement;

    const allLinks = ['nav-feed-link', 'nav-requests-link', 'nav-data-link', 'nav-settings-link'];
    for (const testId of allLinks) {
      const link = findByTestId(tree, testId);
      expect(link).toBeDefined();
      if (testId === expectedActiveTestId) {
        expect(isActive(link)).toBe(true);
      } else {
        expect(isActive(link)).toBe(false);
      }
    }
  });

  it('highlights no link when pathname does not match any nav route', () => {
    usePathnameMock.mockReturnValue('/some/other/path');
    const tree = AppNav({}) as AnyElement;

    for (const testId of [
      'nav-feed-link',
      'nav-requests-link',
      'nav-data-link',
      'nav-settings-link',
    ]) {
      expect(isActive(findByTestId(tree, testId))).toBe(false);
    }
  });

  it('handles a null pathname (no active link)', () => {
    usePathnameMock.mockReturnValue(null);
    const tree = AppNav({}) as AnyElement;
    expect(isActive(findByTestId(tree, 'nav-feed-link'))).toBe(false);
  });

  // ── reviewer suffix ────────────────────────────────────────────────────

  it('appends "(reviewer)" to the Requests link when hasReviewerAccess is true', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({ hasReviewerAccess: true }) as AnyElement;
    const link = findByTestId(tree, 'nav-requests-link');
    expect(flatStrings(link)).toContain('(reviewer)');
  });

  it('omits "(reviewer)" when hasReviewerAccess is false / unset', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({}) as AnyElement;
    const link = findByTestId(tree, 'nav-requests-link');
    expect(flatStrings(link)).not.toContain('(reviewer)');
  });

  // ── unread dot ─────────────────────────────────────────────────────────

  it('renders the unread-count dot when count > 0', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({ unreadNotificationCount: 3 }) as AnyElement;
    const dot = findByTestId(tree, 'nav-requests-unread-dot');
    expect(dot).toBeDefined();
    expect(dot?.props['data-count']).toBe(3);
    expect(dot?.props['aria-label']).toBe('3 unread notifications');
  });

  it('omits the dot when count is 0 / unset', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({}) as AnyElement;
    expect(findByTestId(tree, 'nav-requests-unread-dot')).toBeUndefined();
  });

  it('caps the displayed count at 99+', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({ unreadNotificationCount: 153 }) as AnyElement;
    const dot = findByTestId(tree, 'nav-requests-unread-dot');
    expect(flatStrings(dot)).toBe('99+');
  });

  // ── strip-level testid stability ───────────────────────────────────────

  it('renders the canonical nav-app-strip testid', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({}) as AnyElement;
    expect(findByTestId(tree, 'nav-app-strip')).toBeDefined();
  });

  it('renders all four canonical link testids', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({}) as AnyElement;
    for (const testId of [
      'nav-feed-link',
      'nav-requests-link',
      'nav-data-link',
      'nav-settings-link',
    ]) {
      expect(findByTestId(tree, testId)).toBeDefined();
    }
  });
});
