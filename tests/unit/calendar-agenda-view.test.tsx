/**
 * Unit tests for AgendaView (BU-calendar-view).
 *
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * Vitest env is `node`, no RTL. We invoke the component as a plain
 * function and walk the ReactElement tree (matches the project's
 * existing pattern from `app-nav.test.tsx` / `feed-filter-chips.test.tsx`).
 *
 * The brief calls these "tests/components/AgendaView.test.tsx"; the
 * project convention is `tests/unit/<kebab-name>.test.tsx`. We follow
 * the project convention so vitest picks them up.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import {
  AgendaView,
  groupPostsByLondonDay,
  dayHeaderLabel,
  type AgendaPost,
} from '@/app/calendar/AgendaView';
import { CalendarRow } from '@/app/calendar/CalendarRow';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    const c = e.props.children;
    walk(c);
  };
  walk(el);
  return acc;
}

function findAllByTestId(el: AnyElement, testId: string): AnyElement[] {
  return flatChildren(el).filter((e) => e.props['data-testid'] === testId);
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return findAllByTestId(el, testId)[0];
}

function findAllByType(el: AnyElement, fn: unknown): AnyElement[] {
  return flatChildren(el).filter((e) => (e as { type?: unknown }).type === fn);
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

function makePost(overrides: Partial<AgendaPost> = {}): AgendaPost {
  return {
    id: 'p1',
    title: 'Saturday vigil',
    body: 'Meet at the corner.',
    kindSlug: 'event',
    kindDisplayName: 'Event',
    urgency: false,
    eventAt: '2026-05-03T17:00:00.000Z',
    eventEndsAt: null,
    locationText: null,
    ...overrides,
  };
}

// Anchor "now" inside a stable slot: 2026-05-01 (Friday) 11:00 Europe/London → BST UTC+1.
const NOW = new Date('2026-05-01T10:00:00.000Z');

describe('groupPostsByLondonDay', () => {
  it('groups posts by Europe/London day-key, ascending', () => {
    const posts = [
      // Sat 3 May, 6pm BST = 17:00 UTC
      makePost({ id: 'a', eventAt: '2026-05-03T17:00:00.000Z' }),
      // Sat 3 May, 8pm BST = 19:00 UTC
      makePost({ id: 'b', eventAt: '2026-05-03T19:00:00.000Z' }),
      // Fri 2 May, 9am BST = 08:00 UTC
      makePost({ id: 'c', eventAt: '2026-05-02T08:00:00.000Z' }),
    ];
    const buckets = groupPostsByLondonDay(posts);
    expect(buckets.map((b) => b.dayKey)).toEqual(['2026-05-02', '2026-05-03']);
    expect(buckets[1]?.posts.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('treats a 23:30 UTC time as the next London day during BST', () => {
    // 2026-05-02 23:30 UTC = 2026-05-03 00:30 BST (Sat)
    const posts = [makePost({ id: 'late', eventAt: '2026-05-02T23:30:00.000Z' })];
    const buckets = groupPostsByLondonDay(posts);
    expect(buckets[0]?.dayKey).toBe('2026-05-03');
  });
});

describe('dayHeaderLabel', () => {
  it('returns "Today" when bucket-anchor is the same London day as now', () => {
    // 2026-05-01 is Fri; an event at 2026-05-01 17:00 UTC is still Fri 1 May London (BST).
    const anchor = new Date('2026-05-01T17:00:00.000Z');
    expect(dayHeaderLabel(anchor, NOW)).toBe('Today');
  });

  it('returns "Tomorrow" when bucket-anchor is the next London day', () => {
    const anchor = new Date('2026-05-02T08:00:00.000Z');
    expect(dayHeaderLabel(anchor, NOW)).toBe('Tomorrow');
  });

  it('returns weekday + date for other days', () => {
    // 3 May 2026 is a Sunday in Europe/London.
    const anchor = new Date('2026-05-03T08:00:00.000Z');
    expect(dayHeaderLabel(anchor, NOW)).toBe('Sun 3 May');
  });
});

describe('AgendaView', () => {
  it('renders the empty state with a compose link when no posts', () => {
    const tree = AgendaView({ posts: [], now: NOW }) as AnyElement;
    expect(findByTestId(tree, 'calendar-agenda-empty')).toBeDefined();
    const composeLink = findByTestId(tree, 'calendar-agenda-empty-compose');
    expect(composeLink).toBeDefined();
    expect(composeLink?.props['href']).toBe('/compose');
    expect(findByTestId(tree, 'calendar-agenda-list')).toBeUndefined();
  });

  it('renders one day section per London day, ordered ascending', () => {
    const posts = [
      makePost({ id: 'a', eventAt: '2026-05-03T17:00:00.000Z' }),
      makePost({ id: 'b', eventAt: '2026-05-02T08:00:00.000Z' }),
    ];
    const tree = AgendaView({ posts, now: NOW }) as AnyElement;
    const days = findAllByTestId(tree, 'calendar-agenda-day');
    expect(days).toHaveLength(2);
    expect(days[0]?.props['data-day-key']).toBe('2026-05-02');
    expect(days[1]?.props['data-day-key']).toBe('2026-05-03');
  });

  it('labels today / tomorrow / weekday-date headers', () => {
    const posts = [
      // Today: 2026-05-01, 17:00 UTC = 18:00 BST
      makePost({ id: 'today', eventAt: '2026-05-01T17:00:00.000Z' }),
      // Tomorrow: 2026-05-02
      makePost({ id: 'tomorrow', eventAt: '2026-05-02T17:00:00.000Z' }),
      // Sun 3 May
      makePost({ id: 'later', eventAt: '2026-05-03T17:00:00.000Z' }),
    ];
    const tree = AgendaView({ posts, now: NOW }) as AnyElement;
    const headers = findAllByTestId(tree, 'calendar-agenda-day-header');
    expect(headers.map((h) => flatStrings(h))).toEqual(['Today', 'Tomorrow', 'Sun 3 May']);
  });

  it('shows the "Earlier today" mini-header when today contains past-now items', () => {
    const earlierToday = makePost({
      id: 'earlier',
      // 2026-05-01 09:00 UTC = 10:00 BST — before NOW (10:00 UTC)? Actually 09:00 UTC is BEFORE 10:00 UTC.
      eventAt: '2026-05-01T09:00:00.000Z',
    });
    const laterToday = makePost({
      id: 'later',
      eventAt: '2026-05-01T17:00:00.000Z',
    });
    const tree = AgendaView({ posts: [earlierToday, laterToday], now: NOW }) as AnyElement;
    expect(findByTestId(tree, 'calendar-agenda-earlier-today')).toBeDefined();
    // Both rows still render — order: earlier-today first, then later-today.
    const rows = findAllByType(tree, CalendarRow);
    expect(rows.map((r) => (r.props['post'] as { id: string }).id)).toEqual(['earlier', 'later']);
  });

  it('omits the "Earlier today" mini-header when today has no past-now items', () => {
    const future = makePost({ id: 'future', eventAt: '2026-05-01T17:00:00.000Z' });
    const tree = AgendaView({ posts: [future], now: NOW }) as AnyElement;
    expect(findByTestId(tree, 'calendar-agenda-earlier-today')).toBeUndefined();
  });

  it('renders the "Nothing further scheduled" footer when posts exist', () => {
    const tree = AgendaView({
      posts: [makePost({ eventAt: '2026-05-03T17:00:00.000Z' })],
      now: NOW,
    }) as AnyElement;
    const footer = findByTestId(tree, 'calendar-agenda-footer');
    expect(footer).toBeDefined();
    expect(flatStrings(footer)).toBe('Nothing further scheduled.');
  });
});
