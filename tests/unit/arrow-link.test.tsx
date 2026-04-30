/**
 * @build-unit BU-feed-card-affordances
 * @spec build/session-briefs/bu-feed-card-affordances.md
 *
 * Unit tests for the shared ArrowLink component. Asserts:
 *   - renders a real Next/Link (so iOS taps fire natively)
 *   - direction='forward' puts the arrow on the right
 *   - direction='back' puts the arrow on the left
 *   - direction='none' renders no arrow span
 *   - testid follows the canonical area-prefix rule
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { ArrowLink } from '@/components/ArrowLink';

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

function findArrowSpans(el: AnyElement): AnyElement[] {
  return flatChildren(el).filter((e) => e.props['data-arrow'] !== undefined);
}

describe('ArrowLink', () => {
  it('renders a Next/Link with the correct href and data-direction attribute', () => {
    const tree = ArrowLink({
      href: '/feed',
      direction: 'back',
      children: 'Back to feed',
    }) as AnyElement;
    expect(tree.props.href).toBe('/feed');
    expect(tree.props['data-direction']).toBe('back');
    expect(tree.props['data-testid']).toBe('arrow-link');
  });

  it('places the arrow before the children when direction is "back"', () => {
    const tree = ArrowLink({
      href: '/feed',
      direction: 'back',
      children: 'Back',
    }) as AnyElement;
    const arrows = findArrowSpans(tree);
    expect(arrows).toHaveLength(1);
    expect(arrows[0]?.props['data-arrow']).toBe('back');
    // The arrow span should appear before the text span in the children array.
    const children = tree.props.children as AnyElement[];
    expect((children[0] as AnyElement).props['data-arrow']).toBe('back');
  });

  it('places the arrow after the children when direction is "forward"', () => {
    const tree = ArrowLink({
      href: '/post/x',
      direction: 'forward',
      children: 'Read post',
    }) as AnyElement;
    const arrows = findArrowSpans(tree);
    expect(arrows).toHaveLength(1);
    expect(arrows[0]?.props['data-arrow']).toBe('forward');
    const children = tree.props.children as AnyElement[];
    // children = [false, <span>text</span>, <span data-arrow=forward>]
    const last = children[children.length - 1];
    expect((last as AnyElement).props['data-arrow']).toBe('forward');
  });

  it('renders no arrow span when direction is "none"', () => {
    const tree = ArrowLink({
      href: '/x',
      direction: 'none',
      children: 'Plain link',
    }) as AnyElement;
    expect(findArrowSpans(tree)).toHaveLength(0);
  });

  it('honours testIdArea prefix', () => {
    const tree = ArrowLink({
      href: '/feed',
      direction: 'back',
      testIdArea: 'post',
      testIdSuffix: 'back',
      children: 'Back to feed',
    }) as AnyElement;
    expect(tree.props['data-testid']).toBe('post-arrow-link-back');
  });

  it('falls back to the unprefixed testid when no area is supplied', () => {
    const tree = ArrowLink({
      href: '/x',
      direction: 'forward',
      testIdSuffix: 'continue',
      children: 'Continue',
    }) as AnyElement;
    expect(tree.props['data-testid']).toBe('arrow-link-continue');
  });

  it('attaches the gps-arrow-link className for the global hover styles', () => {
    const tree = ArrowLink({
      href: '/x',
      direction: 'forward',
      children: 'Go',
    }) as AnyElement;
    expect(tree.props.className).toBe('gps-arrow-link');
  });
});
