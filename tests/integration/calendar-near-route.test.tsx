/**
 * Integration tests for `/calendar?view=near` (BU-calendar-near-me).
 *
 * @build-unit BU-calendar-near-me
 * @spec architecture/decision-log.md (D076)
 * @spec docs/build/session-briefs/bu-calendar-near-me.md
 *
 * Mirrors `calendar-route.test.tsx` patterns. We only mock the page's
 * collaborators (flag, tRPC context, tRPC caller) and assert that:
 *
 *   - `?view=near` mounts NearMeView (not Agenda / Month)
 *   - Online posts (isOnline=true) are filtered out before reaching NearMeView
 *   - Posts with NULL coords are filtered out
 *   - The toggle is passed `active='near'`
 *   - `?sort=date` flips initialSort accordingly; default = distance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

interface ListUpcomingArgs {
  from?: string;
  to?: string;
  limit?: number;
  kindSlugs?: string[];
}

interface MockUpcomingPost {
  id: string;
  title: string;
  body: string;
  kindSlug: string | null;
  kindDisplayName: string | null;
  urgency: boolean;
  eventAt: Date;
  eventEndsAt: Date | null;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  isOnline: boolean;
}

interface ListUpcomingResult {
  posts: MockUpcomingPost[];
}

const isFeatureEnabledMock = vi.fn<(name: string) => Promise<boolean>>();
const listUpcomingMock = vi.fn<(args?: ListUpcomingArgs) => Promise<ListUpcomingResult>>();

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

vi.mock('@/server/services/flags', () => ({
  isFeatureEnabled: (name: string) => isFeatureEnabledMock(name),
}));

vi.mock('@/server/routers/context', () => ({
  createTRPCContext: async () => ({ user: null, activeRoles: [], activeScopes: [] }),
}));

vi.mock('@/server/routers/_app', () => ({
  createCaller: () => ({
    post: {
      listUpcoming: listUpcomingMock,
    },
  }),
}));

const { default: CalendarPage } = await import('@/app/calendar/page');
const { CalendarToggle } = await import('@/app/calendar/CalendarToggle');
const { NearMeView } = await import('@/app/calendar/NearMeView');
const { AgendaView } = await import('@/app/calendar/AgendaView');
const { MonthView } = await import('@/app/calendar/MonthView');

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

function findByType(el: AnyElement, fn: unknown): AnyElement | undefined {
  return flatChildren(el).find((e) => (e as { type?: unknown }).type === fn);
}

function makeUpcoming(over: Partial<MockUpcomingPost>): MockUpcomingPost {
  return {
    id: 'p1',
    title: 'Mock event',
    body: 'Mock body',
    kindSlug: 'event',
    kindDisplayName: 'Event',
    urgency: false,
    eventAt: new Date('2026-05-10T10:00:00.000Z'),
    eventEndsAt: null,
    locationText: 'Bristol',
    latitude: 51.4537,
    longitude: -2.5919,
    isOnline: false,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isFeatureEnabledMock.mockResolvedValue(true);
  listUpcomingMock.mockResolvedValue({ posts: [] });
});

describe('/calendar?view=near (BU-calendar-near-me)', () => {
  it('mounts NearMeView and not the other views', async () => {
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'near' }),
    })) as AnyElement;

    expect(findByType(tree, NearMeView)).toBeDefined();
    expect(findByType(tree, AgendaView)).toBeUndefined();
    expect(findByType(tree, MonthView)).toBeUndefined();
  });

  it("passes active='near' to the toggle", async () => {
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'near' }),
    })) as AnyElement;

    const toggle = findByType(tree, CalendarToggle);
    expect(toggle?.props['active']).toBe('near');
  });

  it('filters out online posts before passing to NearMeView', async () => {
    listUpcomingMock.mockResolvedValueOnce({
      posts: [
        makeUpcoming({ id: 'in-person', isOnline: false }),
        makeUpcoming({ id: 'online', isOnline: true }),
      ],
    });

    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'near' }),
    })) as AnyElement;

    const view = findByType(tree, NearMeView);
    const posts = view?.props['posts'] as Array<{ id: string }>;
    expect(posts.map((p) => p.id)).toEqual(['in-person']);
  });

  it('filters out posts with NULL latitude / longitude', async () => {
    listUpcomingMock.mockResolvedValueOnce({
      posts: [
        makeUpcoming({ id: 'with-coords' }),
        makeUpcoming({ id: 'no-lat', latitude: null }),
        makeUpcoming({ id: 'no-lng', longitude: null }),
      ],
    });

    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'near' }),
    })) as AnyElement;

    const view = findByType(tree, NearMeView);
    const posts = view?.props['posts'] as Array<{ id: string }>;
    expect(posts.map((p) => p.id)).toEqual(['with-coords']);
  });

  it("defaults initialSort to 'distance'", async () => {
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'near' }),
    })) as AnyElement;

    const view = findByType(tree, NearMeView);
    expect(view?.props['initialSort']).toBe('distance');
  });

  it("flips initialSort to 'date' when ?sort=date", async () => {
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'near', sort: 'date' }),
    })) as AnyElement;

    const view = findByType(tree, NearMeView);
    expect(view?.props['initialSort']).toBe('date');
  });
});
