/**
 * Unit tests for the ShareWithTeamButton component (atom 5e).
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

const shareSpy = vi.fn(async (_input: unknown) => ({ ok: true }));

vi.mock('@/app/board/[groupSlug]/[ticketId]/actions', () => ({
  shareWithTeamAction: (input: unknown) => shareSpy(input),
}));

const { ShareWithTeamButton } = await import('@/components/board/ShareWithTeamButton');

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

function findAllByTestId(node: unknown, testid: string, acc: AnyElement[] = []): AnyElement[] {
  if (!node || typeof node !== 'object' || !('props' in node)) return acc;
  const el = node as AnyElement;
  const props = (el.props ?? {}) as Record<string, unknown>;
  if (props['data-testid'] === testid) acc.push(el);
  const children = props.children;
  if (children != null) {
    const list = Array.isArray(children) ? children.flat(Infinity) : [children];
    for (const child of list) findAllByTestId(child, testid, acc);
  }
  return acc;
}

const baseProps = {
  requestId: 'r1',
  groupSlug: 'writers',
  sourceGroupId: 'g-writers',
};

beforeEach(() => {
  vi.clearAllMocks();
  useTransitionMock.mockReturnValue([false, (cb: () => void) => cb()]);
  useStateMock.mockImplementation(<T,>(initial: T) => [initial, () => undefined]);
});

describe('ShareWithTeamButton — closed state', () => {
  it('renders the button enabled when there are workflow targets available', () => {
    const tree = ShareWithTeamButton({
      ...baseProps,
      availableTargets: [{ groupId: 'g-it', displayName: 'IT', slug: 'it' }],
    }) as AnyElement;

    const btn = findByTestId(tree, 'board-share-team-btn');
    expect(btn).toBeDefined();
    expect(btn?.props.disabled).toBe(false);
    expect(findByTestId(tree, 'board-share-team-dialog')).toBeUndefined();
  });

  it('renders the button disabled with a tooltip when there are no targets', () => {
    const tree = ShareWithTeamButton({
      ...baseProps,
      availableTargets: [],
    }) as AnyElement;

    const btn = findByTestId(tree, 'board-share-team-btn');
    expect(btn?.props.disabled).toBe(true);
    expect(btn?.props.title).toContain('No teams configured');
  });
});

describe('ShareWithTeamButton — open state', () => {
  it('renders one tile per available target with the right group id', () => {
    // Force `open` (the first useState call) to true.
    useStateMock.mockImplementationOnce(() => [true, () => undefined]);

    const tree = ShareWithTeamButton({
      ...baseProps,
      availableTargets: [
        { groupId: 'g-it', displayName: 'IT', slug: 'it' },
        { groupId: 'g-fundraising', displayName: 'Fundraising', slug: 'fundraising' },
      ],
    }) as AnyElement;

    expect(findByTestId(tree, 'board-share-team-dialog')).toBeDefined();
    const tiles = findAllByTestId(tree, 'board-share-team-target');
    expect(tiles.map((t) => t.props['data-target-group-id'])).toEqual(['g-it', 'g-fundraising']);
    expect(tiles.map((t) => t.props.children)).toEqual(['IT', 'Fundraising']);
  });

  it('invokes shareWithTeamAction with sourceGroupId + targetGroupId on tile click', async () => {
    useStateMock.mockImplementationOnce(() => [true, () => undefined]);

    const tree = ShareWithTeamButton({
      ...baseProps,
      availableTargets: [{ groupId: 'g-it', displayName: 'IT', slug: 'it' }],
    }) as AnyElement;

    const tile = findByTestId(tree, 'board-share-team-target');
    expect(tile).toBeDefined();
    const onClick = tile?.props.onClick as () => void;
    onClick();

    expect(shareSpy).toHaveBeenCalledWith({
      requestId: 'r1',
      groupSlug: 'writers',
      sourceGroupId: 'g-writers',
      targetGroupId: 'g-it',
    });
  });
});
