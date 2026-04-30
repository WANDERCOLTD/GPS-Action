/**
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * Segmented Agenda / Month control for `/calendar`. URL-driven —
 * each option is a `<Link>` so the back button preserves view state
 * and there is no client state to hydrate. Visual idiom matches the
 * `/feed` chip strip: rounded pills, the active option uses
 * `gps-chip--active`.
 *
 * Server component (no `'use client'`). The page passes the active
 * view derived from `searchParams.view`.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { CalendarView } from './view';

interface CalendarToggleProps {
  active: CalendarView;
}

const navStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  marginBottom: 'var(--space-5)',
};

const VIEW_OPTIONS: ReadonlyArray<{ key: CalendarView; label: string; href: string }> = [
  { key: 'agenda', label: 'Agenda', href: '/calendar' },
  { key: 'month', label: 'Month', href: '/calendar?view=month' },
];

export function CalendarToggle({ active }: CalendarToggleProps) {
  return (
    <nav aria-label="Calendar view" data-testid="calendar-toggle-nav" style={navStyle}>
      {VIEW_OPTIONS.map((opt) => {
        const isActive = opt.key === active;
        return (
          <Link
            key={opt.key}
            href={opt.href}
            prefetch={false}
            data-testid={`calendar-toggle-${opt.key}`}
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? 'gps-chip gps-chip--active' : 'gps-chip'}
          >
            {opt.label}
          </Link>
        );
      })}
    </nav>
  );
}
