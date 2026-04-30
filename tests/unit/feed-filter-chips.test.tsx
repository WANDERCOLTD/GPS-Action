/**
 * Unit tests for FeedFilterChips.
 *
 * @build-unit BU-feed-filter
 *
 * Vitest env is `node`, no RTL. Invoke the component as a plain
 * function and walk the ReactElement tree.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { FeedFilterChips } from '@/components/FeedFilterChips';
import { FEED_FILTERS, FEED_FILTER_LABELS } from '@/shared/feed-filters';

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

function flatStrings(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatStrings).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return flatStrings((node as AnyElement).props.children);
  }
  return '';
}

describe('FeedFilterChips', () => {
  it('renders one chip per known filter with its label', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    for (const filter of FEED_FILTERS) {
      const chip = findByTestId(tree, `feed-filter-${filter}`);
      expect(chip).toBeDefined();
      expect(flatStrings(chip)).toBe(FEED_FILTER_LABELS[filter]);
    }
  });

  it('marks only the active chip with its tone modifier and aria-current', () => {
    // BU-feed-card-affordances — active state mirrors the kind palette of
    // the posts the filter surfaces. `urgent` filter → urgent palette.
    const tree = FeedFilterChips({ active: 'urgent' }) as AnyElement;
    for (const filter of FEED_FILTERS) {
      const chip = findByTestId(tree, `feed-filter-${filter}`);
      const className = chip?.props.className as string | undefined;
      const ariaCurrent = chip?.props['aria-current'];
      if (filter === 'urgent') {
        expect(className).toContain('gps-chip--urgent');
        expect(ariaCurrent).toBe('page');
      } else {
        // Non-active chips never carry a tone modifier.
        expect(className).toBe('gps-chip');
        expect(ariaCurrent).toBeUndefined();
      }
    }
  });

  it('routes "all" to /feed and other filters to /feed?filter=<slug>', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    expect(findByTestId(tree, 'feed-filter-all')?.props.href).toBe('/feed');
    expect(findByTestId(tree, 'feed-filter-urgent')?.props.href).toBe('/feed?filter=urgent');
    expect(findByTestId(tree, 'feed-filter-event')?.props.href).toBe('/feed?filter=event');
  });

  it('renders a visually-hidden h1 "Feed" for screen-reader landmark', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    const headings = flatChildren(tree).filter((e) => e.type === 'h1');
    expect(headings).toHaveLength(1);
    expect(flatStrings(headings[0])).toBe('Feed');
  });

  it('exposes the chip row as a labelled nav landmark', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    const nav = findByTestId(tree, 'feed-filter-chips');
    expect(nav).toBeDefined();
    expect(nav?.props['aria-label']).toBe('Feed filters');
  });
});
