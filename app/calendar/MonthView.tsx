'use client';

/**
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * Month-grid surface. Wraps `MonthGrid` with selection state and a
 * below-grid panel that lists the selected day's events. Per the brief:
 *
 *   - Today is ringed by default and selected by default.
 *   - Tapping a cell highlights it AND replaces the panel below the
 *     entire grid with that day's events.
 *   - No bottom sheet, no navigation; the panel is always present
 *     below the grid.
 *   - Empty month → grid still renders; panel reads "Nothing scheduled
 *     this month".
 *
 * Caller passes the entire month's posts; this component partitions
 * them by London-day key and feeds counts into the grid + the active
 * panel. Out-of-month cells (the leading / trailing dim cells) carry
 * zero events because the upstream query bounded by the month range
 * never returns them.
 *
 * Prev/next month chevrons are intentionally OUT of scope for this BU
 * (single-month view is enough for the demo). Per brief Q3, when they
 * arrive the default selection on a navigated-to month becomes
 * "first day of that month".
 *
 * Architecture note: the component is split into a stateless
 * `MonthViewBody` (pure presentation, plain-call testable) and a thin
 * `MonthView` shell that owns the selection state. This matches the
 * project's tree-walker test pattern — see app-nav.test.tsx — without
 * needing a full DOM renderer.
 */

import * as React from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { MonthGrid, type MonthGridDay } from './MonthGrid';
import { CalendarRow, type CalendarRowPost } from './CalendarRow';
import { EVENT_TIMEZONE, formatLondon } from '@/shared/format-event-time';

export type MonthPost = CalendarRowPost;

interface MonthViewProps {
  posts: MonthPost[];
  /** Caller's current moment, set on the server and passed in for SSR consistency. */
  now: string; // ISO 8601
  /** First-of-month UTC anchor for the visible month. */
  monthAnchor: string; // ISO 8601
  /** Human-friendly month label, pre-formatted server-side: "May 2026". */
  monthLabel: string;
  /** BU-month-nav: URL for the previous month chevron. Omit to hide it. */
  prevMonthHref?: string;
  /** BU-month-nav: URL for the next month chevron. Omit to hide it. */
  nextMonthHref?: string;
}

const panelStyle: CSSProperties = {
  marginTop: 'var(--space-4)',
  paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--colour-border-subtle)',
};

const panelHeaderStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--colour-text-secondary)',
  margin: 0,
  marginBottom: 'var(--space-3)',
};

const monthHeaderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-2)',
  marginBottom: 'var(--space-3)',
};

const monthLabelStyle: CSSProperties = {
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--colour-text-primary)',
  margin: 0,
  textAlign: 'center',
  flex: '1 1 auto',
};

// Chevron buttons keep the visual mass minimal — small touch target,
// no fill, no border. Same idiom as the month-label heading. The
// chevron icon itself carries the affordance.
const chevronLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 'var(--radius-sm)',
  color: 'var(--colour-text-secondary)',
  textDecoration: 'none',
  flex: '0 0 auto',
};

// Spacer used when one of the chevrons is missing so the heading
// stays centred. Same width as a chevron link.
const chevronSpacerStyle: CSSProperties = {
  display: 'inline-block',
  width: 32,
  height: 32,
  flex: '0 0 auto',
};

const emptyPanelStyle: CSSProperties = {
  padding: 'var(--space-4)',
  textAlign: 'center',
  color: 'var(--colour-text-secondary)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
};

interface MonthViewBodyProps {
  posts: MonthPost[];
  now: Date;
  monthAnchor: Date;
  monthLabel: string;
  selectedDayKey: string;
  onSelectDay: (day: MonthGridDay) => void;
  /** BU-month-nav: URL for the previous month chevron. Omit to hide it. */
  prevMonthHref?: string;
  /** BU-month-nav: URL for the next month chevron. Omit to hide it. */
  nextMonthHref?: string;
}

/**
 * Stateless body. Computes day-key buckets + the active-day header
 * from the supplied `selectedDayKey`. `MonthView` owns the state; this
 * function is plain-call testable.
 */
export function MonthViewBody({
  posts,
  now,
  monthAnchor,
  monthLabel,
  selectedDayKey,
  onSelectDay,
  prevMonthHref,
  nextMonthHref,
}: MonthViewBodyProps) {
  const postsByDayKey = new Map<string, MonthPost[]>();
  for (const p of posts) {
    const key = formatInTimeZone(new Date(p.eventAt), EVENT_TIMEZONE, 'yyyy-MM-dd');
    const list = postsByDayKey.get(key) ?? [];
    list.push(p);
    postsByDayKey.set(key, list);
  }
  const eventCountByDayKey = new Map<string, number>();
  for (const [k, v] of postsByDayKey) eventCountByDayKey.set(k, v.length);

  const todayKey = formatInTimeZone(now, EVENT_TIMEZONE, 'yyyy-MM-dd');
  const tomorrowKey = formatInTimeZone(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    EVENT_TIMEZONE,
    'yyyy-MM-dd',
  );
  const selectedAnchor = parseDayKeyToUtc(selectedDayKey);
  const selectedHeader =
    selectedDayKey === todayKey
      ? 'Today'
      : selectedDayKey === tomorrowKey
        ? 'Tomorrow'
        : formatLondon(selectedAnchor, 'EEEE d MMMM');
  const selectedPosts = postsByDayKey.get(selectedDayKey) ?? [];
  const monthHasEvents = posts.length > 0;

  return (
    <section data-testid="calendar-month-view">
      <div style={monthHeaderRowStyle}>
        {prevMonthHref ? (
          <Link
            href={prevMonthHref}
            aria-label="Previous month"
            data-testid="calendar-month-prev-link"
            style={chevronLinkStyle}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        ) : (
          <span aria-hidden="true" style={chevronSpacerStyle} />
        )}
        <h2 data-testid="calendar-month-label" style={monthLabelStyle}>
          {monthLabel}
        </h2>
        {nextMonthHref ? (
          <Link
            href={nextMonthHref}
            aria-label="Next month"
            data-testid="calendar-month-next-link"
            style={chevronLinkStyle}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        ) : (
          <span aria-hidden="true" style={chevronSpacerStyle} />
        )}
      </div>
      <MonthGrid
        monthAnchorUtc={monthAnchor}
        now={now}
        eventCountByDayKey={eventCountByDayKey}
        selectedDayKey={selectedDayKey}
        onSelectDay={onSelectDay}
      />
      <div data-testid="calendar-month-day-panel" style={panelStyle}>
        <h3 data-testid="calendar-month-day-panel-header" style={panelHeaderStyle}>
          {selectedHeader}
        </h3>
        {!monthHasEvents ? (
          <div data-testid="calendar-month-empty" style={emptyPanelStyle}>
            Nothing scheduled this month.
          </div>
        ) : selectedPosts.length === 0 ? (
          <div data-testid="calendar-month-day-panel-empty" style={emptyPanelStyle}>
            No events on this day.
          </div>
        ) : (
          <ul
            data-testid="calendar-month-day-panel-list"
            style={{ listStyle: 'none', padding: 0, margin: 0 }}
          >
            {selectedPosts.map((p) => (
              <li key={p.id} style={{ marginBottom: 'var(--space-2)' }}>
                <CalendarRow post={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function MonthView({
  posts,
  now,
  monthAnchor,
  monthLabel,
  prevMonthHref,
  nextMonthHref,
}: MonthViewProps) {
  const nowDate = new Date(now);
  const monthAnchorDate = new Date(monthAnchor);
  // BU-month-nav: default selection now depends on whether we're
  // viewing the month containing today. If we are, today is the
  // natural anchor (preserves bu-calendar-view behaviour). If we're
  // not — because the smart-default landed on a future month, or the
  // user navigated via chevrons / `?month=` — the first day of the
  // visible month is the natural anchor (per bu-calendar-view brief
  // Q3, deferred to here).
  const todayKey = formatInTimeZone(nowDate, EVENT_TIMEZONE, 'yyyy-MM-dd');
  const monthAnchorKey = formatInTimeZone(monthAnchorDate, EVENT_TIMEZONE, 'yyyy-MM-dd');
  const todayMonthKey = todayKey.slice(0, 7);
  const visibleMonthKey = monthAnchorKey.slice(0, 7);
  const initialDayKey = todayMonthKey === visibleMonthKey ? todayKey : monthAnchorKey;

  const [selectedDayKey, setSelectedDayKey] = React.useState<string>(initialDayKey);

  return (
    <MonthViewBody
      posts={posts}
      now={nowDate}
      monthAnchor={monthAnchorDate}
      monthLabel={monthLabel}
      selectedDayKey={selectedDayKey}
      onSelectDay={(day) => setSelectedDayKey(day.dayKey)}
      prevMonthHref={prevMonthHref}
      nextMonthHref={nextMonthHref}
    />
  );
}

/**
 * Reconstruct the UTC `Date` for `yyyy-MM-ddT00:00:00 Europe/London`.
 * Used by the panel header so we can format "Today" / weekday-date
 * without re-zoning manually each call. Trust the source: dayKey is
 * always produced by `formatInTimeZone` with `yyyy-MM-dd`, never user
 * input.
 */
function parseDayKeyToUtc(dayKey: string): Date {
  return fromZonedTime(`${dayKey}T00:00:00`, EVENT_TIMEZONE);
}
