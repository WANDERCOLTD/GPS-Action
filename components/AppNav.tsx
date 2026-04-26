/**
 * @build-unit BU-requests-foundation
 * @spec architecture/decision-log.md (D054, D061)
 * @spec architecture/admin-surface.md
 *
 * Top-level horizontal navigation strip. Only renders for authenticated
 * users; anonymous viewers see the LoggedInAs strip instead. Visible
 * links surface the demo-able app surfaces:
 *
 *   Feed | Compose | Requests | Data | Settings
 *
 * Per D061 every link is an explicit interactive element with a
 * canonical testid (F14 'nav' area).
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';

interface AppNavProps {
  /** Active route key for highlighting; null = none active. */
  active?: 'feed' | 'compose' | 'requests' | 'data' | 'settings' | null;
  /** True when the caller has any reviewer scope (queue_manager role/scope). */
  hasReviewerAccess?: boolean;
  /** Unread Notification count (BU-requests-vetting / D057). Renders a red dot when > 0. */
  unreadNotificationCount?: number;
}

const linkStyle: CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  color: 'var(--colour-text-link)',
  textDecoration: 'none',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-ui)',
  borderRadius: 'var(--radius-sm)',
};

const activeStyle: CSSProperties = {
  ...linkStyle,
  background: 'var(--colour-surface-sunken)',
  fontWeight: 600,
};

export function AppNav({
  active = null,
  hasReviewerAccess = false,
  unreadNotificationCount = 0,
}: AppNavProps) {
  return (
    <nav
      data-testid="nav-app-strip"
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--colour-border-subtle)',
        background: 'var(--colour-surface-raised)',
        flexWrap: 'wrap',
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
        Requests{hasReviewerAccess ? ' (reviewer)' : ''}
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
