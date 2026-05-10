/**
 * Unit tests for SharedWithStrip — covers the Item 5 (Sub-build D)
 * filter that drops the originating-team pill from the rendered
 * strip. The originating team is already named in the breadcrumb
 * ("← Writers board"), so showing it again here is redundant.
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

const unshareSpy = vi.fn(async (_input: unknown) => ({ ok: true }));

vi.mock('@/app/board/[groupSlug]/[ticketId]/actions', () => ({
  unshareFromTeamAction: (input: unknown) => unshareSpy(input),
}));

const { SharedWithStrip } = await import('@/components/board/SharedWithStrip');

type AnyElement = ReactElement<Record<string, unknown>>;

function isElement(node: unknown): node is AnyElement {
  return Boolean(node) && typeof node === 'object' && node !== null && 'props' in node;
}

function findAllByTestId(root: unknown, testid: string, acc: AnyElement[] = []): AnyElement[] {
  if (!isElement(root)) return acc;
  const props = (root.props ?? {}) as Record<string, unknown>;
  if (props['data-testid'] === testid) acc.push(root);
  const children = props.children;
  if (children == null) return acc;
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) findAllByTestId(child, testid, acc);
  return acc;
}

const baseProps = {
  requestId: 'r1',
  groupSlug: 'writers',
};

beforeEach(() => {
  vi.clearAllMocks();
  useTransitionMock.mockReturnValue([false, (cb: () => void) => cb()]);
});

describe('SharedWithStrip — Item 5 (Sub-build D): drop originating team', () => {
  it('hides the originating-team pill, keeps shared pills', () => {
    const tree = SharedWithStrip({
      ...baseProps,
      groups: [
        {
          groupId: 'g-writers',
          slug: 'writers',
          displayName: 'Writers',
          origin: 'originating',
        },
        {
          groupId: 'g-photo',
          slug: 'photographers',
          displayName: 'Photographers',
          origin: 'workflow_share',
        },
        {
          groupId: 'g-comms',
          slug: 'comms',
          displayName: 'Comms',
          origin: 'ad_hoc_share',
        },
      ],
    }) as AnyElement;

    const pills = findAllByTestId(tree, 'board-ticket-shared-with-pill');
    expect(pills).toHaveLength(2);
    const origins = pills.map((p) => p.props['data-origin']);
    expect(origins).not.toContain('originating');
    expect(origins).toContain('workflow_share');
    expect(origins).toContain('ad_hoc_share');
  });

  it('renders nothing when only the originating team is in the list', () => {
    const tree = SharedWithStrip({
      ...baseProps,
      groups: [
        {
          groupId: 'g-writers',
          slug: 'writers',
          displayName: 'Writers',
          origin: 'originating',
        },
      ],
    });

    expect(tree).toBeNull();
  });

  it('every visible pill exposes an unshare button (no originating exception)', () => {
    const tree = SharedWithStrip({
      ...baseProps,
      groups: [
        {
          groupId: 'g-writers',
          slug: 'writers',
          displayName: 'Writers',
          origin: 'originating',
        },
        {
          groupId: 'g-photo',
          slug: 'photographers',
          displayName: 'Photographers',
          origin: 'workflow_share',
        },
      ],
    }) as AnyElement;

    const unshareBtns = findAllByTestId(tree, 'board-ticket-shared-with-unshare-btn');
    // Only one pill renders (Photographers), and it carries the unshare
    // button. The originating Writers pill is dropped entirely so there
    // is no "no × on this one" special case to maintain.
    expect(unshareBtns).toHaveLength(1);
    expect(unshareBtns[0]?.props['data-target-group-id']).toBe('g-photo');
  });
});
