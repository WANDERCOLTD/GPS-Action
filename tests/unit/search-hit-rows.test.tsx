/**
 * Unit tests for the per-entity search row components.
 *
 * @build-unit BU-search-result-cards
 * @spec build/session-briefs/bu-search-result-cards.md
 *
 * Asserts the row components surface the canonical primitives the rest
 * of the app uses — `KindChip`, `AvatarBubble`, role chips, signal
 * glyph for posts; `MapPin` + slug subtitle for regions; byline-style
 * pattern for people. Same plain-function-as-component walker pattern
 * as the SearchShell tests.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';

import {
  SearchPostHitRow,
  SearchPersonHitRow,
  SearchRegionHitRow,
  SearchTicketHitRow,
} from '@/components/SearchHitRows';
import type {
  PostSearchHit,
  PersonSearchHit,
  RegionSearchHit,
  TicketSearchHit,
} from '@/server/routers/search';
import { AvatarBubble, KindChip } from '@/components/post-meta';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    if (typeof e.type === 'function') {
      try {
        const rendered = (e.type as (props: unknown) => unknown)(e.props);
        walk(rendered);
      } catch {
        // ignore
      }
      return;
    }
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

function findAllByTestId(el: AnyElement, testId: string): AnyElement[] {
  return flatChildren(el).filter((e) => e.props['data-testid'] === testId);
}

function findFirstOfType(el: AnyElement, type: AnyElement['type']): AnyElement | undefined {
  return flatChildren(el).find((e) => e.type === type);
}

function makePost(overrides: Partial<PostSearchHit> = {}): PostSearchHit {
  return {
    id: 'p1',
    href: '/post/p1',
    title: 'A post',
    kindSlug: 'thought',
    kindDisplayName: 'Thought',
    urgency: false,
    signal: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    author: { id: 'u1', displayName: 'Sharon Cohen', roles: [] },
    ...overrides,
  };
}

function makePerson(overrides: Partial<PersonSearchHit> = {}): PersonSearchHit {
  return {
    id: 'u1',
    href: '/profile/u1',
    displayName: 'Sharon Cohen',
    roles: [],
    ...overrides,
  };
}

function makeRegion(overrides: Partial<RegionSearchHit> = {}): RegionSearchHit {
  return {
    id: 'r1',
    href: '/regions/hendon',
    displayName: 'Hendon',
    slug: 'hendon',
    ...overrides,
  };
}

// ── Post row ───────────────────────────────────────────────────────────

describe('SearchPostHitRow', () => {
  it('renders a Link to the post href with entity_type and position metadata', () => {
    const tree = SearchPostHitRow({ hit: makePost(), position: 2 }) as AnyElement;
    expect(tree.props.href).toBe('/post/p1');
    expect(tree.props['data-entity-type']).toBe('posts');
    expect(tree.props['data-position']).toBe(2);
    expect(tree.props['data-testid']).toBe('search-result-item');
  });

  it('renders a KindChip with the post kind and urgency flag', () => {
    const tree = SearchPostHitRow({
      hit: makePost({ kindSlug: 'event', urgency: true }),
      position: 0,
    }) as AnyElement;
    const kindChip = findFirstOfType(tree, KindChip);
    expect(kindChip).toBeDefined();
    expect(kindChip?.props.kindSlug).toBe('event');
    expect(kindChip?.props.urgency).toBe(true);
  });

  it('renders an AvatarBubble for the author', () => {
    const tree = SearchPostHitRow({
      hit: makePost({ author: { id: 'u1', displayName: 'Sharon Cohen', roles: [] } }),
      position: 0,
    }) as AnyElement;
    const avatar = findFirstOfType(tree, AvatarBubble);
    expect(avatar).toBeDefined();
    expect(avatar?.props.displayName).toBe('Sharon Cohen');
  });

  it('surfaces author role chips when the author has roles', () => {
    const tree = SearchPostHitRow({
      hit: makePost({
        author: { id: 'u1', displayName: 'Sharon Cohen', roles: ['admin', 'queue_manager'] },
      }),
      position: 0,
    }) as AnyElement;
    const chips = findAllByTestId(tree, 'search-role-chip');
    expect(chips.map((c) => c.props['data-role'])).toEqual(['admin', 'queue_manager']);
  });

  it('omits role chips when the author has no roles', () => {
    const tree = SearchPostHitRow({
      hit: makePost({ author: { id: 'u1', displayName: 'Sharon', roles: [] } }),
      position: 0,
    }) as AnyElement;
    expect(findAllByTestId(tree, 'search-role-chip')).toEqual([]);
  });

  it('renders the inline signal glyph for tick_or_cross posts', () => {
    const promote = SearchPostHitRow({
      hit: makePost({ signal: 'promote' }),
      position: 0,
    }) as AnyElement;
    const remove = SearchPostHitRow({
      hit: makePost({ signal: 'remove' }),
      position: 0,
    }) as AnyElement;
    expect(findByTestId(promote, 'search-result-signal')?.props['data-signal']).toBe('promote');
    expect(findByTestId(remove, 'search-result-signal')?.props['data-signal']).toBe('remove');
  });

  it('omits the signal glyph when signal is null', () => {
    const tree = SearchPostHitRow({ hit: makePost({ signal: null }), position: 0 }) as AnyElement;
    expect(findByTestId(tree, 'search-result-signal')).toBeUndefined();
  });

  it('forwards onClick to the Link', () => {
    let called = 0;
    const tree = SearchPostHitRow({
      hit: makePost(),
      position: 0,
      onClick: () => {
        called += 1;
      },
    }) as AnyElement;
    (tree.props.onClick as (...args: unknown[]) => void)();
    expect(called).toBe(1);
  });
});

// ── Person row ─────────────────────────────────────────────────────────

describe('SearchPersonHitRow', () => {
  it('renders an AvatarBubble + display name + role chips', () => {
    const tree = SearchPersonHitRow({
      hit: makePerson({ displayName: 'Sharon Cohen', roles: ['queue_manager'] }),
      position: 0,
    }) as AnyElement;
    const avatar = findFirstOfType(tree, AvatarBubble);
    expect(avatar?.props.displayName).toBe('Sharon Cohen');
    expect(findAllByTestId(tree, 'search-role-chip').map((c) => c.props['data-role'])).toEqual([
      'queue_manager',
    ]);
  });

  it('renders a Link with people entity_type and the profile href', () => {
    const tree = SearchPersonHitRow({
      hit: makePerson({ href: '/profile/u42', id: 'u42' }),
      position: 1,
    }) as AnyElement;
    expect(tree.props.href).toBe('/profile/u42');
    expect(tree.props['data-entity-type']).toBe('people');
    expect(tree.props['data-position']).toBe(1);
  });
});

// ── Region row ─────────────────────────────────────────────────────────

describe('SearchRegionHitRow', () => {
  it('renders display name and slug subtitle', () => {
    const tree = SearchRegionHitRow({
      hit: makeRegion({ displayName: 'Hendon', slug: 'hendon' }),
      position: 0,
    }) as AnyElement;
    const texts = flatChildren(tree)
      .map((e) => e.props.children)
      .filter((c): c is string => typeof c === 'string');
    expect(texts).toContain('Hendon');
    expect(texts).toContain('hendon');
  });

  it('renders a Link with regions entity_type and the regions href', () => {
    const tree = SearchRegionHitRow({
      hit: makeRegion({ href: '/regions/foo', slug: 'foo' }),
      position: 3,
    }) as AnyElement;
    expect(tree.props.href).toBe('/regions/foo');
    expect(tree.props['data-entity-type']).toBe('regions');
    expect(tree.props['data-position']).toBe(3);
  });
});

// ── Ticket row ─────────────────────────────────────────────────────────

function makeTicket(overrides: Partial<TicketSearchHit> = {}): TicketSearchHit {
  return {
    id: 'tic-1',
    href: '/board/hendon-team/tic-1',
    title: 'Hendon school-gate roster',
    status: 'active',
    urgency: false,
    groupSlug: 'hendon-team',
    groupDisplayName: 'Hendon team',
    createdAt: '2026-05-04T09:00:00.000Z',
    ...overrides,
  };
}

describe('SearchTicketHitRow', () => {
  it('renders a Link with tickets entity_type and the board href', () => {
    const tree = SearchTicketHitRow({ hit: makeTicket(), position: 0 }) as AnyElement;
    expect(tree.props.href).toBe('/board/hendon-team/tic-1');
    expect(tree.props['data-entity-type']).toBe('tickets');
    expect(tree.props['data-position']).toBe(0);
    expect(tree.props['data-testid']).toBe('search-result-item');
  });

  it('renders the originating group display name and a status pill', () => {
    const tree = SearchTicketHitRow({
      hit: makeTicket({ groupDisplayName: 'Hendon team', status: 'active' }),
      position: 0,
    }) as AnyElement;
    const texts = flatChildren(tree)
      .map((e) => e.props.children)
      .filter((c): c is string => typeof c === 'string');
    expect(texts).toContain('Hendon team');
    const pill = findByTestId(tree, 'search-ticket-status-pill');
    expect(pill?.props['data-status']).toBe('active');
  });

  it('renders the urgency pill only when urgency=true', () => {
    const off = SearchTicketHitRow({
      hit: makeTicket({ urgency: false }),
      position: 0,
    }) as AnyElement;
    const on = SearchTicketHitRow({
      hit: makeTicket({ urgency: true }),
      position: 0,
    }) as AnyElement;
    expect(findByTestId(off, 'search-ticket-urgency-pill')).toBeUndefined();
    expect(findByTestId(on, 'search-ticket-urgency-pill')).toBeDefined();
  });

  it('renders the ticket title', () => {
    const tree = SearchTicketHitRow({
      hit: makeTicket({ title: 'Hendon school-gate roster' }),
      position: 0,
    }) as AnyElement;
    const texts = flatChildren(tree)
      .map((e) => e.props.children)
      .filter((c): c is string => typeof c === 'string');
    expect(texts).toContain('Hendon school-gate roster');
  });
});
