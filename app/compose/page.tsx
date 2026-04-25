/**
 * @build-unit BU-composer
 * @spec product/design-philosophy.md
 * @spec product/scenarios.md (SCN-01)
 *
 * Compose page — server component that renders the post form shell.
 * Redirects unauthenticated users to /dev/login.
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';
import { PostForm } from '@/components/PostForm';
import { createPostAction } from '@/app/compose/actions';

export const metadata = {
  title: 'New post — GPS Action',
};

export default async function ComposePage() {
  const ctx = await createTRPCContext();

  if (!ctx.user) {
    redirect('/dev/login?returnTo=/compose');
  }

  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <h1 className="gps-title" style={{ marginBottom: 'var(--space-6)' }}>
        New post
      </h1>
      <PostForm onSubmit={createPostAction} />
    </main>
  );
}
