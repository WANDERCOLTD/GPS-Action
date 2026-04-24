/**
 * @build-unit BU-feed
 * @spec product/design-philosophy.md
 * @spec product/scenarios.md (SCN-01)
 *
 * Feed page — the core demo page. Authenticated users see a
 * chronological list of posts. Unauthenticated users see a
 * login prompt. Server component; initial data fetched server-side.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { FeedList } from '@/components/FeedList';
import { loadMorePosts } from '@/app/feed/actions';
import type { FeedPost, FeedCursor } from '@/components/PostCard';

export const metadata = {
  title: 'Feed — GPS Action',
};

export default async function FeedPage() {
  const ctx = await createTRPCContext();

  if (!ctx.user) {
    return (
      <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
        <h1 className="gps-title" style={{ marginBottom: 'var(--space-3)' }}>
          GPS Action
        </h1>
        <p style={{ color: 'var(--colour-text-secondary)' }}>
          Please{' '}
          <a href="/dev/login" style={{ color: 'var(--colour-text-link)' }}>
            log in
          </a>{' '}
          to see the feed.
        </p>
      </main>
    );
  }

  const caller = createCaller(ctx);
  const result = await caller.post.list();

  // Serialise dates for the client component boundary
  const posts: FeedPost[] = result.posts.map(
    (p): FeedPost => ({
      id: p.id,
      title: p.title,
      body: p.body,
      activistMailerUrl: p.activistMailerUrl,
      createdAt: p.createdAt.toISOString(),
      author: {
        displayName: p.author.displayName,
        roles: p.author.roles as string[],
      },
    }),
  );

  const cursor: FeedCursor | null = result.nextCursor
    ? {
        createdAt: result.nextCursor.createdAt.toISOString(),
        id: result.nextCursor.id,
      }
    : null;

  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <h1 className="gps-title" style={{ marginBottom: 'var(--space-6)' }}>
        Feed
      </h1>
      <FeedList initialPosts={posts} initialCursor={cursor} loadMore={loadMorePosts} />
    </main>
  );
}
