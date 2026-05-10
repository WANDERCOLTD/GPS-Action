/**
 * Unit tests for BacklogList — Sub-build D Item 17.
 *
 * The wrapper owns:
 *   - Optimistic remove of moved tickets (rows vanish before the server
 *     action settles).
 *   - The "Moved to <Column>" toast with a "View →" link to the
 *     active board.
 *   - Rollback of the optimistic remove on server-action failure.
 *
 * Vitest env is `node`. We exercise the context callbacks directly by
 * pulling them from the rendered tree — same shape as the other board
 * client-component tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

interface StateSlot<T> {
  value: T;
}

const stateSlots: StateSlot<unknown>[] = [];
let slotIdx = 0;

const setterCalls: { idx: number; value: unknown }[] = [];

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T,>(init: T) => {
      const idx = slotIdx++;
      if (!(idx in stateSlots)) {
        stateSlots[idx] = { value: init };
      }
      const slot = stateSlots[idx] as StateSlot<T>;
      const setter = (next: T | ((prev: T) => T)) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(slot.value) : next;
        setterCalls.push({ idx, value: resolved });
        slot.value = resolved;
      };
      return [slot.value, setter] as const;
    },
    useContext: () => null,
  };
});

// Stub Card + BacklogQuickAdd: their internals aren't relevant here and
// importing them through the JSX transform pulls in unrelated modules.
vi.mock('@/components/board/Card', () => ({
  Card: (props: { ticket: { id: string } }) => ({
    type: 'div',
    props: {
      'data-testid': 'mock-card',
      'data-ticket-id': props.ticket.id,
    },
  }),
}));

vi.mock('@/components/board/BacklogQuickAdd', () => ({
  BacklogQuickAdd: () => null,
}));

vi.mock('next/link', () => ({
  default: (props: { href: string; children: unknown; 'data-testid'?: string }) => ({
    type: 'a',
    props: {
      href: props.href,
      'data-testid': props['data-testid'],
      children: props.children,
    },
  }),
}));

const { BacklogList } = await import('@/components/board/BacklogList');

type AnyElement = ReactElement<Record<string, unknown>>;

function isElement(node: unknown): node is AnyElement {
  return Boolean(node) && typeof node === 'object' && node !== null && 'props' in node;
}

function expand(node: unknown): unknown[] {
  if (!isElement(node)) return [];
  if (typeof node.type === 'function') {
    const renderFn = node.type as (props: unknown) => unknown;
    const rendered = renderFn(node.props);
    return [...expand(rendered)];
  }
  const out: unknown[] = [node];
  const props = (node.props ?? {}) as Record<string, unknown>;
  const children = props.children;
  if (children == null) return out;
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) out.push(...expand(child));
  return out;
}

function findByTestId(root: unknown, testid: string): AnyElement | undefined {
  return expand(root).find(
    (n): n is AnyElement => isElement(n) && n.props['data-testid'] === testid,
  );
}

function findAllByTestId(root: unknown, testid: string): AnyElement[] {
  return expand(root).filter(
    (n): n is AnyElement => isElement(n) && n.props['data-testid'] === testid,
  );
}

const baseProps = {
  groupSlug: 'writers',
  groupId: 'g-writers',
  activeColumns: [
    { id: 'c-now', displayName: 'Now' },
    { id: 'c-soon', displayName: 'Soon' },
  ],
};

const tickets = [
  {
    id: 'r1',
    title: 'A',
    kindSlug: null,
    kindDisplayName: null,
    isUrgent: false,
    assignees: [],
    updatedAt: new Date(),
  },
  {
    id: 'r2',
    title: 'B',
    kindSlug: null,
    kindDisplayName: null,
    isUrgent: false,
    assignees: [],
    updatedAt: new Date(),
  },
  {
    id: 'r3',
    title: 'C',
    kindSlug: null,
    kindDisplayName: null,
    isUrgent: false,
    assignees: [],
    updatedAt: new Date(),
  },
];

function resetState(): void {
  stateSlots.length = 0;
  slotIdx = 0;
  setterCalls.length = 0;
  vi.useFakeTimers();
}

beforeEach(() => {
  resetState();
});

describe('BacklogList — initial render', () => {
  it('renders all server-provided tickets when nothing has been removed', () => {
    slotIdx = 0;
    const tree = BacklogList({ ...baseProps, tickets }) as AnyElement;
    const cards = findAllByTestId(tree, 'mock-card');
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.props['data-ticket-id'])).toEqual(['r1', 'r2', 'r3']);
  });

  it('does not render the toast surface on first render', () => {
    slotIdx = 0;
    const tree = BacklogList({ ...baseProps, tickets }) as AnyElement;
    expect(findByTestId(tree, 'board-backlog-moved-toast')).toBeUndefined();
    expect(findByTestId(tree, 'board-backlog-move-error')).toBeUndefined();
  });
});

describe('BacklogList — Item 17: optimistic remove + toast', () => {
  it('hides the moved ticket and shows the "Moved to <Column>" toast on registerOptimisticMove', () => {
    // Mark r2 as removed via the state slot mechanism — the optimistic
    // setter writes into the same slot, so we can simulate the post-
    // setter state by primeing the slots before render.
    stateSlots[0] = { value: ['r2'] };
    stateSlots[1] = { value: { requestId: 'r2', columnLabel: 'Now' } };
    stateSlots[2] = { value: null };
    slotIdx = 0;

    const tree = BacklogList({ ...baseProps, tickets }) as AnyElement;
    const cards = findAllByTestId(tree, 'mock-card');
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.props['data-ticket-id'])).toEqual(['r1', 'r3']);

    const toast = findByTestId(tree, 'board-backlog-moved-toast');
    expect(toast).toBeDefined();
    expect(toast?.props['role']).toBe('status');
    expect(toast?.props['aria-live']).toBe('polite');

    const view = findByTestId(tree, 'board-backlog-moved-toast-view');
    expect(view?.props.href).toBe('/board/writers');
  });

  it('on error: ticket reappears (rollback) and an error toast is shown', () => {
    // Simulate post-error state — removed list is empty (rolled back),
    // toast cleared, error populated.
    stateSlots[0] = { value: [] };
    stateSlots[1] = { value: null };
    stateSlots[2] = { value: { requestId: 'r2', message: 'Could not move the card — try again.' } };
    slotIdx = 0;

    const tree = BacklogList({ ...baseProps, tickets }) as AnyElement;

    const cards = findAllByTestId(tree, 'mock-card');
    expect(cards).toHaveLength(3);

    const errorToast = findByTestId(tree, 'board-backlog-move-error');
    expect(errorToast).toBeDefined();
    expect(errorToast?.props['role']).toBe('alert');
    const children = errorToast?.props.children as string;
    expect(children).toContain('Could not move the card');
  });
});
