/**
 * Unit tests for NotificationRow + NotificationCapacityCallout
 * (Surface 3, PR #6 of bu-coordination-board).
 *
 * Vitest env is `node`. Same precedent as board-action-pair.test.tsx —
 * mock the server action module, call the component as a plain
 * function, walk the tree by testid.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const ackSpy = vi.fn(async (_id: string) => ({ ok: true }));

vi.mock('@/app/notifications/actions', () => ({
  acknowledgeNotificationAction: (id: string) => ackSpy(id),
}));

const { NotificationRow } = await import('@/components/notifications/NotificationRow');
const { NotificationCapacityCallout } =
  await import('@/components/notifications/NotificationCapacityCallout');

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

function flatStrings(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatStrings).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return flatStrings((node as AnyElement).props.children);
  }
  return '';
}

const baseRow = {
  id: 'n1',
  reasonKind: 'comment' as const,
  type: 'request_status_changed' as const,
  fromUserId: 'u-bette',
  fromDisplayName: 'Bette Rosenthal',
  requestId: 'r-vigil',
  requestTitle: 'Hostages: 100-day silent vigil',
  message: null,
  createdAt: new Date('2026-05-05T08:00:00Z').toISOString(),
  targetHref: '/board/writers/r-vigil',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationRow — visual states', () => {
  it('renders tinted background when lifecycle is new', () => {
    const tree = NotificationRow({
      notification: { ...baseRow, lifecycle: 'new' },
    }) as AnyElement;
    const row = findByTestId(tree, 'notification-row');
    expect(row).toBeDefined();
    expect(row?.props['data-lifecycle']).toBe('new');
    const style = row?.props.style as { background?: string } | undefined;
    expect(style?.background).toBe('var(--colour-primary-subtle)');
  });

  it('renders plain background when lifecycle is acknowledged', () => {
    const tree = NotificationRow({
      notification: { ...baseRow, lifecycle: 'acknowledged' },
    }) as AnyElement;
    const row = findByTestId(tree, 'notification-row');
    expect(row?.props['data-lifecycle']).toBe('acknowledged');
    const style = row?.props.style as { background?: string } | undefined;
    expect(style?.background).toBe('var(--colour-surface-raised)');
  });

  it('routes to the targetHref when one is supplied', () => {
    const tree = NotificationRow({
      notification: { ...baseRow, lifecycle: 'new' },
    }) as AnyElement;
    const row = findByTestId(tree, 'notification-row');
    expect(row?.props['href']).toBe('/board/writers/r-vigil');
  });

  it('falls back to /notifications when targetHref is null', () => {
    const tree = NotificationRow({
      notification: { ...baseRow, lifecycle: 'new', targetHref: null },
    }) as AnyElement;
    const row = findByTestId(tree, 'notification-row');
    expect(row?.props['href']).toBe('/notifications');
  });

  it('renders the actor name and reason verb in the sentence', () => {
    const tree = NotificationRow({
      notification: { ...baseRow, lifecycle: 'new' },
    }) as AnyElement;
    const text = flatStrings(tree);
    expect(text).toContain('Bette Rosenthal');
    expect(text).toContain('commented on');
    expect(text).toContain('Hostages: 100-day silent vigil');
  });

  it('falls back to "Someone" when actor name is missing', () => {
    const tree = NotificationRow({
      notification: {
        ...baseRow,
        lifecycle: 'new',
        fromUserId: null,
        fromDisplayName: null,
      },
    }) as AnyElement;
    expect(flatStrings(tree)).toContain('Someone');
  });
});

describe('NotificationRow — acknowledgement on click', () => {
  it('fires acknowledge when clicked while lifecycle is new', () => {
    const tree = NotificationRow({
      notification: { ...baseRow, lifecycle: 'new' },
    }) as AnyElement;
    const row = findByTestId(tree, 'notification-row');
    const onClick = row?.props.onClick as ((e: unknown) => void) | undefined;
    expect(onClick).toBeDefined();
    onClick?.({});
    expect(ackSpy).toHaveBeenCalledTimes(1);
    expect(ackSpy).toHaveBeenCalledWith('n1');
  });

  it('does not fire acknowledge when already acknowledged', () => {
    const tree = NotificationRow({
      notification: { ...baseRow, lifecycle: 'acknowledged' },
    }) as AnyElement;
    const row = findByTestId(tree, 'notification-row');
    const onClick = row?.props.onClick as ((e: unknown) => void) | undefined;
    onClick?.({});
    expect(ackSpy).not.toHaveBeenCalled();
  });
});

describe('NotificationCapacityCallout', () => {
  it('renders the shown count and a link to /notifications/history', () => {
    const tree = NotificationCapacityCallout({ shown: 50 }) as AnyElement;
    const callout = findByTestId(tree, 'notification-capacity-callout');
    expect(callout).toBeDefined();
    expect(flatStrings(tree)).toContain('Showing 50 most recent');
    const link = findByTestId(tree, 'notification-history-link');
    expect(link?.props['href']).toBe('/notifications/history');
  });
});
