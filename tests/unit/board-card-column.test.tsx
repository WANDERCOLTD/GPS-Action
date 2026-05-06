/**
 * Unit tests for the kanban Card + Column components (PR #4d).
 *
 * Plain-function-as-component pattern — vitest env is `node`, no RTL.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { Card, type CardProps } from '@/components/board/Card';
import { Column } from '@/components/board/Column';

type AnyElement = ReactElement<Record<string, unknown>>;

/**
 * Recursively expand React function-component nodes by invoking them
 * with their own props. This makes <Card /> inside <Column /> walk
 * into Card's rendered tree. Host elements (lowercase tags) and
 * already-rendered nodes pass through.
 */
function expand(node: unknown): unknown {
  if (!node || typeof node !== 'object' || !('props' in node)) return node;
  const el = node as AnyElement;
  if (typeof el.type === 'function') {
    const rendered = (el.type as (props: unknown) => unknown)(el.props);
    return expand(rendered);
  }
  return el;
}

function findByTestId(root: unknown, testid: string): AnyElement | null {
  const expanded = expand(root);
  if (!expanded || typeof expanded !== 'object' || !('props' in expanded)) return null;
  const el = expanded as AnyElement;
  const props = (el.props ?? {}) as Record<string, unknown>;
  if (props['data-testid'] === testid) return el;
  const children = props.children;
  if (children == null) return null;
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) {
    const found = findByTestId(child, testid);
    if (found) return found;
  }
  return null;
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

const NOW = new Date('2026-05-04T12:00:00Z');

const ticketFixture = (overrides: Partial<CardProps['ticket']> = {}): CardProps['ticket'] => ({
  id: 'r1',
  title: 'Write the press release',
  kindSlug: null,
  kindDisplayName: 'Task',
  isUrgent: false,
  assignees: [],
  updatedAt: NOW,
  ...overrides,
});

describe('Card', () => {
  it('renders the title and links to the ticket detail route', () => {
    const tree = Card({ groupSlug: 'writers', ticket: ticketFixture() }) as AnyElement;
    expect(findByTestId(tree, 'board-card-link')).not.toBeNull();
    const props = tree.props as Record<string, unknown>;
    expect(props.href).toBe('/board/writers/r1');
    expect(props['data-ticket-id']).toBe('r1');
  });

  it('shows the urgent dot only when the ticket is urgent', () => {
    const calm = Card({ groupSlug: 'g', ticket: ticketFixture({ isUrgent: false }) }) as AnyElement;
    expect(findByTestId(calm, 'board-card-urgent-dot')).toBeNull();
    const urgent = Card({
      groupSlug: 'g',
      ticket: ticketFixture({ isUrgent: true }),
    }) as AnyElement;
    expect(findByTestId(urgent, 'board-card-urgent-dot')).not.toBeNull();
  });

  it('renders all assignees up to the visible limit then a +N overflow', () => {
    const tree = Card({
      groupSlug: 'g',
      ticket: ticketFixture({
        assignees: [
          { userId: 'u1', displayName: 'Alice', avatarUrl: null },
          { userId: 'u2', displayName: 'Bob', avatarUrl: null },
          { userId: 'u3', displayName: 'Carol', avatarUrl: null },
          { userId: 'u4', displayName: 'Dan', avatarUrl: null },
          { userId: 'u5', displayName: 'Eve', avatarUrl: null },
        ],
      }),
    }) as AnyElement;
    const overflow = findByTestId(tree, 'board-card-assignees-overflow');
    expect(overflow).not.toBeNull();
    // JSX renders `+{overflow}` as ['+', 2] children — flatten + join.
    const children = (overflow?.props as Record<string, unknown>).children;
    const text = (Array.isArray(children) ? children : [children]).join('');
    expect(text).toBe('+2');
  });

  it('hides the overflow when assignees fit within the limit', () => {
    const tree = Card({
      groupSlug: 'g',
      ticket: ticketFixture({
        assignees: [
          { userId: 'u1', displayName: 'Alice', avatarUrl: null },
          { userId: 'u2', displayName: 'Bob', avatarUrl: null },
        ],
      }),
    }) as AnyElement;
    expect(findByTestId(tree, 'board-card-assignees-overflow')).toBeNull();
  });

  it('omits the kind row when kindDisplayName is null', () => {
    const tree = Card({
      groupSlug: 'g',
      ticket: ticketFixture({ kindDisplayName: null }),
    }) as AnyElement;
    expect(findByTestId(tree, 'board-card-kind')).toBeNull();
  });

  it('renders a kind glyph when the slug has a known mapping', () => {
    const tree = Card({
      groupSlug: 'g',
      ticket: ticketFixture({ kindSlug: 'happening_now', kindDisplayName: 'Urgent' }),
    }) as AnyElement;
    const glyph = findByTestId(tree, 'board-card-kind-glyph');
    expect(glyph).not.toBeNull();
    expect((glyph?.props as Record<string, unknown>)['data-kind-slug']).toBe('happening_now');
  });

  it('omits the glyph when the slug is unknown but keeps the label', () => {
    const tree = Card({
      groupSlug: 'g',
      ticket: ticketFixture({ kindSlug: 'mystery_kind', kindDisplayName: 'Mystery' }),
    }) as AnyElement;
    expect(findByTestId(tree, 'board-card-kind-glyph')).toBeNull();
    expect(findByTestId(tree, 'board-card-kind')).not.toBeNull();
  });

  it('omits the glyph when kindSlug is null', () => {
    const tree = Card({
      groupSlug: 'g',
      ticket: ticketFixture({ kindSlug: null, kindDisplayName: 'Task' }),
    }) as AnyElement;
    expect(findByTestId(tree, 'board-card-kind-glyph')).toBeNull();
  });
});

describe('Column', () => {
  it('renders a header with title + count and one Card per ticket', () => {
    const tree = Column({
      columnId: 'c1',
      displayName: 'Recruitment',
      groupSlug: 'writers',
      tickets: [ticketFixture({ id: 'r1' }), ticketFixture({ id: 'r2', title: 'Second' })],
    }) as AnyElement;
    expect(findByTestId(tree, 'board-column-card')).not.toBeNull();
    const count = findByTestId(tree, 'board-column-count');
    expect((count?.props as Record<string, unknown>).children).toBe(2);
    const cards = findAllByTestId(tree, 'board-card-link');
    expect(cards).toHaveLength(2);
  });

  it('shows the empty placeholder when no tickets', () => {
    const tree = Column({
      columnId: 'c1',
      displayName: 'Done',
      groupSlug: 'writers',
      tickets: [],
    }) as AnyElement;
    expect(findByTestId(tree, 'board-column-empty')).not.toBeNull();
  });

  it('tags the column wrapper with its column id for drag wiring', () => {
    const tree = Column({
      columnId: 'c-prep',
      displayName: 'Preparation',
      groupSlug: 'g',
      tickets: [],
    }) as AnyElement;
    const wrapper = findByTestId(tree, 'board-column-card');
    expect((wrapper?.props as Record<string, unknown>)['data-column-id']).toBe('c-prep');
  });

  it('renders cards via the renderCard prop when provided', () => {
    const tree = Column({
      columnId: 'c1',
      displayName: 'Recruitment',
      groupSlug: 'writers',
      tickets: [ticketFixture({ id: 'r1' }), ticketFixture({ id: 'r2', title: 'Second' })],
      renderCard: (t) => <span data-testid="custom-card-render" data-id={t.id} />,
    }) as AnyElement;
    const customs = findAllByTestId(tree, 'custom-card-render');
    expect(customs).toHaveLength(2);
    expect(findAllByTestId(tree, 'board-card-link')).toHaveLength(0);
  });

  it('exposes data-drop-over=true when isOver is set', () => {
    const tree = Column({
      columnId: 'c1',
      displayName: 'Recruitment',
      groupSlug: 'writers',
      tickets: [],
      isOver: true,
    }) as AnyElement;
    const wrapper = findByTestId(tree, 'board-column-card');
    expect((wrapper?.props as Record<string, unknown>)['data-drop-over']).toBe('true');
  });

  it('defaults data-drop-over to "false" when isOver is omitted', () => {
    const tree = Column({
      columnId: 'c1',
      displayName: 'Recruitment',
      groupSlug: 'writers',
      tickets: [],
    }) as AnyElement;
    const wrapper = findByTestId(tree, 'board-column-card');
    expect((wrapper?.props as Record<string, unknown>)['data-drop-over']).toBe('false');
  });
});
