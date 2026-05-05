/**
 * Unit tests for the BoardGroupPicker component (PR #4c).
 *
 * Plain-function-as-component pattern: vitest env is `node`, no RTL.
 * Walk the ReactElement tree to assert the contract.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { BoardGroupPicker, type BoardGroupPickerItem } from '@/components/board/BoardGroupPicker';

type AnyElement = ReactElement<Record<string, unknown>>;

function findByTestId(root: AnyElement, testid: string): AnyElement | null {
  const props = (root.props ?? {}) as Record<string, unknown>;
  if (props['data-testid'] === testid) return root;
  const children = props.children;
  if (children == null) return null;
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) {
    if (child && typeof child === 'object' && 'props' in child) {
      const found = findByTestId(child as AnyElement, testid);
      if (found) return found;
    }
  }
  return null;
}

function findAllByTestId(root: AnyElement, testid: string): AnyElement[] {
  const acc: AnyElement[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const el = node as AnyElement;
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

const fixtureItem = (overrides: Partial<BoardGroupPickerItem>): BoardGroupPickerItem => ({
  id: 'g1',
  slug: 'writers',
  displayName: 'Writers',
  description: null,
  kind: 'workstream',
  colourKey: 'slate',
  logoUrl: null,
  isAdmin: false,
  ...overrides,
});

describe('BoardGroupPicker', () => {
  it('renders the empty-state when given no groups', () => {
    const tree = BoardGroupPicker({ groups: [] }) as AnyElement;
    expect(findByTestId(tree, 'board-picker-empty')).not.toBeNull();
    expect(findByTestId(tree, 'board-picker-list')).toBeNull();
  });

  it('renders one card per group', () => {
    const groups = [
      fixtureItem({ id: 'g1', slug: 'writers', displayName: 'Writers' }),
      fixtureItem({ id: 'g2', slug: 'it-team', displayName: 'IT', kind: 'team' }),
      fixtureItem({ id: 'g3', slug: 'manchester', displayName: 'Manchester', kind: 'region' }),
    ];
    const tree = BoardGroupPicker({ groups }) as AnyElement;
    const cards = findAllByTestId(tree, 'board-picker-card');
    expect(cards).toHaveLength(3);
  });

  it('links each card to /board/[slug]', () => {
    const groups = [fixtureItem({ slug: 'writers' }), fixtureItem({ id: 'g2', slug: 'it-team' })];
    const tree = BoardGroupPicker({ groups }) as AnyElement;
    const cards = findAllByTestId(tree, 'board-picker-card');
    const hrefs = cards.map((c) => (c.props as Record<string, unknown>).href);
    expect(hrefs).toEqual(['/board/writers', '/board/it-team']);
  });

  it('marks each card with its group slug for client-side hooks', () => {
    const groups = [fixtureItem({ slug: 'writers' })];
    const tree = BoardGroupPicker({ groups }) as AnyElement;
    const card = findByTestId(tree, 'board-picker-card');
    expect((card?.props as Record<string, unknown>)['data-group-slug']).toBe('writers');
  });

  it('shows the admin badge only when isAdmin is true', () => {
    const tree = BoardGroupPicker({
      groups: [
        fixtureItem({ id: 'g1', slug: 'writers', isAdmin: true }),
        fixtureItem({ id: 'g2', slug: 'it-team', isAdmin: false }),
      ],
    }) as AnyElement;
    const badges = findAllByTestId(tree, 'board-picker-admin-badge');
    expect(badges).toHaveLength(1);
  });

  it('omits the description block when description is null', () => {
    const tree = BoardGroupPicker({
      groups: [fixtureItem({ description: null })],
    }) as AnyElement;
    // Walk the children of the card to confirm there is no <p>.
    const card = findByTestId(tree, 'board-picker-card');
    const cardChildren = (card?.props as Record<string, unknown>).children;
    const flat = Array.isArray(cardChildren) ? cardChildren.flat(Infinity) : [cardChildren];
    const paragraphs = flat.filter(
      (c) => c && typeof c === 'object' && 'type' in c && (c as ReactElement).type === 'p',
    );
    expect(paragraphs).toHaveLength(0);
  });

  it('renders the description block when provided', () => {
    const tree = BoardGroupPicker({
      groups: [fixtureItem({ description: 'For all writing tasks' })],
    }) as AnyElement;
    const card = findByTestId(tree, 'board-picker-card');
    const cardChildren = (card?.props as Record<string, unknown>).children;
    const flat = Array.isArray(cardChildren) ? cardChildren.flat(Infinity) : [cardChildren];
    const paragraph = flat.find(
      (c) => c && typeof c === 'object' && 'type' in c && (c as ReactElement).type === 'p',
    ) as ReactElement | undefined;
    expect((paragraph?.props as Record<string, unknown>)?.children).toBe('For all writing tasks');
  });
});
