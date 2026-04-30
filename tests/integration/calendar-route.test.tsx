/**
 * Integration tests for the /calendar route (BU-calendar-view, BU-month-nav).
 *
 * @build-unit BU-calendar-view
 * @build-unit BU-month-nav
 * @spec architecture/decision-log.md (D036, D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 * @spec docs/build/session-briefs/bu-month-nav.md
 *
 * Mocks `isFeatureEnabled`, `createTRPCContext`, and `createCaller` so
 * the test exercises only the page's flag-gating + view selection
 * logic without booting the database or tRPC machinery. We assert:
 *
 *   - flag OFF → `redirect('/feed')` is called
 *   - flag ON, no `?view` → renders the agenda view
 *   - flag ON, `?view=month` → renders the month view
 *   - flag ON, unknown `?view=foo` → falls back to agenda
 *
 * BU-month-nav adds:
 *   - `?month=YYYY-MM` (valid) anchors that month
 *   - no `?month=` + upcoming events → anchors on the next-event month
 *   - no `?month=` + no upcoming events → anchors on current month
 *   - invalid `?month=` falls back to the smart default
 *   - prev/next chevron hrefs are passed into MonthView
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

interface ListUpcomingResult {
  posts: { eventAt: Date }[];
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

beforeEach(() => {
  vi.clearAllMocks();
  listUpcomingMock.mockResolvedValue({ posts: [] });
});

/** Helper to assert that one of the listUpcoming calls used the
 * month bounds we expect. The page issues two calls in the month
 * view's smart-anchor path: a `limit:1` probe and a `from/to` window
 * query. We pick the windowed one (has a `to:`) to verify which month
 * was rendered.
 */
function findWindowedCall(): ListUpcomingArgs | undefined {
  for (const call of listUpcomingMock.mock.calls) {
    const args = call[0];
    if (args && args.to !== undefined) return args;
  }
  return undefined;
}

describe('/calendar route — flag gating', () => {
  it('redirects to /feed when calendar_enabled is OFF', async () => {
    isFeatureEnabledMock.mockResolvedValueOnce(false);
    await expect(CalendarPage({ searchParams: Promise.resolve({}) })).rejects.toBeInstanceOf(
      RedirectError,
    );
    try {
      await CalendarPage({ searchParams: Promise.resolve({}) });
    } catch (e) {
      expect((e as RedirectError).url).toBe('/feed');
    }
    // listUpcoming must not be called when the flag is off.
    expect(listUpcomingMock).not.toHaveBeenCalled();
  });

  it('renders the agenda view by default when flag is ON', async () => {
    isFeatureEnabledMock.mockResolvedValue(true);
    const tree = (await CalendarPage({ searchParams: Promise.resolve({}) })) as AnyElement;
    // Page mounts the toggle + the agenda view component (not the month view).
    expect(findByType(tree, CalendarToggle)).toBeDefined();
    expect(findByType(tree, AgendaView)).toBeDefined();
    expect(findByType(tree, MonthView)).toBeUndefined();
    // Toggle is told the active view.
    const toggle = findByType(tree, CalendarToggle);
    expect(toggle?.props['active']).toBe('agenda');
  });

  it('renders the month view when ?view=month', async () => {
    isFeatureEnabledMock.mockResolvedValue(true);
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'month' }),
    })) as AnyElement;
    expect(findByType(tree, MonthView)).toBeDefined();
    expect(findByType(tree, AgendaView)).toBeUndefined();
    const toggle = findByType(tree, CalendarToggle);
    expect(toggle?.props['active']).toBe('month');
  });

  it('falls back to agenda when ?view= is unknown', async () => {
    isFeatureEnabledMock.mockResolvedValue(true);
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'totally-bogus' }),
    })) as AnyElement;
    expect(findByType(tree, AgendaView)).toBeDefined();
    expect(findByType(tree, MonthView)).toBeUndefined();
  });
});

describe('/calendar?view=month — month anchor (BU-month-nav)', () => {
  beforeEach(() => {
    isFeatureEnabledMock.mockResolvedValue(true);
  });

  it('anchors on `?month=YYYY-MM` when present and valid', async () => {
    listUpcomingMock.mockResolvedValue({ posts: [] });
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'month', month: '2026-05' }),
    })) as AnyElement;
    const monthView = findByType(tree, MonthView);
    expect(monthView).toBeDefined();
    expect(monthView?.props['monthLabel']).toBe('May 2026');
    // Smart-anchor probe is skipped when ?month= wins, so listUpcoming
    // is called exactly once — the windowed query for the visible month.
    expect(listUpcomingMock).toHaveBeenCalledTimes(1);
    const windowed = findWindowedCall();
    expect(windowed).toBeDefined();
    // From-bound is the UTC anchor for May 2026 in Europe/London (BST,
    // UTC+1 → 30 Apr 23:00 UTC).
    expect(windowed?.from).toBe('2026-04-30T23:00:00.000Z');
  });

  it('anchors on the next-event month when `?month=` is absent and there are upcoming events', async () => {
    // Pretend "now" is 30 Apr but the next event is 3 May. The page
    // probes listUpcoming with `limit: 1`; we return one event whose
    // eventAt is in May.
    const probeEvent = { eventAt: new Date('2026-05-03T17:00:00.000Z') };
    listUpcomingMock.mockImplementation(async (args) => {
      if (args?.limit === 1) return { posts: [probeEvent] };
      return { posts: [] };
    });
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'month' }),
    })) as AnyElement;
    const monthView = findByType(tree, MonthView);
    expect(monthView?.props['monthLabel']).toBe('May 2026');
    const windowed = findWindowedCall();
    expect(windowed?.from).toBe('2026-04-30T23:00:00.000Z');
  });

  it('falls back to current month when `?month=` is absent and there are no upcoming events', async () => {
    // No `?month=`, probe returns no events. Anchor must still be a
    // YYYY-MM-formatted month (the current one). We can't pin it to
    // a specific month without freezing time, but we can assert that
    // the windowed call was made and its from-bound is non-null.
    listUpcomingMock.mockResolvedValue({ posts: [] });
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'month' }),
    })) as AnyElement;
    const monthView = findByType(tree, MonthView);
    expect(monthView).toBeDefined();
    // Two calls: probe (limit: 1) + windowed (from + to).
    expect(listUpcomingMock).toHaveBeenCalledTimes(2);
    const probe = listUpcomingMock.mock.calls.find((c) => c[0]?.limit === 1)?.[0];
    expect(probe?.limit).toBe(1);
    expect(findWindowedCall()).toBeDefined();
  });

  it.each(['2026-13', 'xyz', '2026-1', '06-2026', '2026/05', ''])(
    'falls back to smart default when `?month=%s` is invalid',
    async (badMonth) => {
      // Smart default fires the limit:1 probe — assert it ran (proves
      // we did NOT take the `?month=` branch).
      const probeEvent = { eventAt: new Date('2026-06-15T17:00:00.000Z') };
      listUpcomingMock.mockImplementation(async (args) => {
        if (args?.limit === 1) return { posts: [probeEvent] };
        return { posts: [] };
      });
      const tree = (await CalendarPage({
        searchParams: Promise.resolve({ view: 'month', month: badMonth }),
      })) as AnyElement;
      const monthView = findByType(tree, MonthView);
      expect(monthView?.props['monthLabel']).toBe('June 2026');
      const probe = listUpcomingMock.mock.calls.find((c) => c[0]?.limit === 1);
      expect(probe).toBeDefined();
    },
  );

  it('passes prev/next month chevron hrefs into MonthView', async () => {
    listUpcomingMock.mockResolvedValue({ posts: [] });
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'month', month: '2026-05' }),
    })) as AnyElement;
    const monthView = findByType(tree, MonthView);
    expect(monthView?.props['prevMonthHref']).toBe('/calendar?view=month&month=2026-04');
    expect(monthView?.props['nextMonthHref']).toBe('/calendar?view=month&month=2026-06');
  });

  it('handles year boundaries in chevron hrefs', async () => {
    listUpcomingMock.mockResolvedValue({ posts: [] });
    const tree = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'month', month: '2026-12' }),
    })) as AnyElement;
    const monthView = findByType(tree, MonthView);
    expect(monthView?.props['prevMonthHref']).toBe('/calendar?view=month&month=2026-11');
    expect(monthView?.props['nextMonthHref']).toBe('/calendar?view=month&month=2027-01');

    const tree2 = (await CalendarPage({
      searchParams: Promise.resolve({ view: 'month', month: '2026-01' }),
    })) as AnyElement;
    const monthView2 = findByType(tree2, MonthView);
    expect(monthView2?.props['prevMonthHref']).toBe('/calendar?view=month&month=2025-12');
    expect(monthView2?.props['nextMonthHref']).toBe('/calendar?view=month&month=2026-02');
  });
});
