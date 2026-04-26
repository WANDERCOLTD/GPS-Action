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

export function AppNav({ active = null, hasReviewerAccess = false }: AppNavProps) {
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
        href="/compose"
        data-testid="nav-compose-link"
        style={active === 'compose' ? activeStyle : linkStyle}
      >
        Compose
      </Link>
      <Link
        href="/requests"
        data-testid="nav-requests-link"
        style={active === 'requests' ? activeStyle : linkStyle}
      >
        Requests{hasReviewerAccess ? ' (reviewer)' : ''}
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
