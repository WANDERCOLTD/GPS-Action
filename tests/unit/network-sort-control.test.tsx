/**
 * Unit tests for NetworkSortControl + parseSortParam.
 *
 * @build-unit bu-network-sort-options
 *
 * Same tree-walk pattern as the chip-strip / feed-filter tests —
 * invokes the component as a plain function, walks the ReactElement
 * tree, asserts hrefs and active state.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { NetworkSortControl, parseSortParam } from '@/components/NetworkSortControl';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    walk(e.props.children);
  };
  walk(el);
  return acc;
}

function optionsBySort(tree: AnyElement): Map<string, AnyElement> {
  const out = new Map<string, AnyElement>();
  for (const el of flatChildren(tree)) {
    if (el.props['data-testid'] === 'network-sort-option') {
      const sort = el.props['data-sort'];
      if (typeof sort === 'string') out.set(sort, el);
    }
  }
  return out;
}

describe('NetworkSortControl', () => {
  it('renders both Newest and Oldest options', () => {
    const tree = NetworkSortControl({ active: 'recent' }) as AnyElement;
    const opts = optionsBySort(tree);
    expect(opts.size).toBe(2);
    expect(opts.has('recent')).toBe(true);
    expect(opts.has('oldest')).toBe(true);
  });

  it('marks the active option with aria-current and data-active', () => {
    const tree = NetworkSortControl({ active: 'oldest' }) as AnyElement;
    const opts = optionsBySort(tree);
    expect(opts.get('oldest')?.props['aria-current']).toBe('page');
    expect(opts.get('oldest')?.props['data-active']).toBe('true');
    expect(opts.get('recent')?.props['data-active']).toBe('false');
  });

  it('points "Newest" (default) at the bare /network (param stripped)', () => {
    const tree = NetworkSortControl({ active: 'oldest' }) as AnyElement;
    const opts = optionsBySort(tree);
    expect(opts.get('recent')?.props.href).toBe('/network');
  });

  it('points "Oldest" at /network?sort=oldest', () => {
    const tree = NetworkSortControl({ active: 'recent' }) as AnyElement;
    const opts = optionsBySort(tree);
    expect(opts.get('oldest')?.props.href).toBe('/network?sort=oldest');
  });

  it('preserves source param when toggling sort', () => {
    const tree = NetworkSortControl({
      active: 'recent',
      preserveParams: { source: 'hendon-jag,gps-action-network' },
    }) as AnyElement;
    const opts = optionsBySort(tree);
    expect(opts.get('oldest')?.props.href).toBe(
      '/network?source=hendon-jag,gps-action-network&sort=oldest',
    );
    expect(opts.get('recent')?.props.href).toBe('/network?source=hendon-jag,gps-action-network');
  });

  it('omits preserved params that are undefined', () => {
    const tree = NetworkSortControl({
      active: 'recent',
      preserveParams: { source: undefined },
    }) as AnyElement;
    const opts = optionsBySort(tree);
    expect(opts.get('oldest')?.props.href).toBe('/network?sort=oldest');
    expect(opts.get('recent')?.props.href).toBe('/network');
  });
});

describe('parseSortParam', () => {
  it('returns "recent" for undefined / empty', () => {
    expect(parseSortParam(undefined)).toBe('recent');
  });

  it('returns the parsed value when it is a known option', () => {
    expect(parseSortParam('oldest')).toBe('oldest');
    expect(parseSortParam('recent')).toBe('recent');
  });

  it('falls back to "recent" on unknown / malformed input', () => {
    expect(parseSortParam('reacted')).toBe('recent');
    expect(parseSortParam('')).toBe('recent');
  });

  it('handles array form (?sort=a&sort=b — takes first)', () => {
    expect(parseSortParam(['oldest', 'recent'])).toBe('oldest');
  });
});
