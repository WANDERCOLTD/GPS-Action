'use client';

/**
 * @build-unit BU-requests-foundation BU-sticky-nav BU-calendar-view BU-icon-nav BU-icon-strips
 * @spec architecture/decision-log.md (D054, D061, D065, D073)
 * @spec architecture/admin-surface.md
 *
 * Top-level horizontal navigation strip. Rendered once by the root
 * layout inside the sticky `<header>`. Active link is derived from
 * `usePathname()` rather than a per-page `active` prop (D065).
 *
 *   [home] | [calendar-clock]? | [inbox] | [bar-chart-3] | [settings]
 *
 * The Calendar tab is gated by the `calendar_enabled` feature flag
 * (BU-calendar-view / D073). The flag is resolved in the layout (server
 * component) and passed down so this client component never reads from
 * the database.
 *
 * BU-icon-nav (2026-04-30): tabs are icons-only. Each `<Link>` keeps
 * the prior text label as `aria-label` so screen readers continue to
 * announce "Feed", "Calendar", "Requests", "Data", "Settings". Sighted
 * users learn the icons.
 *
 * BU-icon-strips (2026-05-01): each link is wrapped in
 * `IconChipTooltip` to reveal the tab name on hover (300ms) /
 * long-press (600ms). AppNav is the canary surface; the same
 * primitive is then re-used across `FeedFilterChips`,
 * `CommentList` filter tabs, and `NearMeView` sort.
 *
 * Per D061 every link is an explicit interactive element with a
 * canonical testid (F14 'nav' area). All testids preserved verbatim
 * across BU-sticky-nav and BU-icon-nav.
 *
 */

import * as React from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarClock, Inbox, Settings } from 'lucide-react';
import { IconChipTooltip } from '@/components/IconChipTooltip';

interface AppNavProps {
  /** Unread Notification count (BU-requests-vetting / D057). Renders a red dot when > 0. */
  unreadNotificationCount?: number;
  /** BU-calendar-view / D073: when true, renders the Calendar tab between Feed and Requests. */
  calendarEnabled?: boolean;
}

type ActiveKey = 'feed' | 'calendar' | 'compose' | 'requests' | 'settings' | null;

function deriveActive(pathname: string | null): ActiveKey {
  if (!pathname) return null;
  if (pathname === '/feed' || pathname.startsWith('/feed/')) return 'feed';
  if (pathname === '/calendar' || pathname.startsWith('/calendar/')) return 'calendar';
  if (pathname === '/compose' || pathname.startsWith('/compose/')) return 'compose';
  if (pathname === '/requests' || pathname.startsWith('/requests/')) return 'requests';
  // /data is no longer a top-level tab — reached via /settings → "Data" entry.
  // Treat /data and /data/[entity] as "settings" for active-tab highlighting
  // so the Settings icon stays lit while a member is browsing data tables.
  if (pathname === '/data' || pathname.startsWith('/data/')) return 'settings';
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return 'settings';
  return null;
}

/**
 * Each tab's hit area. Icon sits centred inside ≥44×44 px to satisfy
 * mobile touch-target guidance (WCAG 2.5.5 / Apple HIG). Padding +
 * line-height keep the active background highlight visually stable.
 */
const linkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 44,
  minHeight: 44,
  padding: 'var(--space-2) var(--space-3)',
  color: 'var(--colour-text-link)',
  textDecoration: 'none',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-ui)',
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  position: 'relative',
};

const activeStyle: CSSProperties = {
  ...linkStyle,
  background: 'var(--colour-surface-sunken)',
  fontWeight: 600,
};

const ICON_SIZE = 22;
const ICON_STROKE = 2;

export function AppNav({ unreadNotificationCount = 0, calendarEnabled = false }: AppNavProps) {
  const active = deriveActive(usePathname());

  return (
    <nav
      data-testid="nav-app-strip"
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-4)',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
      }}
    >
      <IconChipTooltip label="Feed">
        <Link
          href="/feed"
          aria-label="Feed"
          data-testid="nav-feed-link"
          style={active === 'feed' ? activeStyle : linkStyle}
        >
          <Home size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
        </Link>
      </IconChipTooltip>
      {calendarEnabled && (
        <IconChipTooltip label="Calendar">
          <Link
            href="/calendar"
            aria-label="Calendar"
            data-testid="nav-calendar-link"
            style={active === 'calendar' ? activeStyle : linkStyle}
          >
            <CalendarClock size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </Link>
        </IconChipTooltip>
      )}
      <IconChipTooltip label="Requests">
        <Link
          href="/requests"
          aria-label="Requests"
          data-testid="nav-requests-link"
          style={active === 'requests' ? activeStyle : linkStyle}
        >
          <Inbox size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
          {unreadNotificationCount > 0 && (
            <span
              data-testid="nav-requests-unread-dot"
              data-count={unreadNotificationCount}
              aria-label={`${unreadNotificationCount} unread notifications`}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                display: 'inline-block',
                minWidth: 16,
                height: 16,
                lineHeight: '16px',
                padding: '0 5px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--colour-urgent)',
                color: 'var(--colour-urgent-contrast)',
                fontSize: 'var(--text-2xs)',
                fontWeight: 700,
                textAlign: 'center' as const,
              }}
            >
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </span>
          )}
        </Link>
      </IconChipTooltip>
      <IconChipTooltip label="Settings">
        <Link
          href="/settings"
          aria-label="Settings"
          data-testid="nav-settings-link"
          style={active === 'settings' ? activeStyle : linkStyle}
        >
          <Settings size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
        </Link>
      </IconChipTooltip>
    </nav>
  );
}
