/**
 * Unit tests for AppNav.
 *
 * @build-unit BU-sticky-nav BU-icon-nav BU-search-surface
 * @spec architecture/decision-log.md (D054, D061, D065, D078)
 *
 * Vitest env is `node`, no RTL. We mock `next/navigation` so
 * `usePathname()` returns a controllable value; we then invoke AppNav
 * as a plain function and walk the ReactElement tree to assert the
 * contract.
 *
 * BU-icon-nav (2026-04-30): tabs are now icons-only. Tests assert
 * each tab's `aria-label` matches its prior text label so screen
 * readers continue to announce tab names. Text-content assertions
 * are gone (links no longer contain visible text); the `99+` cap
 * still applies to the unread badge.
 *
 * BU-search-surface (2026-05-03, PR C): magnifier trigger appended
 * to the strip. testid `appnav-search-trigger`, aria-label `Search`,
 * routes to `/search`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const usePathnameMock = vi.fn<() => string | null>(() => '/feed');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

const { AppNav } = await import('@/components/AppNav');
const { IconChipTooltip } = await import('@/components/IconChipTooltip');

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

const NAV_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['nav-feed-link', 'Feed'],
  ['nav-requests-link', 'Requests'],
  ['nav-settings-link', 'Settings'],
  ['appnav-search-trigger', 'Search'],
];

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
    // /data has no top-level tab — Data was demoted into the Settings page.
    // Keep the Settings tab lit while a member browses /data subpages.
    ['/data', 'nav-settings-link'],
    ['/data/users', 'nav-settings-link'],
    ['/settings', 'nav-settings-link'],
    // BU-search-surface — magnifier lights when on /search or /search/*
    ['/search', 'appnav-search-trigger'],
    ['/search/foo', 'appnav-search-trigger'],
  ])('highlights the right link when pathname is %s', (pathname, expectedActiveTestId) => {
    usePathnameMock.mockReturnValue(pathname);
    const tree = AppNav({}) as AnyElement;

    for (const [testId] of NAV_LINKS) {
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

    for (const [testId] of NAV_LINKS) {
      expect(isActive(findByTestId(tree, testId))).toBe(false);
    }
  });

  it('handles a null pathname (no active link)', () => {
    usePathnameMock.mockReturnValue(null);
    const tree = AppNav({}) as AnyElement;
    expect(isActive(findByTestId(tree, 'nav-feed-link'))).toBe(false);
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

  it('renders the dot alongside the Requests icon (not replacing it)', () => {
    // Regression guard: BU-icon-nav must keep the badge AND the icon.
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({ unreadNotificationCount: 5 }) as AnyElement;
    const link = findByTestId(tree, 'nav-requests-link');
    expect(link).toBeDefined();
    // The link must contain both the unread-dot span and at least one
    // additional child (the icon).
    const childArray = Array.isArray(link?.props.children)
      ? (link?.props.children as unknown[])
      : [link?.props.children];
    const dot = findByTestId(tree, 'nav-requests-unread-dot');
    expect(dot).toBeDefined();
    expect(childArray.length).toBeGreaterThan(1);
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
    for (const [testId] of NAV_LINKS) {
      expect(findByTestId(tree, testId)).toBeDefined();
    }
  });

  // ── BU-icon-nav: aria-labels for screen readers ────────────────────────

  it.each(NAV_LINKS)(
    '%s carries aria-label %s (icons-only nav still announces tab name)',
    (testId, expectedAriaLabel) => {
      usePathnameMock.mockReturnValue('/feed');
      const tree = AppNav({}) as AnyElement;
      const link = findByTestId(tree, testId);
      expect(link).toBeDefined();
      expect(link?.props['aria-label']).toBe(expectedAriaLabel);
    },
  );

  it('every nav link is an icon-only Link (no visible text content)', () => {
    // Regression guard: prevent accidental reintroduction of a text label.
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({ calendarEnabled: true }) as AnyElement;
    for (const [testId] of [...NAV_LINKS, ['nav-calendar-link', 'Calendar'] as const]) {
      const link = findByTestId(tree, testId);
      // Skip the unread badge text; check only direct text in the link itself.
      const directText = flatStrings(link?.props.children)
        .replace(/\d+|\+/g, '')
        .trim();
      expect(directText).toBe('');
    }
  });

  // ── BU-calendar-view / D073: Calendar tab gating ─────────────────────────

  it('omits the Calendar tab when calendarEnabled is unset / false', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({}) as AnyElement;
    expect(findByTestId(tree, 'nav-calendar-link')).toBeUndefined();
  });

  it('renders the Calendar tab when calendarEnabled is true', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({ calendarEnabled: true }) as AnyElement;
    const link = findByTestId(tree, 'nav-calendar-link');
    expect(link).toBeDefined();
    expect(link?.props['href']).toBe('/calendar');
    expect(link?.props['aria-label']).toBe('Calendar');
  });

  it('marks the Calendar tab active when on /calendar', () => {
    usePathnameMock.mockReturnValue('/calendar');
    const tree = AppNav({ calendarEnabled: true }) as AnyElement;
    expect(isActive(findByTestId(tree, 'nav-calendar-link'))).toBe(true);
    expect(isActive(findByTestId(tree, 'nav-feed-link'))).toBe(false);
  });

  // ── BU-icon-strips: tooltip primitive wraps every nav link ──────────────

  it.each([
    ['nav-feed-link', 'Feed'],
    ['nav-requests-link', 'Requests'],
    ['nav-settings-link', 'Settings'],
    ['appnav-search-trigger', 'Search'],
  ])('%s is wrapped in IconChipTooltip with label %s', (testId, expectedLabel) => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({}) as AnyElement;
    const tooltips = flatChildren(tree).filter((e) => e.type === IconChipTooltip);
    const wrapping = tooltips.find((t) => {
      const child = t.props.children as AnyElement | undefined;
      return child?.props?.['data-testid'] === testId;
    });
    expect(wrapping).toBeDefined();
    expect(wrapping?.props.label).toBe(expectedLabel);
  });

  it('Calendar tab is wrapped in IconChipTooltip when calendarEnabled', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({ calendarEnabled: true }) as AnyElement;
    const tooltips = flatChildren(tree).filter((e) => e.type === IconChipTooltip);
    const wrapping = tooltips.find((t) => {
      const child = t.props.children as AnyElement | undefined;
      return child?.props?.['data-testid'] === 'nav-calendar-link';
    });
    expect(wrapping).toBeDefined();
    expect(wrapping?.props.label).toBe('Calendar');
  });

  // ── BU-search-surface: magnifier trigger ────────────────────────────────

  it('renders the magnifier with href /search and aria-label Search', () => {
    usePathnameMock.mockReturnValue('/feed');
    const tree = AppNav({}) as AnyElement;
    const link = findByTestId(tree, 'appnav-search-trigger');
    expect(link).toBeDefined();
    expect(link?.props['href']).toBe('/search');
    expect(link?.props['aria-label']).toBe('Search');
  });

  it('lights the magnifier when on /search', () => {
    usePathnameMock.mockReturnValue('/search');
    const tree = AppNav({}) as AnyElement;
    expect(isActive(findByTestId(tree, 'appnav-search-trigger'))).toBe(true);
    expect(isActive(findByTestId(tree, 'nav-feed-link'))).toBe(false);
    expect(isActive(findByTestId(tree, 'nav-settings-link'))).toBe(false);
  });

  it('marks the Calendar tab active on a /calendar/* sub-path', () => {
    usePathnameMock.mockReturnValue('/calendar?view=month');
    const tree = AppNav({ calendarEnabled: true }) as AnyElement;
    // usePathname() does not include search params, so feed in a real path.
    usePathnameMock.mockReturnValue('/calendar/something');
    const tree2 = AppNav({ calendarEnabled: true }) as AnyElement;
    expect(isActive(findByTestId(tree2, 'nav-calendar-link'))).toBe(true);
    // The first test confirms the no-query-string pathname matches too.
    expect(findByTestId(tree, 'nav-calendar-link')).toBeDefined();
  });
});
