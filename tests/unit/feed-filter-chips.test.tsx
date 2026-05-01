/**
 * Unit tests for FeedFilterChips.
 *
 * @build-unit BU-feed-filter BU-icon-strips
 *
 * Vitest env is `node`, no RTL. Invoke the component as a plain
 * function and walk the ReactElement tree.
 *
 * BU-icon-strips: chips are now icons-only with two deliberate
 * non-lucide exceptions (AM brand glyph, tick-or-cross emoji) and
 * "All" as the text outlier. Tests assert each chip exposes its
 * label via `aria-label` (the SR / tooltip source of truth) rather
 * than via visible text.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { FeedFilterChips } from '@/components/FeedFilterChips';
import { IconChipTooltip } from '@/components/IconChipTooltip';
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
  it('renders one chip per known filter, each with aria-label set to its registered label', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    for (const filter of FEED_FILTERS) {
      const chip = findByTestId(tree, `feed-filter-${filter}`);
      expect(chip).toBeDefined();
      expect(chip?.props['aria-label']).toBe(FEED_FILTER_LABELS[filter]);
    }
  });

  it('the "All" chip retains visible text content (deliberate outlier)', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    const chip = findByTestId(tree, 'feed-filter-all');
    expect(flatStrings(chip)).toBe('All');
  });

  it('the tick-or-cross chip renders the literal "✅❌" emoji (deliberate exception)', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    const chip = findByTestId(tree, 'feed-filter-tick_or_cross');
    expect(flatStrings(chip)).toBe('✅❌');
  });

  it('the AM chip renders a brand <img>, not lucide / text', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    const chip = findByTestId(tree, 'feed-filter-activist_mailer');
    expect(chip).toBeDefined();
    const imgs = flatChildren(chip as AnyElement).filter((e) => e.type === 'img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.props.src).toBe('/brands/activist-mailer.webp');
  });

  it('icon-bearing chips (Urgent / Now / Meetings / Events) carry no visible text', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    for (const filter of ['urgent', 'happening_now', 'meeting', 'event'] as const) {
      const chip = findByTestId(tree, `feed-filter-${filter}`);
      expect(flatStrings(chip).trim()).toBe('');
    }
  });

  it('every chip is wrapped in IconChipTooltip with the registered label', () => {
    const tree = FeedFilterChips({ active: 'all' }) as AnyElement;
    const tooltips = flatChildren(tree).filter((e) => e.type === IconChipTooltip);
    expect(tooltips).toHaveLength(FEED_FILTERS.length);
    for (const filter of FEED_FILTERS) {
      const wrapping = tooltips.find((t) => {
        const child = t.props.children as AnyElement | undefined;
        return child?.props?.['data-testid'] === `feed-filter-${filter}`;
      });
      expect(wrapping).toBeDefined();
      expect(wrapping?.props.label).toBe(FEED_FILTER_LABELS[filter]);
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
