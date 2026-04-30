'use client';

/**
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * Pure-presentational 7×N month grid. Renders the days of the visible
 * month plus the leading days of the previous month and trailing days
 * of the next month so the grid always starts on Monday and ends on
 * Sunday. Out-of-month cells are dimmed but tappable per the brief
 * (tapping jumps to that day's panel).
 *
 * State (selected day) is owned by `MonthView`. This component is
 * deliberately stateless: callers pass `selectedDayKey` + `onSelectDay`,
 * so the same grid can be unit-tested without fixturing client state.
 *
 * Dot rendering: cap visible dots at 3 + "+N" overflow indicator per
 * the brief's known-gotcha. Dot colour follows `gps-pill` info tone.
 *
 * Accessibility: the grid uses `role="grid"` with `aria-label="Month
 * view"`. Each cell is a `<button>` (so it is keyboard-focusable and
 * screen-reader-announced). The brief's "arrow keys move selection"
 * is delegated to native focus order — standard tab-through. A more
 * elaborate roving-tabindex pattern is parking-lot.
 */

import * as React from 'react';
import type { CSSProperties } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isBefore,
  isAfter,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { EVENT_TIMEZONE } from '@/shared/format-event-time';

export interface MonthGridDay {
  /** yyyy-MM-dd in Europe/London. Stable cell identity. */
  dayKey: string;
  /** UTC anchor for the start of that London day. Used for header rendering. */
  anchorUtc: Date;
  /** Day-of-month integer (1..31). */
  dayNumber: number;
  /** True when the cell falls inside the visible month. */
  inMonth: boolean;
  /** True when the cell IS today (Europe/London). */
  isToday: boolean;
  /** Number of events in this cell. Drives dot rendering. */
  eventCount: number;
}

interface MonthGridProps {
  /** First-of-month UTC date for the visible month (e.g. May 1 00:00 London → UTC). */
  monthAnchorUtc: Date;
  /** Caller's current moment, used for the "today" ring. */
  now: Date;
  /** yyyy-MM-dd of every day that has at least one event. */
  eventCountByDayKey: ReadonlyMap<string, number>;
  /** Currently-selected cell (yyyy-MM-dd) or null. */
  selectedDayKey: string | null;
  /** Cell-tap callback. Receives the day's `MonthGridDay` for parent use. */
  onSelectDay: (day: MonthGridDay) => void;
}

const wrapStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 'var(--space-1)',
  marginBottom: 'var(--space-4)',
};

const dowHeaderStyle: CSSProperties = {
  fontSize: 'var(--text-2xs)',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--colour-text-secondary)',
  textAlign: 'center',
  padding: 'var(--space-1) 0',
};

const cellBaseStyle: CSSProperties = {
  position: 'relative',
  minHeight: 56,
  padding: 'var(--space-1)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--colour-surface-raised)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  fontFamily: 'var(--font-ui)',
  color: 'var(--colour-text-primary)',
};

const dotsRowStyle: CSSProperties = {
  display: 'flex',
  gap: 2,
  marginTop: 'auto',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-1)',
};

const dotStyle: CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--colour-info)',
};

const overflowStyle: CSSProperties = {
  fontSize: 'var(--text-2xs)',
  fontWeight: 700,
  color: 'var(--colour-info)',
};

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Build the days-array for a calendar grid spanning the full weeks
 * containing `monthAnchorUtc`. Week starts on Monday (Europe/London
 * convention).
 */
export function buildMonthGridDays(
  monthAnchorUtc: Date,
  now: Date,
  eventCountByDayKey: ReadonlyMap<string, number>,
): MonthGridDay[] {
  const monthStart = startOfMonth(monthAnchorUtc);
  const monthEnd = endOfMonth(monthAnchorUtc);
  // weekStartsOn: 1 = Monday.
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const todayKey = formatInTimeZone(now, EVENT_TIMEZONE, 'yyyy-MM-dd');
  const days: MonthGridDay[] = [];
  let cursor = gridStart;
  while (!isAfter(cursor, gridEnd)) {
    const dayKey = formatInTimeZone(cursor, EVENT_TIMEZONE, 'yyyy-MM-dd');
    days.push({
      dayKey,
      anchorUtc: cursor,
      dayNumber: Number(formatInTimeZone(cursor, EVENT_TIMEZONE, 'd')),
      inMonth: !isBefore(cursor, monthStart) && !isAfter(cursor, monthEnd),
      isToday: dayKey === todayKey,
      eventCount: eventCountByDayKey.get(dayKey) ?? 0,
    });
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function MonthGrid({
  monthAnchorUtc,
  now,
  eventCountByDayKey,
  selectedDayKey,
  onSelectDay,
}: MonthGridProps) {
  const days = React.useMemo(
    () => buildMonthGridDays(monthAnchorUtc, now, eventCountByDayKey),
    [monthAnchorUtc, now, eventCountByDayKey],
  );

  return (
    <div role="grid" aria-label="Month view" data-testid="calendar-month-grid" style={wrapStyle}>
      {DOW_LABELS.map((dow) => (
        <div key={dow} role="columnheader" aria-label={dow} style={dowHeaderStyle}>
          {dow}
        </div>
      ))}
      {days.map((day) => {
        const isSelected = day.dayKey === selectedDayKey;
        const cellStyle: CSSProperties = {
          ...cellBaseStyle,
          opacity: day.inMonth ? 1 : 0.45,
          background: isSelected
            ? 'var(--colour-primary-subtle)'
            : day.isToday
              ? 'var(--colour-info-subtle)'
              : cellBaseStyle.background,
          borderColor: day.isToday
            ? 'var(--colour-info)'
            : isSelected
              ? 'var(--colour-primary)'
              : 'var(--colour-border-subtle)',
          borderWidth: day.isToday || isSelected ? 2 : 1,
        };
        const visibleDots = Math.min(day.eventCount, 3);
        const overflow = day.eventCount > 3 ? day.eventCount - 3 : 0;

        return (
          <button
            key={day.dayKey}
            type="button"
            role="gridcell"
            aria-selected={isSelected}
            aria-label={`${day.dayNumber}${day.eventCount > 0 ? `, ${day.eventCount} event${day.eventCount === 1 ? '' : 's'}` : ''}`}
            data-testid="calendar-month-cell"
            data-day-key={day.dayKey}
            data-in-month={day.inMonth || undefined}
            data-is-today={day.isToday || undefined}
            data-is-selected={isSelected || undefined}
            data-event-count={day.eventCount}
            onClick={() => onSelectDay(day)}
            style={cellStyle}
          >
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: day.isToday ? 700 : 500 }}>
              {day.dayNumber}
            </span>
            {day.eventCount > 0 && (
              <span data-testid="calendar-month-cell-dots" style={dotsRowStyle}>
                {Array.from({ length: visibleDots }).map((_, i) => (
                  <span key={i} aria-hidden="true" style={dotStyle} />
                ))}
                {overflow > 0 && (
                  <span data-testid="calendar-month-cell-overflow" style={overflowStyle}>
                    +{overflow}
                  </span>
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
