/**
 * @build-unit BU-001-lite BU-sticky-nav
 * @spec product/design-philosophy.md
 * @spec architecture/decision-log.md (D065)
 *
 * Dev-only identity strip showing the current user. Server component —
 * reads from props passed by the root layout (which resolves the user
 * via createTRPCContext).
 *
 * Shows "Not logged in" with a link to /dev/login when no user,
 * or "Logged in as X" with a "Switch user" link when authenticated.
 *
 * Per D065 the strip lives inside the sticky `<header>` in the root
 * layout — it no longer owns its own border (header wrapper does).
 * Production renders nothing (NODE_ENV guard).
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
