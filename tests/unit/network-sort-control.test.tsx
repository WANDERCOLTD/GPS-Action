/**
 * Unit tests for NetworkSortControl + parseSortParam.
 *
 * @build-unit bu-network-sort-options bu-network-sort-toggle
 *
 * Same tree-walk pattern as the chip-strip / feed-filter tests —
 * invokes the component as a plain function, walks the ReactElement
 * tree, asserts hrefs and current-state attributes.
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

function toggle(tree: AnyElement): AnyElement | undefined {
  return flatChildren(tree).find((el) => el.props['data-testid'] === 'network-sort-toggle');
}

describe('NetworkSortControl', () => {
  it('renders one anchor with data-current reflecting the active sort', () => {
    const tree = NetworkSortControl({ active: 'recent' }) as AnyElement;
    const a = toggle(tree);
    expect(a).toBeDefined();
    expect(a?.props['data-current']).toBe('recent');
    expect(a?.props['data-next']).toBe('oldest');
  });

  it('when active=recent, href points at /network?sort=oldest (the flipped target)', () => {
    const tree = NetworkSortControl({ active: 'recent' }) as AnyElement;
    expect(toggle(tree)?.props.href).toBe('/network?sort=oldest');
  });

  it('when active=oldest, href points at /network (param stripped — back to default)', () => {
    const tree = NetworkSortControl({ active: 'oldest' }) as AnyElement;
    expect(toggle(tree)?.props.href).toBe('/network');
  });

  it('preserves source param when flipping sort', () => {
    const tree = NetworkSortControl({
      active: 'recent',
      preserveParams: { source: 'hendon-jag,gps-action-network' },
    }) as AnyElement;
    expect(toggle(tree)?.props.href).toBe(
      '/network?source=hendon-jag,gps-action-network&sort=oldest',
    );
  });

  it('omits preserved params that are undefined', () => {
    const tree = NetworkSortControl({
      active: 'recent',
      preserveParams: { source: undefined },
    }) as AnyElement;
    expect(toggle(tree)?.props.href).toBe('/network?sort=oldest');
  });

  it('aria-label describes the current state AND the action of tapping', () => {
    const tree = NetworkSortControl({ active: 'recent' }) as AnyElement;
    const label = toggle(tree)?.props['aria-label'];
    expect(typeof label).toBe('string');
    expect(label).toMatch(/Newest first/);
    expect(label).toMatch(/oldest/i);
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
