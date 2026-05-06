/**
 * Unit tests for the UrgentToggle component (urgent-flip atom).
 *
 * Vitest env is `node`. Same precedent as board-action-pair.test.tsx —
 * mock useTransition + useState + the server action, call the
 * component as a plain function, walk the tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const useTransitionMock = vi.fn<() => [boolean, (cb: () => void) => void]>(() => [
  false,
  (cb: () => void) => cb(),
]);

const useStateMock = vi.fn<<T>(initial: T) => [T, (value: T) => void]>((initial) => [
  initial,
  () => undefined,
]);

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useTransition: () => useTransitionMock(),
    useState: <T,>(initial: T) => useStateMock(initial),
  };
});

const setUrgentSpy = vi.fn(async (_input: unknown) => ({ ok: true }));

vi.mock('@/app/board/[groupSlug]/[ticketId]/actions', () => ({
  setUrgentAction: (input: unknown) => setUrgentSpy(input),
}));

const { UrgentToggle } = await import('@/components/board/UrgentToggle');

type AnyElement = ReactElement<Record<string, unknown>>;

function findByTestId(node: unknown, testid: string): AnyElement | undefined {
  if (!node || typeof node !== 'object' || !('props' in node)) return undefined;
  const el = node as AnyElement;
  const props = (el.props ?? {}) as Record<string, unknown>;
  if (props['data-testid'] === testid) return el;
  const children = props.children;
  if (children == null) return undefined;
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) {
    const found = findByTestId(child, testid);
    if (found) return found;
  }
  return undefined;
}

const baseProps = {
  requestId: 'r1',
  groupId: 'g-writers',
  groupSlug: 'writers',
};

beforeEach(() => {
  vi.clearAllMocks();
  useTransitionMock.mockReturnValue([false, (cb: () => void) => cb()]);
  useStateMock.mockImplementation(<T,>(initial: T) => [initial, () => undefined]);
});

describe('UrgentToggle — labels', () => {
  it('renders "Mark Urgent" when not currently urgent', () => {
    const tree = UrgentToggle({ ...baseProps, urgent: false }) as AnyElement;
    const root = findByTestId(tree, 'board-urgent-toggle');
    expect(root?.props['data-urgent']).toBe('false');
    const btn = findByTestId(tree, 'board-urgent-toggle-btn');
    expect(btn?.props.children).toEqual(expect.arrayContaining(['Mark Urgent']));
  });

  it('renders "Clear Urgent" when currently urgent', () => {
    const tree = UrgentToggle({ ...baseProps, urgent: true }) as AnyElement;
    const root = findByTestId(tree, 'board-urgent-toggle');
    expect(root?.props['data-urgent']).toBe('true');
    const btn = findByTestId(tree, 'board-urgent-toggle-btn');
    expect(btn?.props.children).toEqual(expect.arrayContaining(['Clear Urgent']));
  });
});

describe('UrgentToggle — action invocation', () => {
  it('calls setUrgentAction with urgent=true when clicking from not-urgent', () => {
    const tree = UrgentToggle({ ...baseProps, urgent: false }) as AnyElement;
    const btn = findByTestId(tree, 'board-urgent-toggle-btn');
    const onClick = btn?.props.onClick as () => void;
    onClick();

    expect(setUrgentSpy).toHaveBeenCalledWith({
      requestId: 'r1',
      groupSlug: 'writers',
      groupId: 'g-writers',
      urgent: true,
    });
  });

  it('calls setUrgentAction with urgent=false when clicking from urgent', () => {
    const tree = UrgentToggle({ ...baseProps, urgent: true }) as AnyElement;
    const btn = findByTestId(tree, 'board-urgent-toggle-btn');
    const onClick = btn?.props.onClick as () => void;
    onClick();

    expect(setUrgentSpy).toHaveBeenCalledWith({
      requestId: 'r1',
      groupSlug: 'writers',
      groupId: 'g-writers',
      urgent: false,
    });
  });
});
