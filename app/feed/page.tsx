/**
 * @build-unit BU-feed
 * @spec product/design-philosophy.md
 * @spec product/scenarios.md (SCN-18)
 *
 * Feed page — the core demo page. Authenticated users see a
 * chronological list of posts. Unauthenticated users see a
 * login prompt. Server component; initial data fetched server-side.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { FeedList } from '@/components/FeedList';
import { loadMorePosts, addReactionAction, removeReactionAction } from '@/app/feed/actions';
import type { FeedPost, FeedCursor, FeedReactionEmoji } from '@/components/PostCard';

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
          <a
            href="/dev/login"
            style={{ color: 'var(--colour-text-link)' }}
            data-testid="feed-login-link"
          >
            log in
          </a>{' '}
          to see the feed.
        </p>
      </main>
    );
  }

  const caller = createCaller(ctx);
  const [result, reactionsEnabled] = await Promise.all([
    caller.post.list(),
    isFeatureEnabled('ff_reactions'),
  ]);

  // Serialise dates for the client component boundary
  const posts: FeedPost[] = result.posts.map(
    (p): FeedPost => ({
      id: p.id,
      title: p.title,
      body: p.body,
      activistMailerUrl: p.activistMailerUrl,
      linkUrl: p.linkUrl,
      linkTitle: p.linkTitle,
      linkDescription: p.linkDescription,
      linkImageUrl: p.linkImageUrl,
      linkSiteName: p.linkSiteName,
      createdAt: p.createdAt.toISOString(),
      author: {
        displayName: p.author.displayName,
        roles: p.author.roles as string[],
      },
      reactions: p.reactions.map((r) => ({
        emoji: r.emoji as FeedReactionEmoji,
        count: r.count,
        mine: r.mine,
      })),
      commentCount: p.commentCount,
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-6)',
        }}
      >
        <h1 className="gps-title">Feed</h1>
        <a
          href="/compose"
          className="gps-btn gps-btn--primary gps-btn--sm"
          data-testid="feed-newpost-link"
        >
          New post
        </a>
      </div>
      <FeedList
        initialPosts={posts}
        initialCursor={cursor}
        loadMore={loadMorePosts}
        onAddReaction={addReactionAction}
        onRemoveReaction={removeReactionAction}
        canReact={reactionsEnabled}
        reactionsEnabled={reactionsEnabled}
      />
    </main>
  );
}
