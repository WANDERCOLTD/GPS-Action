/**
 * Unit tests for SourceBadge.
 *
 * @build-unit BU-source-and-kind-icons
 * @spec adrs/0020-source-and-kind-icons.md
 *
 * Walks the unrendered JSX tree (same pattern as
 * network-source-chip-strip.test.tsx). Verifies the icon-slot
 * rendering priority order: image > lucide > emoji > coloured dot.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { SourceBadge } from '@/components/SourceBadge';
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

const SOURCE: NetworkSource = {
  slug: 'gps-action-network',
  label: 'GPS Action Network!',
  description: null,
  displayOrder: 1,
  color: '#3fb950',
  icon: '🎯',
  memberCount: 100,
};

describe('SourceBadge icon slot', () => {
  it('renders an <img> when iconOverride.iconKind = image and imageUrl is set', () => {
    const tree = SourceBadge({
      source: SOURCE,
      variant: 'chip',
      iconOverride: {
        iconKind: 'image',
        imageUrl: '/source-icons/gps-action-network.jpg',
        lucideKey: null,
      },
    }) as AnyElement;
    const img = flatChildren(tree).find((el) => el.props['data-testid'] === 'source-badge-image');
    expect(img).toBeDefined();
    expect(img?.props.src).toBe('/source-icons/gps-action-network.jpg');
  });

  it('renders the lucide registry glyph when iconKind = lucide and lucideKey is valid', () => {
    const tree = SourceBadge({
      source: SOURCE,
      variant: 'chip',
      iconOverride: {
        iconKind: 'lucide',
        imageUrl: null,
        lucideKey: 'tick-cross-pair',
      },
    }) as AnyElement;
    // TickCrossPair is invoked as a function-typed element; pick it
    // out by the function's name.
    const pair = flatChildren(tree).find((el) => {
      const t = el.type as unknown;
      return (
        typeof t === 'function' &&
        ((t as { displayName?: string; name?: string }).displayName === 'TickCrossPair' ||
          (t as { name?: string }).name === 'TickCrossPair')
      );
    });
    expect(pair).toBeDefined();
    expect((pair as AnyElement).props.size).toBe('chip');
  });

  it('falls back to the source emoji when no override is provided', () => {
    const tree = SourceBadge({
      source: SOURCE,
      variant: 'chip',
      iconOverride: null,
    }) as AnyElement;
    // The emoji shows up as text inside one of the inner spans —
    // assert by walking children and finding the string '🎯'.
    const strings: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') strings.push(node);
      if (Array.isArray(node)) node.forEach(walk);
      if (node && typeof node === 'object' && 'props' in node) {
        walk((node as AnyElement).props.children);
      }
    };
    walk(tree);
    expect(strings).toContain('🎯');
  });

  it('renders a label by default for chip variant', () => {
    const tree = SourceBadge({
      source: SOURCE,
      variant: 'chip',
      iconOverride: null,
    }) as AnyElement;
    const strings: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') strings.push(node);
      if (Array.isArray(node)) node.forEach(walk);
      if (node && typeof node === 'object' && 'props' in node) {
        walk((node as AnyElement).props.children);
      }
    };
    walk(tree);
    expect(strings).toContain('GPS Action Network!');
  });

  it('hides the label when showLabel=false (compact tile-overlay use)', () => {
    const tree = SourceBadge({
      source: SOURCE,
      variant: 'compact',
      showLabel: false,
      iconOverride: null,
    }) as AnyElement;
    const strings: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') strings.push(node);
      if (Array.isArray(node)) node.forEach(walk);
      if (node && typeof node === 'object' && 'props' in node) {
        walk((node as AnyElement).props.children);
      }
    };
    walk(tree);
    expect(strings).not.toContain('GPS Action Network!');
  });

  it('renders as <a> when href is provided', () => {
    const tree = SourceBadge({
      source: SOURCE,
      iconOverride: null,
      href: '/network?source=gps-action-network',
    }) as AnyElement;
    expect(tree.type).toBe('a');
    expect(tree.props.href).toBe('/network?source=gps-action-network');
  });

  it('renders as <span> when href is omitted', () => {
    const tree = SourceBadge({
      source: SOURCE,
      iconOverride: null,
    }) as AnyElement;
    expect(tree.type).toBe('span');
  });

  it('sets data-active=true when active=true', () => {
    const tree = SourceBadge({
      source: SOURCE,
      iconOverride: null,
      active: true,
      href: '/x',
    }) as AnyElement;
    expect(tree.props['data-active']).toBe('true');
  });
});
