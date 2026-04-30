/**
 * Integration tests for the /calendar route (BU-calendar-view).
 *
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D036, D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * Mocks `isFeatureEnabled`, `createTRPCContext`, and `createCaller` so
 * the test exercises only the page's flag-gating + view selection
 * logic without booting the database or tRPC machinery. We assert:
 *
 *   - flag OFF → `redirect('/feed')` is called
 *   - flag ON, no `?view` → renders the agenda view
 *   - flag ON, `?view=month` → renders the month view
 *   - flag ON, unknown `?view=foo` → falls back to agenda
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

const isFeatureEnabledMock = vi.fn<(name: string) => Promise<boolean>>();
const listUpcomingMock = vi.fn<() => Promise<{ posts: unknown[] }>>();

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
