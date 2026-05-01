/**
 * @build-unit BU-requests-card-lift
 * @spec build/session-briefs/bu-requests-card-lift.md
 *
 * Unit tests for the lifted RequestRow. Vitest env is `node`, no RTL —
 * we mock `next/navigation` + the action buttons + UserAvatar so we can
 * invoke the component as a plain function and walk the React element
 * tree (same pattern as post-card.test.tsx).
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { Prisma, RequestPriority, RequestStatus, RequestType } from '@prisma/client';

const pushSpy = vi.fn<(href: string) => void>();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

vi.mock('@/components/RequestActionButtons', () => ({
  ClaimButton: () => null,
  ResolveForm: () => null,
}));

// UserAvatar is left unmocked — RequestRow constructs the React
// element via JSX but the test walker doesn't invoke function
// components, so the avatar's internal markup never executes. We
// assert on the props passed to it instead (see the byline test).

const { RequestRow } = (await import('@/components/RequestRow')) as unknown as {
  RequestRow: (props: Record<string, unknown>) => ReactElement;
};

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement | null | undefined): AnyElement[] {
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

function makeRow(overrides: Partial<RequestRowInput> = {}): RequestRowInput {
  return {
    id: 'req-1',
    type: 'vetting' as RequestType,
    status: 'unclaimed' as RequestStatus,
    context: { summary: 'Sharon wants to join the Manchester chapter' } as Prisma.JsonValue,
    regionSlug: null,
    createdAt: new Date('2026-04-30T10:00:00Z'),
    createdByUserId: 'u-submitter',
    claimedByUserId: null,
    claimedAt: null,
    resolvedAt: null,
    resolutionNotes: null,
    urgency: false,
    urgencyExpiresAt: null,
    kindSlug: null,
    kindDisplayName: null,
    priority: 'normal' as RequestPriority,
    claimedBy: null,
    createdBy: { id: 'u-submitter', displayName: 'Sharon Cohen', avatarUrl: null },
    ...overrides,
  };
}

interface RequestRowInput {
  id: string;
  type: RequestType;
  status: RequestStatus;
  context: Prisma.JsonValue;
  regionSlug: string | null;
  createdAt: Date;
  createdByUserId: string | null;
  claimedByUserId: string | null;
  claimedAt: Date | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  urgency: boolean;
  urgencyExpiresAt: Date | null;
  kindSlug: string | null;
  kindDisplayName: string | null;
  priority: RequestPriority;
  claimedBy: { id: string; displayName: string; avatarUrl: string | null } | null;
  createdBy: { id: string; displayName: string; avatarUrl: string | null } | null;
}

describe('RequestRow — visual lift', () => {
  it('preserves the requests-row-card testid and data-urgent gate', () => {
    const tree = RequestRow({
      row: makeRow({ urgency: true }),
      canAct: false,
      callerId: 'caller',
    }) as AnyElement;
    expect(tree.props['data-testid']).toBe('requests-row-card');
    expect(tree.props['data-urgent']).toBe(true);

    const calm = RequestRow({
      row: makeRow({ urgency: false }),
      canAct: false,
      callerId: 'caller',
    }) as AnyElement;
    expect(calm.props['data-urgent']).toBeUndefined();
  });

  it('renders a tone-coded type chip with the right gps-chip modifier', () => {
    const cases: Array<[RequestType, string]> = [
      ['vetting', 'gps-chip--info'],
      ['flag', 'gps-chip--warning'],
      ['incident', 'gps-chip--urgent'],
      ['content_submission', 'gps-chip--primary'],
      ['edit_request', 'gps-chip--neutral'],
    ];
    for (const [type, tone] of cases) {
      const tree = RequestRow({
        row: makeRow({ type }),
        canAct: false,
        callerId: 'caller',
      }) as AnyElement;
      const chip = findByTestId(tree, 'requests-row-type-chip');
      expect(chip, `type chip for ${type}`).toBeDefined();
      expect(chip?.props['data-type']).toBe(type);
      expect(String(chip?.props.className)).toContain(tone);
    }
  });

  it('renders the submitter byline with avatar + name + verb', () => {
    const tree = RequestRow({
      row: makeRow(),
      canAct: false,
      callerId: 'caller',
    }) as AnyElement;
    const byline = findByTestId(tree, 'requests-row-submitter-byline');
    expect(byline).toBeDefined();
    expect(byline?.props['data-user-id']).toBe('u-submitter');
    // Byline contains a UserAvatar element with the row's submitter
    // (the walker doesn't invoke function components, so we look for
    // the avatar element by its props rather than testid).
    const children = flatChildren(byline);
    const hasAvatarProps = children.some(
      (c) =>
        typeof c.props === 'object' &&
        c.props !== null &&
        (c.props as Record<string, unknown>).userId === 'u-submitter' &&
        (c.props as Record<string, unknown>).displayName === 'Sharon Cohen',
    );
    expect(hasAvatarProps).toBe(true);
    // Submitter name is in the byline text content.
    const flat = JSON.stringify(byline);
    expect(flat).toContain('Sharon Cohen');
    expect(flat).toContain('submitted this');
  });

  it('promotes the context summary as the primary content', () => {
    const tree = RequestRow({
      row: makeRow(),
      canAct: false,
      callerId: 'caller',
    }) as AnyElement;
    const summary = findByTestId(tree, 'requests-row-summary');
    expect(summary).toBeDefined();
    expect(summary?.props.children).toBe('Sharon wants to join the Manchester chapter');
    expect(summary?.props['data-empty']).toBeUndefined();
    // Primary content uses the base text size (var(--text-base)).
    const style = summary?.props.style as Record<string, string> | undefined;
    expect(style?.fontSize).toBe('var(--text-base)');
    expect(style?.color).toBe('var(--colour-text-primary)');
  });

  it('falls back to the type label when ctxText is empty', () => {
    const tree = RequestRow({
      row: makeRow({ context: {}, type: 'vetting' }),
      canAct: false,
      callerId: 'caller',
    }) as AnyElement;
    const summary = findByTestId(tree, 'requests-row-summary');
    expect(summary?.props.children).toBe('Vetting application');
    expect(summary?.props['data-empty']).toBe(true);
  });

  it('does not render the priority chip when priority=normal', () => {
    const tree = RequestRow({
      row: makeRow({ priority: 'normal' }),
      canAct: false,
      callerId: 'caller',
    }) as AnyElement;
    expect(findByTestId(tree, 'requests-row-priority-chip')).toBeUndefined();
  });

  it('renders priority chip with the right tone for non-normal priorities', () => {
    const cases: Array<[RequestPriority, string]> = [
      ['urgent', 'gps-chip--urgent'],
      ['high', 'gps-chip--warning'],
      ['low', 'gps-chip--neutral'],
    ];
    for (const [priority, tone] of cases) {
      const tree = RequestRow({
        row: makeRow({ priority }),
        canAct: false,
        callerId: 'caller',
      }) as AnyElement;
      const chip = findByTestId(tree, 'requests-row-priority-chip');
      expect(chip, `priority chip for ${priority}`).toBeDefined();
      expect(chip?.props['data-priority']).toBe(priority);
      expect(String(chip?.props.className)).toContain(tone);
    }
  });

  it('keeps the urgent badge alongside the type chip when urgency=true', () => {
    const tree = RequestRow({
      row: makeRow({ urgency: true, kindDisplayName: 'Demo at Westminster' }),
      canAct: false,
      callerId: 'caller',
    }) as AnyElement;
    expect(findByTestId(tree, 'requests-row-urgent-badge')).toBeDefined();
    expect(findByTestId(tree, 'requests-row-type-chip')).toBeDefined();
  });
});
