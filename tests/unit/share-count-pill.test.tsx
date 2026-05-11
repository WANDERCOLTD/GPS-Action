/**
 * Unit tests for the ShareCountPill component.
 *
 * @build-unit bu-network-card-layout
 *
 * The pill was extracted from ShareGroup so callers (like NetworkCard's
 * vertical share column) can compose it independently. Tests pin the
 * visual states and the tooltip contract.
 *
 * Vitest env is `node` — no jsdom. Component is invoked as a plain
 * function and we read returned ReactElement props.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { ShareCountPill } from '@/components/ShareCountPill';

type AnyElement = ReactElement<Record<string, unknown>>;

describe('<ShareCountPill>', () => {
  it('renders the total inside an element with the share-count-pill testid', () => {
    const tree = ShareCountPill({
      counts: { total: 7, perDestination: { whatsapp: 4, x: 3 } },
      targetId: '42',
    }) as AnyElement;

    expect(tree.props['data-testid']).toBe('share-count-pill');
    expect(tree.props['data-target-id']).toBe('42');
    expect(tree.props['data-count']).toBe(7);
    expect(tree.props['data-zero']).toBe('false');
  });

  it('tags zero counts with data-zero="true"', () => {
    const tree = ShareCountPill({
      counts: { total: 0, perDestination: {} },
    }) as AnyElement;

    expect(tree.props['data-count']).toBe(0);
    expect(tree.props['data-zero']).toBe('true');
  });

  it('tooltip enumerates all four destinations even when some are zero or missing', () => {
    const tree = ShareCountPill({
      counts: { total: 3, perDestination: { whatsapp: 2, x: 1 } },
    }) as AnyElement;

    const title = String(tree.props.title);
    expect(title).toContain('3 verified shares');
    expect(title).toContain('whatsapp: 2');
    expect(title).toContain('x: 1');
    expect(title).toContain('instagram: 0');
    expect(title).toContain('facebook: 0');
  });

  it('targetId is optional', () => {
    const tree = ShareCountPill({
      counts: { total: 1, perDestination: { whatsapp: 1 } },
    }) as AnyElement;
    expect(tree.props['data-target-id']).toBeUndefined();
  });
});
