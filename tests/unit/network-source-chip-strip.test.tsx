/**
 * Unit tests for NetworkSourceChipStrip + parseSourcesParam.
 *
 * @build-unit bu-network-source-chips
 *
 * Vitest env is `node`, no RTL. Invokes the component as a plain
 * function and walks the ReactElement tree — same pattern as
 * tests/unit/feed-filter-chips.test.tsx.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { NetworkSourceChipStrip, parseSourcesParam } from '@/components/NetworkSourceChipStrip';
import type { NetworkSource } from '@/shared/network-card';

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

/**
 * Chip-strip now renders `<SourceBadge>` per source. The component
 * isn't materialised here (no React render), so walk the JSX tree
 * and pick out the SourceBadge invocations by their displayName or
 * function name. Read props from the unrendered element directly.
 */
function chipsBySlug(tree: AnyElement): Map<string, AnyElement> {
  const out = new Map<string, AnyElement>();
  for (const el of flatChildren(tree)) {
    const type = el.type as unknown;
    const isSourceBadge =
      typeof type === 'function' &&
      ((type as { displayName?: string; name?: string }).displayName === 'SourceBadge' ||
        (type as { name?: string }).name === 'SourceBadge');
    if (!isSourceBadge) continue;
    const source = el.props.source as { slug?: string } | undefined;
    if (source?.slug) {
      // Synthesize `data-active` and `href` on the element so the
      // existing tests can keep their access pattern (`.props['data-active']`,
      // `.props.href`) without rewriting every assertion.
      const synthetic = {
        ...el,
        props: {
          ...el.props,
          'data-active': el.props.active ? 'true' : 'false',
          'data-source-slug': source.slug,
        },
      } as AnyElement;
      out.set(source.slug, synthetic);
    }
  }
  return out;
}

function findAllChip(tree: AnyElement): AnyElement | undefined {
  return flatChildren(tree).find((e) => e.props['data-testid'] === 'network-source-chip-all');
}

const SOURCES: NetworkSource[] = [
  {
    slug: 'gps-action-network',
    label: 'GPS Action Network!',
    description: null,
    displayOrder: 1,
    color: '#3fb950',
    icon: '🎯',
    memberCount: 190,
  },
  {
    slug: 'hendon-jag',
    label: 'Hendon JAG',
    description: 'Local action group',
    displayOrder: 2,
    color: '#dc2626',
    icon: '🚩',
    memberCount: 80,
  },
];

describe('NetworkSourceChipStrip', () => {
  it('renders one chip per source plus the "All" chip', () => {
    const tree = NetworkSourceChipStrip({ sources: SOURCES, active: [] }) as AnyElement;
    expect(findAllChip(tree)).toBeDefined();
    expect(chipsBySlug(tree).size).toBe(SOURCES.length);
  });

  it('marks "All" active when no slugs are selected', () => {
    const tree = NetworkSourceChipStrip({ sources: SOURCES, active: [] }) as AnyElement;
    const all = findAllChip(tree);
    expect(all?.props['data-active']).toBe('true');
    expect(all?.props['aria-current']).toBe('page');
  });

  it('marks a source chip active when its slug is in the active list', () => {
    const tree = NetworkSourceChipStrip({
      sources: SOURCES,
      active: ['hendon-jag'],
    }) as AnyElement;
    const chips = chipsBySlug(tree);
    expect(chips.get('hendon-jag')?.props['data-active']).toBe('true');
    expect(chips.get('gps-action-network')?.props['data-active']).toBe('false');
    expect(findAllChip(tree)?.props['data-active']).toBe('false');
  });

  it('toggling an inactive chip adds it to the next href', () => {
    const tree = NetworkSourceChipStrip({
      sources: SOURCES,
      active: ['hendon-jag'],
    }) as AnyElement;
    const chips = chipsBySlug(tree);
    // Clicking the currently-inactive chip should ADD it to the slug set.
    expect(chips.get('gps-action-network')?.props.href).toBe(
      '/network?source=gps-action-network,hendon-jag',
    );
  });

  it('toggling an active chip removes it from the next href', () => {
    const tree = NetworkSourceChipStrip({
      sources: SOURCES,
      active: ['gps-action-network', 'hendon-jag'],
    }) as AnyElement;
    const chips = chipsBySlug(tree);
    // Clicking the currently-active hendon-jag chip should REMOVE it.
    expect(chips.get('hendon-jag')?.props.href).toBe('/network?source=gps-action-network');
  });

  it('toggling the last active chip yields the bare /network href', () => {
    const tree = NetworkSourceChipStrip({
      sources: SOURCES,
      active: ['gps-action-network'],
    }) as AnyElement;
    const chips = chipsBySlug(tree);
    expect(chips.get('gps-action-network')?.props.href).toBe('/network');
  });

  it('the "All" chip always points at the bare /network', () => {
    const tree = NetworkSourceChipStrip({
      sources: SOURCES,
      active: ['gps-action-network'],
    }) as AnyElement;
    expect(findAllChip(tree)?.props.href).toBe('/network');
  });

  it('sets ariaLabel on each source badge to its label', () => {
    // SourceBadge takes `ariaLabel` (camelCase) as a prop and emits
    // it as `aria-label` on the rendered element. Reading the prop
    // directly here.
    const tree = NetworkSourceChipStrip({ sources: SOURCES, active: [] }) as AnyElement;
    const chips = chipsBySlug(tree);
    expect(chips.get('gps-action-network')?.props.ariaLabel).toBe('GPS Action Network!');
    expect(chips.get('hendon-jag')?.props.ariaLabel).toBe('Hendon JAG');
  });

  it('exposes description via title attribute, falling back to label', () => {
    // The chip strip now passes `description ?? label` as the title
    // (label fallback for accessibility — tooltip is always populated).
    const tree = NetworkSourceChipStrip({ sources: SOURCES, active: [] }) as AnyElement;
    const chips = chipsBySlug(tree);
    expect(chips.get('hendon-jag')?.props.title).toBe('Local action group');
    expect(chips.get('gps-action-network')?.props.title).toBe('GPS Action Network!');
  });
});

describe('parseSourcesParam', () => {
  it('returns [] for undefined / empty / whitespace input', () => {
    expect(parseSourcesParam(undefined)).toEqual([]);
    expect(parseSourcesParam('')).toEqual([]);
    expect(parseSourcesParam('   ')).toEqual([]);
    expect(parseSourcesParam(',  ,')).toEqual([]);
  });

  it('parses a single slug', () => {
    expect(parseSourcesParam('gps-action-network')).toEqual(['gps-action-network']);
  });

  it('parses multiple slugs and trims whitespace', () => {
    expect(parseSourcesParam('gps-action-network, hendon-jag')).toEqual([
      'gps-action-network',
      'hendon-jag',
    ]);
  });

  it('dedupes repeated slugs', () => {
    expect(parseSourcesParam('a,b,a,c,b')).toEqual(['a', 'b', 'c']);
  });

  it('handles array form (?source=a&source=b)', () => {
    expect(parseSourcesParam(['gps-action-network', 'hendon-jag'])).toEqual([
      'gps-action-network',
      'hendon-jag',
    ]);
  });
});

describe('NetworkSourceChipStrip · preserveParams', () => {
  it('appends preserved params to source-chip hrefs', () => {
    const tree = NetworkSourceChipStrip({
      sources: SOURCES,
      active: [],
      preserveParams: { sort: 'oldest' },
    }) as AnyElement;
    const chips = chipsBySlug(tree);
    expect(chips.get('hendon-jag')?.props.href).toBe('/network?source=hendon-jag&sort=oldest');
  });

  it('appends preserved params to the All chip href', () => {
    const tree = NetworkSourceChipStrip({
      sources: SOURCES,
      active: ['gps-action-network'],
      preserveParams: { sort: 'oldest' },
    }) as AnyElement;
    const all = findAllChip(tree);
    // Tapping "All" should clear the source filter but preserve sort.
    expect(all?.props.href).toBe('/network?sort=oldest');
  });

  it('omits preserved params that are undefined', () => {
    const tree = NetworkSourceChipStrip({
      sources: SOURCES,
      active: [],
      preserveParams: { sort: undefined },
    }) as AnyElement;
    const chips = chipsBySlug(tree);
    expect(chips.get('hendon-jag')?.props.href).toBe('/network?source=hendon-jag');
  });
});
