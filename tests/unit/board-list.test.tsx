/**
 * Unit tests for the BoardList view (PR #7 atom B3).
 *
 * Same plain-function-as-component pattern as `board-card-column.test.tsx` —
 * no RTL, vitest env is `node`. We invoke `BoardList` directly and walk
 * the resulting tree by `data-testid`.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { BoardList } from '@/components/board/BoardList';
import type { CardProps } from '@/components/board/Card';

type AnyElement = ReactElement<Record<string, unknown>>;

function expand(node: unknown): unknown {
  if (!node || typeof node !== 'object' || !('props' in node)) return node;
  const el = node as AnyElement;
  if (typeof el.type === 'function') {
    const rendered = (el.type as (props: unknown) => unknown)(el.props);
    return expand(rendered);
  }
  return el;
}

function findAllByTestId(root: unknown, testid: string): AnyElement[] {
  const acc: AnyElement[] = [];
  const visit = (node: unknown) => {
    const expanded = expand(node);
    if (!expanded || typeof expanded !== 'object' || !('props' in expanded)) return;
    const el = expanded as AnyElement;
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

const NOW = new Date('2026-05-06T12:00:00Z');

const ticket = (id: string, title: string): CardProps['ticket'] => ({
  id,
  title,
  kindSlug: null,
  kindDisplayName: 'Task',
  isUrgent: false,
  assignees: [],
  updatedAt: NOW,
});

describe('BoardList', () => {
  it('renders one section per column with a count + cards', () => {
    const tree = BoardList({
      groupSlug: 'writers',
      columns: [
        { id: 'c-rec', displayName: 'Recruitment' },
        { id: 'c-prep', displayName: 'Preparation' },
      ],
      cardsByColumn: {
        'c-rec': [ticket('r1', 'A'), ticket('r2', 'B')],
        'c-prep': [ticket('r3', 'C')],
      },
    }) as AnyElement;
    const sections = findAllByTestId(tree, 'board-list-section');
    expect(sections).toHaveLength(2);
    expect((sections[0]?.props as Record<string, unknown>)['data-column-id']).toBe('c-rec');
    expect((sections[1]?.props as Record<string, unknown>)['data-column-id']).toBe('c-prep');

    const counts = findAllByTestId(tree, 'board-list-section-count');
    expect((counts[0]?.props as Record<string, unknown>).children).toBe(2);
    expect((counts[1]?.props as Record<string, unknown>).children).toBe(1);

    const cards = findAllByTestId(tree, 'board-card-link');
    expect(cards).toHaveLength(3);
  });

  it('shows the empty placeholder for a column with no cards', () => {
    const tree = BoardList({
      groupSlug: 'writers',
      columns: [{ id: 'c-done', displayName: 'Done' }],
      cardsByColumn: {},
    }) as AnyElement;
    expect(findAllByTestId(tree, 'board-list-section-empty')).toHaveLength(1);
    expect(findAllByTestId(tree, 'board-card-link')).toHaveLength(0);
  });
});
