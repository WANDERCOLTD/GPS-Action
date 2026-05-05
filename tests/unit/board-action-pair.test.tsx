/**
 * Unit tests for the BoardActionPair component (PR #5b).
 *
 * Vitest env is `node`. Same precedent as header-refresh-button.test.tsx —
 * mock useTransition + useState + the server actions, call the
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

const assignSpy = vi.fn(async (_input: unknown) => ({ ok: true }));
const unassignSpy = vi.fn(async (_input: unknown) => ({ ok: true }));
const followSpy = vi.fn(async (_input: unknown) => ({ ok: true }));
const unfollowSpy = vi.fn(async (_input: unknown) => ({ ok: true }));

vi.mock('@/app/board/[groupSlug]/[ticketId]/actions', () => ({
  assignSelfAction: (input: unknown) => assignSpy(input),
  unassignSelfAction: (input: unknown) => unassignSpy(input),
  followSelfAction: (input: unknown) => followSpy(input),
  unfollowSelfAction: (input: unknown) => unfollowSpy(input),
}));

const { BoardActionPair } = await import('@/components/board/BoardActionPair');

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

const baseProps = { requestId: 'r1', groupSlug: 'writers' };

beforeEach(() => {
  vi.clearAllMocks();
  useTransitionMock.mockReturnValue([false, (cb: () => void) => cb()]);
});

function assignBtn(tree: AnyElement) {
  return findByTestId(tree, 'board-action-pair-assign-btn');
}
function followBtn(tree: AnyElement) {
  return findByTestId(tree, 'board-action-pair-follow-btn');
}

describe('BoardActionPair — state combinations', () => {
  it('renders Assign me + Follow when not assigned and not following', () => {
    const tree = BoardActionPair({
      ...baseProps,
      assigned: false,
      following: false,
    }) as AnyElement;
    const root = findByTestId(tree, 'board-action-pair');
    expect(root?.props['data-assigned']).toBe('false');
    expect(root?.props['data-following']).toBe('false');
    expect(assignBtn(tree)?.props['data-state']).toBe('unassigned');
    expect(followBtn(tree)?.props['data-state']).toBe('unfollowed');
    expect(assignBtn(tree)?.props.children).toContain('Assign me');
    expect(followBtn(tree)?.props.children).toContain('Follow');
  });

  it('renders Unassign + Follow when assigned but not following', () => {
    const tree = BoardActionPair({
      ...baseProps,
      assigned: true,
      following: false,
    }) as AnyElement;
    const root = findByTestId(tree, 'board-action-pair');
    expect(root?.props['data-assigned']).toBe('true');
    expect(assignBtn(tree)?.props['data-state']).toBe('assigned');
    expect(followBtn(tree)?.props['data-state']).toBe('unfollowed');
    expect(assignBtn(tree)?.props.children).toContain('Unassign');
  });

  it('renders Assign me + Unfollow when not assigned but following', () => {
    const tree = BoardActionPair({
      ...baseProps,
      assigned: false,
      following: true,
    }) as AnyElement;
    expect(assignBtn(tree)?.props['data-state']).toBe('unassigned');
    expect(followBtn(tree)?.props['data-state']).toBe('following');
    expect(followBtn(tree)?.props.children).toContain('Unfollow');
  });

  it('renders Unassign + Unfollow when assigned and following', () => {
    const tree = BoardActionPair({
      ...baseProps,
      assigned: true,
      following: true,
    }) as AnyElement;
    const root = findByTestId(tree, 'board-action-pair');
    expect(root?.props['data-assigned']).toBe('true');
    expect(root?.props['data-following']).toBe('true');
    expect(assignBtn(tree)?.props['data-state']).toBe('assigned');
    expect(followBtn(tree)?.props['data-state']).toBe('following');
  });
});

describe('BoardActionPair — interactions', () => {
  it('calls assignSelfAction when not yet assigned', () => {
    const tree = BoardActionPair({
      ...baseProps,
      assigned: false,
      following: false,
    }) as AnyElement;
    (assignBtn(tree)?.props.onClick as () => void)();
    expect(assignSpy).toHaveBeenCalledWith({ requestId: 'r1', groupSlug: 'writers' });
    expect(unassignSpy).not.toHaveBeenCalled();
  });

  it('calls unassignSelfAction when already assigned', () => {
    const tree = BoardActionPair({
      ...baseProps,
      assigned: true,
      following: false,
    }) as AnyElement;
    (assignBtn(tree)?.props.onClick as () => void)();
    expect(unassignSpy).toHaveBeenCalledWith({ requestId: 'r1', groupSlug: 'writers' });
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('calls followSelfAction when not yet following', () => {
    const tree = BoardActionPair({
      ...baseProps,
      assigned: false,
      following: false,
    }) as AnyElement;
    (followBtn(tree)?.props.onClick as () => void)();
    expect(followSpy).toHaveBeenCalledWith({ requestId: 'r1', groupSlug: 'writers' });
    expect(unfollowSpy).not.toHaveBeenCalled();
  });

  it('calls unfollowSelfAction when already following', () => {
    const tree = BoardActionPair({
      ...baseProps,
      assigned: false,
      following: true,
    }) as AnyElement;
    (followBtn(tree)?.props.onClick as () => void)();
    expect(unfollowSpy).toHaveBeenCalledWith({ requestId: 'r1', groupSlug: 'writers' });
    expect(followSpy).not.toHaveBeenCalled();
  });

  it('disables both buttons while a transition is pending', () => {
    useTransitionMock.mockReturnValue([true, (cb: () => void) => cb()]);
    const tree = BoardActionPair({
      ...baseProps,
      assigned: false,
      following: false,
    }) as AnyElement;
    expect(assignBtn(tree)?.props.disabled).toBe(true);
    expect(followBtn(tree)?.props.disabled).toBe(true);
  });
});
