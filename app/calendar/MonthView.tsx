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
 */

import * as React from 'react';
import type { CSSProperties } from 'react';
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

const monthLabelStyle: CSSProperties = {
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--colour-text-primary)',
  margin: 0,
  marginBottom: 'var(--space-3)',
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

export function MonthView({ posts, now, monthAnchor, monthLabel }: MonthViewProps) {
  const nowDate = React.useMemo(() => new Date(now), [now]);
  const monthAnchorDate = React.useMemo(() => new Date(monthAnchor), [monthAnchor]);

  // Bucket posts by London-day key once per render.
  const { postsByDayKey, eventCountByDayKey } = React.useMemo(() => {
    const byDay = new Map<string, MonthPost[]>();
    for (const p of posts) {
      const key = formatInTimeZone(new Date(p.eventAt), EVENT_TIMEZONE, 'yyyy-MM-dd');
      const list = byDay.get(key) ?? [];
      list.push(p);
      byDay.set(key, list);
    }
    const counts = new Map<string, number>();
    for (const [k, v] of byDay) counts.set(k, v.length);
    return { postsByDayKey: byDay, eventCountByDayKey: counts };
  }, [posts]);

  const todayKey = React.useMemo(
    () => formatInTimeZone(nowDate, EVENT_TIMEZONE, 'yyyy-MM-dd'),
    [nowDate],
  );

  const [selectedDayKey, setSelectedDayKey] = React.useState<string>(todayKey);

  const selectedPosts: MonthPost[] = React.useMemo(
    () => postsByDayKey.get(selectedDayKey) ?? [],
    [postsByDayKey, selectedDayKey],
  );

  const handleSelectDay = React.useCallback((day: MonthGridDay) => {
    setSelectedDayKey(day.dayKey);
  }, []);

  const monthHasEvents = posts.length > 0;
  const selectedAnchor = React.useMemo(() => {
    // Reconstruct a UTC anchor for the selected day so the panel
    // header can format "Today" / "Tomorrow" / weekday-date the same
    // way Agenda does. We re-zone the yyyy-MM-dd back to 00:00 London.
    return parseDayKeyToUtc(selectedDayKey);
  }, [selectedDayKey]);

  const selectedHeader = React.useMemo(() => {
    if (selectedDayKey === todayKey) return 'Today';
    const tomorrowKey = formatInTimeZone(
      new Date(nowDate.getTime() + 24 * 60 * 60 * 1000),
      EVENT_TIMEZONE,
      'yyyy-MM-dd',
    );
    if (selectedDayKey === tomorrowKey) return 'Tomorrow';
    return formatLondon(selectedAnchor, 'EEEE d MMMM');
  }, [selectedDayKey, todayKey, nowDate, selectedAnchor]);

  return (
    <section data-testid="calendar-month-view">
      <h2 data-testid="calendar-month-label" style={monthLabelStyle}>
        {monthLabel}
      </h2>
      <MonthGrid
        monthAnchorUtc={monthAnchorDate}
        now={nowDate}
        eventCountByDayKey={eventCountByDayKey}
        selectedDayKey={selectedDayKey}
        onSelectDay={handleSelectDay}
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
