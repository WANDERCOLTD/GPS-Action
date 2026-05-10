/**
 * Unit tests for NetworkCard.
 *
 * @build-unit BU-network-feed
 * @spec adrs/0017-network-card-state.md
 *
 * Vitest env is `node` — no RTL. We invoke NetworkCard as a plain
 * function and walk the ReactElement tree to assert the contract:
 *
 *   - link target is the upstream URL with new-tab + rel=noopener
 *   - anonymous-member fallback when fromName is null, with
 *     `data-anon="true"` for the parent's clustering hook
 *   - triage controls render the three statuses + Reset (when not NEW)
 *   - onSetStatus is dispatched with the right value when a button
 *     is invoked (no React rendering — calls the onClick handler
 *     directly to keep the test env-agnostic)
 *   - card refuses to dispatch a triage call while pending
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactElement, MouseEvent } from 'react';
import { NetworkCard } from '@/components/NetworkCard';
import type { SerializedNetworkCard } from '@/shared/network-card';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    const c = e.props.children;
    if (Array.isArray(c)) c.forEach(walk);
    else walk(c);
  };
  walk(el);
  return acc;
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return flatChildren(el).find((e) => e.props['data-testid'] === testId);
}

function makeCard(overrides: Partial<SerializedNetworkCard> = {}): SerializedNetworkCard {
  return {
    messageId: '42',
    sentAt: '2026-05-09T12:00:00.000Z',
    url: 'https://example.com/article',
    linkTitle: 'A useful article',
    textBody: 'Worth a read',
    fromName: 'Sharon',
    senderHash: 'hash-sharon',
    chatId: 'gps-network@g.us',
    state: {
      status: 'NEW',
      ownerUserId: null,
      ownerDisplayName: null,
      notes: null,
      updatedAt: null,
    },
    ...overrides,
  };
}

function fakeMouseEvent(): MouseEvent<HTMLButtonElement> {
  return { preventDefault: vi.fn() } as unknown as MouseEvent<HTMLButtonElement>;
}

describe('NetworkCard', () => {
  it('renders the link title with the URL as click target, new tab, noopener', () => {
    const tree = NetworkCard({
      card: makeCard(),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    const link = findByTestId(tree, 'network-card-link');
    expect(link).toBeDefined();
    expect(link?.props.href).toBe('https://example.com/article');
    expect(link?.props.target).toBe('_blank');
    expect(link?.props.rel).toBe('noopener noreferrer');
  });

  it('falls back to URL hostname when linkTitle is null', () => {
    const tree = NetworkCard({
      card: makeCard({ linkTitle: null }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    const link = findByTestId(tree, 'network-card-link');
    const text = link?.props.children;
    expect(text).toBe('example.com');
  });

  it('renders "anonymous member" when fromName is null and tags data-anon', () => {
    const tree = NetworkCard({
      card: makeCard({ fromName: null }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(tree.props['data-anon']).toBe('true');
    const sender = findByTestId(tree, 'network-card-sender');
    expect(sender?.props.children).toBe('anonymous member');
  });

  it('omits the body row when textBody is null', () => {
    const tree = NetworkCard({
      card: makeCard({ textBody: null }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(findByTestId(tree, 'network-card-body')).toBeUndefined();
  });

  it('renders Triaged / Promoted / Discarded buttons when status is NEW', () => {
    const tree = NetworkCard({
      card: makeCard(),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(findByTestId(tree, 'network-card-triage-triaged')).toBeDefined();
    expect(findByTestId(tree, 'network-card-triage-promoted')).toBeDefined();
    expect(findByTestId(tree, 'network-card-triage-discarded')).toBeDefined();
    // No Reset button at NEW.
    expect(findByTestId(tree, 'network-card-triage-reset')).toBeUndefined();
  });

  it('shows the Reset button when status is non-NEW', () => {
    const tree = NetworkCard({
      card: makeCard({
        state: {
          status: 'TRIAGED',
          ownerUserId: null,
          ownerDisplayName: null,
          notes: null,
          updatedAt: null,
        },
      }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(findByTestId(tree, 'network-card-triage-reset')).toBeDefined();
  });

  it('dispatches onSetStatus with the target status when a button is clicked', () => {
    const onSetStatus = vi.fn();
    const tree = NetworkCard({
      card: makeCard(),
      onSetStatus,
      pending: false,
    }) as AnyElement;

    const promote = findByTestId(tree, 'network-card-triage-promoted');
    expect(promote).toBeDefined();
    const onClick = promote?.props.onClick as (e: MouseEvent<HTMLButtonElement>) => void;
    onClick(fakeMouseEvent());
    expect(onSetStatus).toHaveBeenCalledWith('PROMOTED');
  });

  it('refuses to dispatch when pending: true', () => {
    const onSetStatus = vi.fn();
    const tree = NetworkCard({
      card: makeCard(),
      onSetStatus,
      pending: true,
    }) as AnyElement;

    const triage = findByTestId(tree, 'network-card-triage-triaged');
    const onClick = triage?.props.onClick as (e: MouseEvent<HTMLButtonElement>) => void;
    onClick(fakeMouseEvent());
    expect(onSetStatus).not.toHaveBeenCalled();
    expect(triage?.props.disabled).toBe(true);
  });

  it('marks the active triage button via background style when status matches', () => {
    const tree = NetworkCard({
      card: makeCard({
        state: {
          status: 'PROMOTED',
          ownerUserId: null,
          ownerDisplayName: null,
          notes: null,
          updatedAt: null,
        },
      }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    const promoted = findByTestId(tree, 'network-card-triage-promoted');
    const triaged = findByTestId(tree, 'network-card-triage-triaged');
    const promotedBg = (promoted?.props.style as { background: string }).background;
    const triagedBg = (triaged?.props.style as { background: string }).background;
    expect(promotedBg).toBe('var(--colour-surface-sunken)');
    expect(triagedBg).toBe('transparent');
  });

  it('exposes the status on the article via data-status', () => {
    const tree = NetworkCard({
      card: makeCard({
        state: {
          status: 'DISCARDED',
          ownerUserId: null,
          ownerDisplayName: null,
          notes: null,
          updatedAt: null,
        },
      }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(tree.props['data-status']).toBe('DISCARDED');
  });
});
