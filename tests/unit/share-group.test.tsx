/**
 * @build-unit bu-network-shares
 * @spec build/session-briefs/bu-network-shares.md
 *
 * Unit tests for the polymorphic <ShareGroup>. Same env-agnostic walk
 * pattern the NetworkCard tests use — call the component as a plain
 * function and inspect the ReactElement tree. The component is pure
 * presentational (no hooks), so this works without a render harness.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { ShareGroup } from '@/components/ShareGroup';

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

function findAllByTestId(el: AnyElement, testId: string): AnyElement[] {
  return flatChildren(el).filter((e) => e.props['data-testid'] === testId);
}

const baseProps = {
  url: 'https://example.com/article',
  title: 'A useful article',
  targetType: 'network_card' as const,
  targetId: '42',
};

describe('<ShareGroup>', () => {
  it('renders an icon for each social destination (X, IG, FB)', () => {
    const tree = ShareGroup(baseProps) as AnyElement;
    const icons = findAllByTestId(tree, 'share-group-icon');
    expect(icons).toHaveLength(3);
    const destinations = icons.map((i) => i.props['data-destination']);
    expect(destinations).toEqual(['x', 'instagram', 'facebook']);
  });

  it('does not render the counter pill when counts is undefined', () => {
    const tree = ShareGroup(baseProps) as AnyElement;
    expect(findByTestId(tree, 'share-group-counter')).toBeUndefined();
  });

  it('renders a greyed counter pill when total=0', () => {
    const tree = ShareGroup({
      ...baseProps,
      counts: {
        total: 0,
        perDestination: { whatsapp: 0, x: 0, instagram: 0, facebook: 0 },
      },
    }) as AnyElement;
    const pill = findByTestId(tree, 'share-group-counter');
    expect(pill).toBeDefined();
    expect(pill?.props['data-count']).toBe(0);
    expect(pill?.props['data-zero']).toBe('true');
  });

  it('renders a highlighted counter pill when total > 0', () => {
    const tree = ShareGroup({
      ...baseProps,
      counts: {
        total: 5,
        perDestination: { whatsapp: 2, x: 2, instagram: 0, facebook: 1 },
      },
    }) as AnyElement;
    const pill = findByTestId(tree, 'share-group-counter');
    expect(pill?.props['data-count']).toBe(5);
    expect(pill?.props['data-zero']).toBe('false');
  });

  it('X icon points to twitter.com/intent/tweet with text + url params (upstream url, not GPS)', () => {
    const tree = ShareGroup(baseProps) as AnyElement;
    const x = findAllByTestId(tree, 'share-group-icon').find(
      (i) => i.props['data-destination'] === 'x',
    );
    const href = String(x?.props.href ?? '');
    expect(href).toContain('https://twitter.com/intent/tweet');
    expect(href).toContain('url=https%3A%2F%2Fexample.com%2Farticle');
    expect(href).toContain('text=A+useful+article');
    // No GPS app URL should leak into the share link.
    expect(href).not.toContain('gpsaction');
    expect(href).not.toContain('/post/');
    expect(href).not.toContain('/network/');
  });

  it('Facebook icon uses the sharer.php endpoint with u=upstreamUrl', () => {
    const tree = ShareGroup(baseProps) as AnyElement;
    const fb = findAllByTestId(tree, 'share-group-icon').find(
      (i) => i.props['data-destination'] === 'facebook',
    );
    const href = String(fb?.props.href ?? '');
    expect(href).toContain('https://www.facebook.com/sharer/sharer.php');
    expect(href).toContain('u=https%3A%2F%2Fexample.com%2Farticle');
  });

  it('Instagram falls back to platform home (no public share URL)', () => {
    const tree = ShareGroup(baseProps) as AnyElement;
    const ig = findAllByTestId(tree, 'share-group-icon').find(
      (i) => i.props['data-destination'] === 'instagram',
    );
    expect(ig?.props.href).toBe('https://www.instagram.com/');
  });

  it('exposes target metadata at the group root for selector / tooltip use', () => {
    const tree = ShareGroup({
      ...baseProps,
      counts: { total: 7, perDestination: { x: 7 } },
    }) as AnyElement;
    expect(tree.props['data-testid']).toBe('share-group');
    expect(tree.props['data-target-type']).toBe('network_card');
    expect(tree.props['data-target-id']).toBe('42');
  });

  it('counter tooltip lists per-destination breakdown', () => {
    const tree = ShareGroup({
      ...baseProps,
      counts: {
        total: 5,
        perDestination: { whatsapp: 2, x: 2, facebook: 1, instagram: 0 },
      },
    }) as AnyElement;
    const pill = findByTestId(tree, 'share-group-counter');
    const title = String(pill?.props.title ?? '');
    expect(title).toContain('whatsapp: 2');
    expect(title).toContain('x: 2');
    expect(title).toContain('facebook: 1');
  });

  it('icon onClick handler fires onShareInitiated with the right destination', () => {
    const onShareInitiated = vi.fn();
    const tree = ShareGroup({ ...baseProps, onShareInitiated }) as AnyElement;
    const fb = findAllByTestId(tree, 'share-group-icon').find(
      (i) => i.props['data-destination'] === 'facebook',
    );
    const onClick = fb?.props.onClick as (e: { stopPropagation: () => void }) => void;
    // pingShareIntent will try to call sendBeacon/fetch — guard by
    // running in a Node env without window. The handler short-circuits
    // when `typeof window === 'undefined'`.
    onClick({ stopPropagation: vi.fn() });
    expect(onShareInitiated).toHaveBeenCalledWith('facebook');
  });
});
