/**
 * Unit tests for MonthView + MonthGrid (BU-calendar-view).
 *
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * Same tree-walker pattern as `calendar-agenda-view.test.tsx`. We
 * cover three things:
 *   - `buildMonthGridDays` — correct grid shape, today flagged,
 *     event counts threaded through, in-month vs out-of-month flags.
 *   - `MonthGrid` initial render — dot rendering, "+N" overflow,
 *     today ring, selection styling.
 *   - `MonthView` initial render — default selection = today, panel
 *     populates with that day's events; empty-month state.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { buildMonthGridDays, MonthGrid, type MonthGridDay } from '@/app/calendar/MonthGrid';
import { MonthViewBody, type MonthPost } from '@/app/calendar/MonthView';
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

function makePost(overrides: Partial<MonthPost> = {}): MonthPost {
  return {
    id: 'p1',
    title: 'Sample event',
    body: 'Body.',
    kindSlug: 'event',
    kindDisplayName: 'Event',
    urgency: false,
    eventAt: '2026-05-03T17:00:00.000Z',
    eventEndsAt: null,
    locationText: null,
    ...overrides,
  };
}

// May 2026 anchor — UTC representation of 1 May 00:00 Europe/London (BST UTC+1
// → 30 Apr 23:00 UTC).
const MAY_ANCHOR = new Date('2026-04-30T23:00:00.000Z');
// "Now" = Fri 1 May 2026 11:00 BST.
const NOW = new Date('2026-05-01T10:00:00.000Z');

describe('buildMonthGridDays', () => {
  it('returns a Mon-start grid that contains the visible month', () => {
    const days = buildMonthGridDays(MAY_ANCHOR, NOW, new Map());
    expect(days.length % 7).toBe(0);
    const inMonth = days.filter((d) => d.inMonth);
    // May 2026 has 31 days.
    expect(inMonth).toHaveLength(31);
    // First in-month day is 1.
    expect(inMonth[0]?.dayNumber).toBe(1);
    // Last in-month day is 31.
    expect(inMonth[inMonth.length - 1]?.dayNumber).toBe(31);
  });

  it('flags today exactly once, by London day-key', () => {
    const days = buildMonthGridDays(MAY_ANCHOR, NOW, new Map());
    const todays = days.filter((d) => d.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0]?.dayKey).toBe('2026-05-01');
  });

  it('threads event counts through from the supplied map', () => {
    const counts = new Map([
      ['2026-05-03', 2],
      ['2026-05-15', 5],
    ]);
    const days = buildMonthGridDays(MAY_ANCHOR, NOW, counts);
    const may3 = days.find((d) => d.dayKey === '2026-05-03');
    const may15 = days.find((d) => d.dayKey === '2026-05-15');
    const may4 = days.find((d) => d.dayKey === '2026-05-04');
    expect(may3?.eventCount).toBe(2);
    expect(may15?.eventCount).toBe(5);
    expect(may4?.eventCount).toBe(0);
  });

  it('marks leading / trailing cells as out-of-month', () => {
    const days = buildMonthGridDays(MAY_ANCHOR, NOW, new Map());
    // 1 May 2026 is a Friday, so Mon 27 Apr → Thu 30 Apr lead.
    const lead = days.slice(0, 4);
    expect(lead.every((d) => d.inMonth === false)).toBe(true);
    // Last day in May 2026 (Sun 31) closes the week, so no trailing
    // out-of-month cells. Length == 35 (5 rows).
    expect(days).toHaveLength(35);
  });
});

describe('MonthGrid (initial render)', () => {
  it('renders one cell per day with stable testid + day-key', () => {
    const tree = MonthGrid({
      monthAnchorUtc: MAY_ANCHOR,
      now: NOW,
      eventCountByDayKey: new Map(),
      selectedDayKey: '2026-05-01',
      onSelectDay: () => {},
    }) as AnyElement;
    const cells = findAllByTestId(tree, 'calendar-month-cell');
    expect(cells.length).toBe(35);
    const dayKeys = cells.map((c) => c.props['data-day-key']);
    expect(dayKeys).toContain('2026-05-01');
    expect(dayKeys).toContain('2026-05-31');
  });

  it('emits dots only on cells with events; caps at 3 + overflow indicator', () => {
    const counts = new Map([
      ['2026-05-03', 2],
      ['2026-05-15', 7], // 3 visible dots + "+4"
    ]);
    const tree = MonthGrid({
      monthAnchorUtc: MAY_ANCHOR,
      now: NOW,
      eventCountByDayKey: counts,
      selectedDayKey: null,
      onSelectDay: () => {},
    }) as AnyElement;

    const cells = findAllByTestId(tree, 'calendar-month-cell');
    const may3 = cells.find((c) => c.props['data-day-key'] === '2026-05-03');
    const may15 = cells.find((c) => c.props['data-day-key'] === '2026-05-15');
    const may4 = cells.find((c) => c.props['data-day-key'] === '2026-05-04');

    expect(may3?.props['data-event-count']).toBe(2);
    expect(may15?.props['data-event-count']).toBe(7);
    expect(may4?.props['data-event-count']).toBe(0);

    const dotsRows = findAllByTestId(tree, 'calendar-month-cell-dots');
    expect(dotsRows.length).toBe(2);
    const overflows = findAllByTestId(tree, 'calendar-month-cell-overflow');
    expect(overflows.length).toBe(1);
  });

  it('marks today and selected cells with their respective data flags', () => {
    const tree = MonthGrid({
      monthAnchorUtc: MAY_ANCHOR,
      now: NOW,
      eventCountByDayKey: new Map(),
      selectedDayKey: '2026-05-15',
      onSelectDay: () => {},
    }) as AnyElement;
    const cells = findAllByTestId(tree, 'calendar-month-cell');
    const today = cells.find((c) => c.props['data-day-key'] === '2026-05-01');
    const selected = cells.find((c) => c.props['data-day-key'] === '2026-05-15');
    const ordinary = cells.find((c) => c.props['data-day-key'] === '2026-05-10');

    expect(today?.props['data-is-today']).toBe(true);
    expect(selected?.props['data-is-selected']).toBe(true);
    expect(ordinary?.props['data-is-today']).toBeUndefined();
    expect(ordinary?.props['data-is-selected']).toBeUndefined();
  });

  it('exposes onClick that fires the supplied callback with the day descriptor', () => {
    const calls: MonthGridDay[] = [];
    const tree = MonthGrid({
      monthAnchorUtc: MAY_ANCHOR,
      now: NOW,
      eventCountByDayKey: new Map(),
      selectedDayKey: null,
      onSelectDay: (d) => calls.push(d),
    }) as AnyElement;
    const cells = findAllByTestId(tree, 'calendar-month-cell');
    const target = cells.find((c) => c.props['data-day-key'] === '2026-05-15');
    expect(typeof target?.props['onClick']).toBe('function');
    (target?.props['onClick'] as () => void)?.();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.dayKey).toBe('2026-05-15');
  });
});

describe('MonthViewBody (stateless presentation)', () => {
  it("selects today by default → panel lists today's posts", () => {
    const todayPost = makePost({ id: 'today1', eventAt: '2026-05-01T17:00:00.000Z' });
    const otherDayPost = makePost({ id: 'sat3', eventAt: '2026-05-03T17:00:00.000Z' });
    const tree = MonthViewBody({
      posts: [todayPost, otherDayPost],
      now: NOW,
      monthAnchor: MAY_ANCHOR,
      monthLabel: 'May 2026',
      selectedDayKey: '2026-05-01',
      onSelectDay: () => {},
    }) as AnyElement;

    const header = findByTestId(tree, 'calendar-month-day-panel-header');
    expect(header).toBeDefined();
    expect(findByTestId(tree, 'calendar-month-day-panel-list')).toBeDefined();
    const rows = findAllByType(tree, CalendarRow);
    expect(rows.map((r) => (r.props['post'] as { id: string }).id)).toEqual(['today1']);
  });

  it('switches the panel to a different day when selectedDayKey changes', () => {
    const may3Post = makePost({ id: 'sat3', eventAt: '2026-05-03T17:00:00.000Z' });
    const tree = MonthViewBody({
      posts: [may3Post],
      now: NOW,
      monthAnchor: MAY_ANCHOR,
      monthLabel: 'May 2026',
      selectedDayKey: '2026-05-03',
      onSelectDay: () => {},
    }) as AnyElement;
    const rows = findAllByType(tree, CalendarRow);
    expect(rows.map((r) => (r.props['post'] as { id: string }).id)).toEqual(['sat3']);
    // Panel-empty state does not render when the active day has events.
    expect(findByTestId(tree, 'calendar-month-day-panel-empty')).toBeUndefined();
  });

  it('renders "No events on this day" when the selected day is empty but the month has events', () => {
    const may3Post = makePost({ id: 'sat3', eventAt: '2026-05-03T17:00:00.000Z' });
    const tree = MonthViewBody({
      posts: [may3Post],
      now: NOW,
      monthAnchor: MAY_ANCHOR,
      monthLabel: 'May 2026',
      selectedDayKey: '2026-05-10',
      onSelectDay: () => {},
    }) as AnyElement;
    expect(findByTestId(tree, 'calendar-month-day-panel-empty')).toBeDefined();
    expect(findByTestId(tree, 'calendar-month-empty')).toBeUndefined();
  });

  it('renders the "Nothing scheduled this month" empty state when the month has no events', () => {
    const tree = MonthViewBody({
      posts: [],
      now: NOW,
      monthAnchor: MAY_ANCHOR,
      monthLabel: 'May 2026',
      selectedDayKey: '2026-05-01',
      onSelectDay: () => {},
    }) as AnyElement;
    expect(findByTestId(tree, 'calendar-month-empty')).toBeDefined();
    expect(findByTestId(tree, 'calendar-month-day-panel-list')).toBeUndefined();
  });

  it('panel header reads "Today" / "Tomorrow" / weekday-date depending on selection', () => {
    function pick(selectedDayKey: string): string {
      const tree = MonthViewBody({
        posts: [],
        now: NOW,
        monthAnchor: MAY_ANCHOR,
        monthLabel: 'May 2026',
        selectedDayKey,
        onSelectDay: () => {},
      }) as AnyElement;
      return flatChildren(tree)
        .filter((e) => e.props['data-testid'] === 'calendar-month-day-panel-header')
        .map((h) => {
          const c = h.props.children;
          return Array.isArray(c) ? c.join('') : String(c);
        })
        .join('');
    }
    expect(pick('2026-05-01')).toBe('Today');
    expect(pick('2026-05-02')).toBe('Tomorrow');
    expect(pick('2026-05-03')).toBe('Sunday 3 May');
  });

  it('exposes the month label in the heading', () => {
    const tree = MonthViewBody({
      posts: [],
      now: NOW,
      monthAnchor: MAY_ANCHOR,
      monthLabel: 'May 2026',
      selectedDayKey: '2026-05-01',
      onSelectDay: () => {},
    }) as AnyElement;
    const label = findByTestId(tree, 'calendar-month-label');
    expect(label).toBeDefined();
  });

  // BU-month-nav: prev/next chevrons render as <Link>s when hrefs
  // are passed; aria-labels + testids match the brief.
  it('renders prev/next chevrons with correct hrefs, testids, and aria-labels', () => {
    const tree = MonthViewBody({
      posts: [],
      now: NOW,
      monthAnchor: MAY_ANCHOR,
      monthLabel: 'May 2026',
      selectedDayKey: '2026-05-01',
      onSelectDay: () => {},
      prevMonthHref: '/calendar?view=month&month=2026-04',
      nextMonthHref: '/calendar?view=month&month=2026-06',
    }) as AnyElement;
    const prev = findByTestId(tree, 'calendar-month-prev-link');
    const next = findByTestId(tree, 'calendar-month-next-link');
    expect(prev).toBeDefined();
    expect(next).toBeDefined();
    expect(prev?.props['href']).toBe('/calendar?view=month&month=2026-04');
    expect(next?.props['href']).toBe('/calendar?view=month&month=2026-06');
    expect(prev?.props['aria-label']).toBe('Previous month');
    expect(next?.props['aria-label']).toBe('Next month');
  });

  it('omits chevrons when hrefs are not provided', () => {
    const tree = MonthViewBody({
      posts: [],
      now: NOW,
      monthAnchor: MAY_ANCHOR,
      monthLabel: 'May 2026',
      selectedDayKey: '2026-05-01',
      onSelectDay: () => {},
    }) as AnyElement;
    expect(findByTestId(tree, 'calendar-month-prev-link')).toBeUndefined();
    expect(findByTestId(tree, 'calendar-month-next-link')).toBeUndefined();
  });
});
