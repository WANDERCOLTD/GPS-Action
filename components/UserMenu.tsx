'use client';

/**
 * @build-unit bu-page-header-system
 * @spec docs/build/session-briefs/bu-page-header-system.md
 *
 * Avatar control at the right end of AppNav. Tap → popover with:
 *   - identity header (display name + session note)
 *   - "Switch user" link (dev only)
 *   - "Refresh data" — calls router.refresh() (replaces HeaderRefreshButton)
 *   - "Settings" link (replaces the Settings nav icon)
 *
 * Consolidates three previously-separate header controls
 * (`<LoggedInAs />`, `<HeaderRefreshButton>`, Settings nav icon).
 *
 * Avatar fallback: seeded display-name initials in dev; lucide `User`
 * glyph for production until a real avatar story lands (per brief Q4).
 */

import { useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Popover from '@radix-ui/react-popover';
import { Loader2, RefreshCw, Settings, User as UserIcon, UserCog } from 'lucide-react';

interface UserMenuProps {
  user: { displayName: string } | null;
  /** When true, the menu shows the dev-only "Switch user" entry. */
  isDev: boolean;
}

const TRIGGER_SIZE = 36;

const triggerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: TRIGGER_SIZE,
  height: TRIGGER_SIZE,
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-surface-sunken)',
  color: 'var(--colour-text-primary)',
  border: '1px solid var(--colour-border-subtle)',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--weight-semibold)',
  flexShrink: 0,
  padding: 0,
  lineHeight: 1,
};

const contentStyle: CSSProperties = {
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 6px 24px color-mix(in oklab, black 18%, transparent)',
  padding: 'var(--space-2)',
  minWidth: 240,
  fontFamily: 'var(--font-ui)',
  zIndex: 100,
};

const headerBlockStyle: CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--colour-border-subtle)',
  marginBottom: 'var(--space-1)',
};

const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--colour-text-primary)',
  textDecoration: 'none',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
};

const itemDisabledStyle: CSSProperties = {
  ...itemStyle,
  cursor: 'not-allowed',
  opacity: 0.6,
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  if (!first) return '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export function UserMenu({ user, isDev }: UserMenuProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  const triggerLabel = user ? `Account menu for ${user.displayName}` : 'Account menu';

  return (
    <>
      <style>{`@keyframes gps-user-menu-spin { to { transform: rotate(360deg); } }`}</style>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            data-testid="nav-user-menu-trigger"
            aria-label={triggerLabel}
            style={triggerStyle}
          >
            {user ? (
              initialsFor(user.displayName) || <UserIcon size={18} aria-hidden="true" />
            ) : (
              <UserIcon size={18} aria-hidden="true" />
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            data-testid="nav-user-menu-content"
            style={contentStyle}
          >
            <div style={headerBlockStyle}>
              <div
                style={{
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--colour-text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {user ? user.displayName : 'Not signed in'}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--colour-text-tertiary)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {isDev ? 'Dev session' : 'Signed in'}
              </div>
            </div>

            {isDev && (
              <Link href="/dev/login" data-testid="nav-user-menu-switch-user" style={itemStyle}>
                <UserCog size={16} aria-hidden="true" />
                <span>{user ? 'Switch user' : 'Sign in'}</span>
              </Link>
            )}

            <button
              type="button"
              data-testid="nav-user-menu-refresh"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={isRefreshing}
              style={isRefreshing ? itemDisabledStyle : itemStyle}
            >
              {isRefreshing ? (
                <Loader2
                  size={16}
                  aria-hidden="true"
                  style={{ animation: 'gps-user-menu-spin 700ms linear infinite' }}
                />
              ) : (
                <RefreshCw size={16} aria-hidden="true" />
              )}
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh data'}</span>
            </button>

            <Link href="/settings" data-testid="nav-user-menu-settings" style={itemStyle}>
              <Settings size={16} aria-hidden="true" />
              <span>Settings</span>
            </Link>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
