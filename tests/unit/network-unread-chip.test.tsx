/**
 * @build-unit bu-network-seen-state
 *
 * Unit tests for `<NetworkUnreadChip>` + `parseUnreadParam`. Walks
 * the ReactElement tree (no RTL — vitest env is `node`).
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { NetworkUnreadChip, parseUnreadParam } from '@/components/NetworkUnreadChip';

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

describe('parseUnreadParam', () => {
  it('returns false for absent / non-truthy values', () => {
    expect(parseUnreadParam(undefined)).toBe(false);
    expect(parseUnreadParam('')).toBe(false);
    expect(parseUnreadParam('0')).toBe(false);
    expect(parseUnreadParam('no')).toBe(false);
    expect(parseUnreadParam('false')).toBe(false);
  });

  it('returns true for the recognised truthy values', () => {
    expect(parseUnreadParam('1')).toBe(true);
    expect(parseUnreadParam('true')).toBe(true);
    expect(parseUnreadParam('YES')).toBe(true);
    expect(parseUnreadParam('on')).toBe(true);
  });

  it('takes the first element when given an array', () => {
    expect(parseUnreadParam(['1', '0'])).toBe(true);
    expect(parseUnreadParam(['0', '1'])).toBe(false);
  });
});

describe('NetworkUnreadChip', () => {
  it('renders an inactive chip with href that adds unread=1', () => {
    const tree = NetworkUnreadChip({ active: false }) as AnyElement;
    const chip = findByTestId(tree, 'network-unread-chip');
    expect(chip).toBeDefined();
    expect(chip?.props.href).toBe('/network?unread=1');
    expect(chip?.props['data-active']).toBe('false');
    expect(chip?.props['aria-current']).toBeUndefined();
  });

  it('renders an active chip with href that omits unread (toggling off)', () => {
    const tree = NetworkUnreadChip({ active: true }) as AnyElement;
    const chip = findByTestId(tree, 'network-unread-chip');
    expect(chip?.props.href).toBe('/network');
    expect(chip?.props['data-active']).toBe('true');
    expect(chip?.props['aria-current']).toBe('page');
  });

  it('preserves source + sort params when toggling on', () => {
    const tree = NetworkUnreadChip({
      active: false,
      preserveParams: { source: 'gps-action-network,activist-mailer', sort: 'oldest' },
    }) as AnyElement;
    const chip = findByTestId(tree, 'network-unread-chip');
    expect(chip?.props.href).toBe(
      '/network?unread=1&source=gps-action-network%2Cactivist-mailer&sort=oldest',
    );
  });

  it('preserves params when toggling off', () => {
    const tree = NetworkUnreadChip({
      active: true,
      preserveParams: { source: 'gps-action-network', sort: undefined },
    }) as AnyElement;
    const chip = findByTestId(tree, 'network-unread-chip');
    expect(chip?.props.href).toBe('/network?source=gps-action-network');
  });

  it('uses the active gps-chip class when active', () => {
    const off = NetworkUnreadChip({ active: false }) as AnyElement;
    expect(findByTestId(off, 'network-unread-chip')?.props.className).toBe('gps-chip');
    const on = NetworkUnreadChip({ active: true }) as AnyElement;
    expect(findByTestId(on, 'network-unread-chip')?.props.className).toBe(
      'gps-chip gps-chip--active',
    );
  });
});
