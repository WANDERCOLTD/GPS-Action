/**
 * @build-unit BU-001-lite
 * @spec architecture/environments.md
 *
 * Dev login page. Lists seeded users with "Log in as X" buttons.
 * Plain and functional — not a production UI.
 */

import { notFound } from 'next/navigation';
import { createCaller } from '@/server/routers/_app';
import { isDemoMode } from '@/shared/demo-mode';
import { loginAs } from './actions';

export const metadata = {
  title: 'Dev Login — GPS Action',
};

// Defence-in-depth: layout already 404s in production, but build-time
// static generation evaluates the page before the layout's runtime guard,
// and the dev tRPC router isn't registered when NODE_ENV='production' —
// so calling caller.dev!.listUsers() fails the prerender. Bail early
// with the same condition the layout uses.
export default async function DevLoginPage() {
  if (process.env.NODE_ENV === 'production' && !isDemoMode()) {
    notFound();
  }

  const caller = createCaller({ user: null, activeRoles: [], activeScopes: [] });
  // dev router is always present here — guarded above + by app/dev/layout.tsx
  const { users } = await caller.dev!.listUsers();

  if (users.length === 0) {
    return (
      <main style={{ padding: 'var(--space-8)', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)' }}>Dev login</h1>
        <p style={{ color: 'var(--colour-text-secondary)' }}>
          No users found. Run <code>npm run db:seed</code> to populate demo data.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)' }}>Dev login</h1>
      <p
        style={{
          color: 'var(--colour-text-secondary)',
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--text-sm)',
        }}
      >
        Pick a user to continue. Cookie-based, dev only.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {users.map((user) => (
          <li key={user.id} style={{ marginBottom: 'var(--space-2)' }}>
            <form
              action={loginAs.bind(null, user.id)}
              data-testid="auth-devlogin-form"
              data-user-id={user.id}
            >
              <button
                type="submit"
                data-testid="auth-devlogin-submit"
                data-user-id={user.id}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--colour-surface-raised)',
                  border: '1px solid var(--colour-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--text-base)',
                  color: 'var(--colour-text-primary)',
                  textAlign: 'left',
                }}
              >
                <span>{user.displayName}</span>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--colour-text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {user.activeRoles.length > 0 ? user.activeRoles.join(', ') : 'member'}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
