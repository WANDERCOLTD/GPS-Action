'use client';

/**
 * @build-unit BU-requests-foundation BU-sticky-nav
 * @spec architecture/decision-log.md (D054, D061, D065)
 * @spec architecture/admin-surface.md
 *
 * Top-level horizontal navigation strip. Rendered once by the root
 * layout inside the sticky `<header>`. Active link is derived from
 * `usePathname()` rather than a per-page `active` prop (D065).
 *
 *   Feed | Requests | Data | Settings
 *
 * Per D061 every link is an explicit interactive element with a
 * canonical testid (F14 'nav' area). All testids preserved verbatim
 * across the BU-sticky-nav consolidation.
 */

import * as React from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AppNavProps {
  /** Unread Notification count (BU-requests-vetting / D057). Renders a red dot when > 0. */
  unreadNotificationCount?: number;
}

type ActiveKey = 'feed' | 'compose' | 'requests' | 'data' | 'settings' | null;

function deriveActive(pathname: string | null): ActiveKey {
  if (!pathname) return null;
  if (pathname === '/feed' || pathname.startsWith('/feed/')) return 'feed';
  if (pathname === '/compose' || pathname.startsWith('/compose/')) return 'compose';
  if (pathname === '/requests' || pathname.startsWith('/requests/')) return 'requests';
  if (pathname === '/data' || pathname.startsWith('/data/')) return 'data';
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return 'settings';
  return null;
}

const linkStyle: CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  color: 'var(--colour-text-link)',
  textDecoration: 'none',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-ui)',
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};

const activeStyle: CSSProperties = {
  ...linkStyle,
  background: 'var(--colour-surface-sunken)',
  fontWeight: 600,
};

export function AppNav({ unreadNotificationCount = 0 }: AppNavProps) {
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
      <Link
        href="/feed"
        data-testid="nav-feed-link"
        style={active === 'feed' ? activeStyle : linkStyle}
      >
        Feed
      </Link>
      <Link
        href="/requests"
        data-testid="nav-requests-link"
        style={{
          ...(active === 'requests' ? activeStyle : linkStyle),
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
      >
        Requests
        {unreadNotificationCount > 0 && (
          <span
            data-testid="nav-requests-unread-dot"
            data-count={unreadNotificationCount}
            aria-label={`${unreadNotificationCount} unread notifications`}
            style={{
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
      <Link
        href="/data"
        data-testid="nav-data-link"
        style={active === 'data' ? activeStyle : linkStyle}
      >
        Data
      </Link>
      <Link
        href="/settings"
        data-testid="nav-settings-link"
        style={active === 'settings' ? activeStyle : linkStyle}
      >
        Settings
      </Link>
    </nav>
  );
}
