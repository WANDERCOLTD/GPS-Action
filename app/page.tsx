/**
 * @build-unit BU-000-scaffold BU-feed
 * @spec architecture/decision-log.md (D003)
 *
 * Landing page — redirects authenticated users to /feed,
 * shows a login prompt otherwise.
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';

export default async function Page() {
  const ctx = await createTRPCContext();

  if (ctx.user) {
    redirect('/feed');
  }

  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-3)' }}>GPS Action</h1>
      <p style={{ color: 'var(--colour-text-secondary)' }}>
        Please{' '}
        <a
          href="/dev/login"
          style={{ color: 'var(--colour-text-link)' }}
          data-testid="auth-landing-login-link"
        >
          log in
        </a>{' '}
        to get started.
      </p>
    </main>
  );
}
