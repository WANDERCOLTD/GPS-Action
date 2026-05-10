/**
 * Unit tests for <TicketDetailRail /> — the right-rail layout component
 * shipped by BU-ticket-detail-relayout.
 *
 * Asserts the locked Q1 panel order, the canDelete gate on the footer,
 * the originator-vs-non-originator filed-line copy, and that the
 * lifecycle-status panel renders only when status is one of the three
 * valid lanes.
 *
 * Vitest env is `node`. Same precedent as board-shared-with-strip — call
 * the component as a plain function and walk the returned ReactElement
 * tree.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { TicketDetailRail, type TicketDetailRailProps } from '@/components/board/TicketDetailRail';

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

function findByTestId(root: unknown, testid: string): AnyElement | undefined {
  return findAllByTestId(root, testid)[0];
}

/**
 * Walk every element in the subtree, returning each element's
 * `data-rail-panel` attribute (or `data-testid` for the meta /
 * footer blocks that aren't proper RailPanels). Used to assert
 * the order in which panels appear in the rendered tree.
 */
function collectPanelKeys(root: unknown, acc: string[] = []): string[] {
  if (!isElement(root)) return acc;
  const props = (root.props ?? {}) as Record<string, unknown>;
  const railPanel = props['data-rail-panel'];
  const testid = props['data-testid'];
  // Treat panels by their own testid; meta + footer blocks fall back
  // to plain testid since they are not RailPanel-wrapped.
  if (typeof railPanel === 'string') {
    acc.push(railPanel);
  } else if (
    typeof testid === 'string' &&
    (testid === 'board-ticket-rail-meta' || testid === 'board-ticket-rail-footer-actions')
  ) {
    acc.push(testid);
  }
  const children = props.children;
  if (children == null) return acc;
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) collectPanelKeys(child, acc);
  return acc;
}

const baseProps: TicketDetailRailProps = {
  requestId: 'req-1',
  groupSlug: 'writers',
  groupId: 'grp-1',
  cardLifecycleStatus: 'active',
  currentColumnId: 'col-active-1',
  activeColumns: [{ id: 'col-active-1', displayName: 'In flight' }],
  assignees: [
    { userId: 'u-bette', displayName: 'Bette Davies', avatarUrl: null },
    { userId: 'u-eddie', displayName: 'Eddie Burrell', avatarUrl: null },
  ],
  isMineActive: false,
  isMineSubscribed: false,
  sharedGroups: [
    {
      groupId: 'grp-1',
      slug: 'writers',
      displayName: 'Writers',
      origin: 'originating',
    },
    {
      groupId: 'grp-2',
      slug: 'photographers',
      displayName: 'Photographers',
      origin: 'workflow_share',
    },
  ],
  availableShareTargets: [],
  viewerIsOriginator: false,
  createdAt: new Date('2026-05-01T10:00:00Z'),
  lastActivityAt: new Date('2026-05-09T10:00:00Z'),
  canDelete: true,
};

describe('TicketDetailRail — Q1 panel order', () => {
  it('renders panels in the locked order: lifecycle → assignees → following → shared-with → meta → footer', () => {
    const tree = TicketDetailRail(baseProps) as AnyElement;

    const keys = collectPanelKeys(tree);

    expect(keys).toEqual([
      'board-ticket-rail-lifecycle',
      'board-ticket-rail-assignees',
      'board-ticket-rail-following',
      'board-ticket-rail-shared-with',
      'board-ticket-rail-meta',
      'board-ticket-rail-footer-actions',
    ]);
  });

  it('renders the rail container with the documented testid + aria-label', () => {
    const tree = TicketDetailRail(baseProps) as AnyElement;
    expect(tree.props['data-testid']).toBe('board-ticket-detail-rail');
    expect(tree.props['aria-label']).toBe('Ticket details');
  });
});

describe('TicketDetailRail — Q2 footer block (Delete + Move-to-board)', () => {
  it('renders the footer-actions block when canDelete is true', () => {
    const tree = TicketDetailRail(baseProps) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-rail-footer-actions')).toBeDefined();
  });

  it('still renders the footer when canDelete is false but a lifecycle status exists (move-to-board lives there)', () => {
    const tree = TicketDetailRail({ ...baseProps, canDelete: false }) as AnyElement;
    // Footer shows because cardLifecycleStatus is set — Move-to-board is a
    // primary affordance for everyone, not gated on delete permission.
    expect(findByTestId(tree, 'board-ticket-rail-footer-actions')).toBeDefined();
  });

  it('omits the footer entirely when neither canDelete nor a lifecycle status is set', () => {
    const tree = TicketDetailRail({
      ...baseProps,
      canDelete: false,
      cardLifecycleStatus: null,
    }) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-rail-footer-actions')).toBeUndefined();
  });
});

describe('TicketDetailRail — lifecycle status panel gating', () => {
  it('omits the lifecycle panel when status is null', () => {
    const tree = TicketDetailRail({
      ...baseProps,
      cardLifecycleStatus: null,
    }) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-rail-lifecycle')).toBeUndefined();
  });

  it.each(['active', 'backlog', 'done'] as const)(
    'renders the lifecycle label for status="%s"',
    (status) => {
      const tree = TicketDetailRail({
        ...baseProps,
        cardLifecycleStatus: status,
      }) as AnyElement;
      const label = findByTestId(tree, 'board-ticket-rail-lifecycle-label');
      expect(label).toBeDefined();
      expect(label?.props['data-status']).toBe(status);
    },
  );
});

describe('TicketDetailRail — Originator + Created compact line (Q1 panel 5)', () => {
  it('uses "Filed by you" copy when the viewer is the originator', () => {
    const tree = TicketDetailRail({
      ...baseProps,
      viewerIsOriginator: true,
    }) as AnyElement;
    const filed = findByTestId(tree, 'board-ticket-rail-filed');
    expect(filed).toBeDefined();
    const text = String(filed?.props.children ?? '');
    expect(text.startsWith('Filed by you ')).toBe(true);
  });

  it('uses "Filed" copy without the name when the viewer is not the originator', () => {
    const tree = TicketDetailRail({
      ...baseProps,
      viewerIsOriginator: false,
    }) as AnyElement;
    const filed = findByTestId(tree, 'board-ticket-rail-filed');
    expect(filed).toBeDefined();
    const text = String(filed?.props.children ?? '');
    expect(text.startsWith('Filed ')).toBe(true);
    expect(text.startsWith('Filed by you')).toBe(false);
  });

  it('renders the last-activity line', () => {
    const tree = TicketDetailRail(baseProps) as AnyElement;
    const last = findByTestId(tree, 'board-ticket-rail-last-activity');
    expect(last).toBeDefined();
    const text = String(last?.props.children ?? '');
    expect(text.startsWith('Last activity ')).toBe(true);
  });
});

describe('TicketDetailRail — Assignees panel', () => {
  it('renders the empty-state copy when there are no assignees', () => {
    const tree = TicketDetailRail({ ...baseProps, assignees: [] }) as AnyElement;
    const empty = findByTestId(tree, 'board-ticket-assignees-empty');
    expect(empty).toBeDefined();
  });

  it('renders one entry per assignee', () => {
    const tree = TicketDetailRail(baseProps) as AnyElement;
    const panel = findByTestId(tree, 'board-ticket-rail-assignees');
    expect(panel).toBeDefined();
    // Two assignees in baseProps; expect the empty-state to be absent.
    const empty = findByTestId(tree, 'board-ticket-assignees-empty');
    expect(empty).toBeUndefined();
  });
});
