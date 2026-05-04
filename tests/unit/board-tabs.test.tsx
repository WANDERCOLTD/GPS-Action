/**
 * Unit tests for the BoardTabs component (PR #4e).
 *
 * Plain-function-as-component pattern; vitest env is `node`.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { BoardTabs } from '@/components/board/BoardTabs';

type AnyElement = ReactElement<Record<string, unknown>>;

function expand(node: unknown): unknown {
  if (!node || typeof node !== 'object' || !('props' in node)) return node;
  const el = node as AnyElement;
  if (typeof el.type === 'function') {
    return expand((el.type as (props: unknown) => unknown)(el.props));
  }
  return el;
}

function findAllByTestId(root: unknown, testid: string): AnyElement[] {
  const acc: AnyElement[] = [];
  const visit = (node: unknown) => {
    const e = expand(node);
    if (!e || typeof e !== 'object' || !('props' in e)) return;
    const el = e as AnyElement;
    const props = (el.props ?? {}) as Record<string, unknown>;
    if (props['data-testid'] === testid) acc.push(el);
    const children = props.children;
    if (children == null) return;
    const list = Array.isArray(children) ? children.flat(Infinity) : [children];
    list.forEach(visit);
  };
  visit(root);
  return acc;
}

describe('BoardTabs', () => {
  it('renders three links with the right hrefs', () => {
    const tree = BoardTabs({ groupSlug: 'writers', active: 'active' }) as AnyElement;
    const links = findAllByTestId(tree, 'board-tabs-link');
    expect(links.map((l) => (l.props as Record<string, unknown>).href)).toEqual([
      '/board/writers',
      '/board/writers/backlog',
      '/board/writers/done',
    ]);
  });

  it('marks the active tab with aria-current="page"', () => {
    for (const active of ['active', 'backlog', 'done'] as const) {
      const tree = BoardTabs({ groupSlug: 'g', active }) as AnyElement;
      const links = findAllByTestId(tree, 'board-tabs-link');
      const current = links.find(
        (l) => (l.props as Record<string, unknown>)['aria-current'] === 'page',
      );
      expect((current?.props as Record<string, unknown>)['data-tab']).toBe(active);
    }
  });

  it('only one tab is marked aria-current at a time', () => {
    const tree = BoardTabs({ groupSlug: 'g', active: 'backlog' }) as AnyElement;
    const links = findAllByTestId(tree, 'board-tabs-link');
    const currents = links.filter(
      (l) => (l.props as Record<string, unknown>)['aria-current'] === 'page',
    );
    expect(currents).toHaveLength(1);
  });
});
