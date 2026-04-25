/**
 * @build-unit BU-001-lite
 * @spec product/design-philosophy.md
 *
 * Header component showing the current dev user. Server component —
 * reads from props passed by the root layout (which resolves the user
 * via createTRPCContext).
 *
 * Shows "Not logged in" with a link to /dev/login when no user,
 * or "Logged in as X" with a "Switch user" link when authenticated.
 */

import type { FC } from 'react';

interface LoggedInAsProps {
  user: { displayName: string } | null;
}

export const LoggedInAs: FC<LoggedInAsProps> = ({ user }) => {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-4)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--colour-text-tertiary)',
        borderBottom: '1px solid var(--colour-border-subtle)',
      }}
    >
      {user ? (
        <>
          <span>
            Logged in as{' '}
            <strong style={{ color: 'var(--colour-text-primary)' }}>{user.displayName}</strong>
          </span>
          <a
            href="/dev/login"
            data-testid="nav-switchuser-link"
            style={{
              color: 'var(--colour-text-link)',
              textDecoration: 'none',
            }}
          >
            Switch user
          </a>
        </>
      ) : (
        <a
          href="/dev/login"
          data-testid="nav-login-link"
          style={{
            color: 'var(--colour-text-link)',
            textDecoration: 'none',
          }}
        >
          Not logged in — pick a user
        </a>
      )}
    </div>
  );
};
