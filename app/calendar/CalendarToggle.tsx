/**
 * @build-unit BU-calendar-view BU-calendar-near-me
 * @spec architecture/decision-log.md (D073, D076)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 * @spec docs/build/session-briefs/bu-calendar-near-me.md
 *
 * Segmented Agenda / Month / Near-me control for `/calendar`.
 * URL-driven — each option is a `<Link>` so the back button preserves
 * view state and there is no client state to hydrate. Visual idiom
 * matches the `/feed` chip strip: rounded pills, the active option
 * uses `gps-chip--active`.
 *
 * BU-calendar-near-me: tabs render icons (List / CalendarDays / MapPin)
 * with `aria-label` carrying the human-readable text. The previous
 * "Agenda" / "Month" wording lives on as labels for screen-reader +
 * test-id discovery.
 *
 * Server component (no `'use client'`). The page passes the active
 * view derived from `searchParams.view`.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CalendarDays, List, MapPin } from 'lucide-react';
import type { CalendarView } from './view';

interface CalendarToggleProps {
  active: CalendarView;
}

const navStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  marginBottom: 'var(--space-5)',
};

const iconChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

interface ViewOption {
  key: CalendarView;
  label: string;
  href: string;
  Icon: typeof CalendarDays;
}

const VIEW_OPTIONS: ReadonlyArray<ViewOption> = [
  { key: 'agenda', label: 'Agenda', href: '/calendar', Icon: List },
  { key: 'month', label: 'Month', href: '/calendar?view=month', Icon: CalendarDays },
  { key: 'near', label: 'Near me', href: '/calendar?view=near', Icon: MapPin },
];

export function CalendarToggle({ active }: CalendarToggleProps) {
  return (
    <nav aria-label="Calendar view" data-testid="calendar-toggle-nav" style={navStyle}>
      {VIEW_OPTIONS.map((opt) => {
        const isActive = opt.key === active;
        const Icon = opt.Icon;
        return (
          <Link
            key={opt.key}
            href={opt.href}
            prefetch={false}
            data-testid={`calendar-toggle-${opt.key}`}
            aria-label={opt.label}
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? 'gps-chip gps-chip--active' : 'gps-chip'}
            style={iconChipStyle}
          >
            <Icon size={18} aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
