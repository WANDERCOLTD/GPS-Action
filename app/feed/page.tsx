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
import { FeedFilterChips } from '@/components/FeedFilterChips';
import { PageHeader } from '@/components/PageHeader';
import { loadMorePosts, addReactionAction, removeReactionAction } from '@/app/feed/actions';
import type { FeedPost, FeedCursor, FeedReactionEmoji } from '@/components/PostCard';
import { isFeedFilter, type FeedFilter } from '@/shared/feed-filters';

export const metadata = {
  title: 'Feed — GPS Action',
};

interface FeedPageProps {
  searchParams: Promise<{ filter?: string | string[] }>;
}

function pickFilter(raw: string | string[] | undefined): FeedFilter {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return isFeedFilter(candidate) ? candidate : 'all';
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const ctx = await createTRPCContext();
  const filter = pickFilter((await searchParams).filter);

  if (!ctx.user) {
    return (
      <>
        <PageHeader title="Feed" description="Posts from your network" />
        <main style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
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
      </>
    );
  }

  const caller = createCaller(ctx);
  const [result, reactionsEnabled] = await Promise.all([
    caller.post.list({ filter }),
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
      kindSlug: p.kindSlug,
      kindDisplayName: p.kindDisplayName,
      urgency: p.urgency,
      heroImageUrl: p.heroImageUrl,
      signal: p.signal,
      sharedToNetworkAt: p.sharedToNetworkAt ? p.sharedToNetworkAt.toISOString() : null,
      // BU-event-time / D073 — UTC ISO at the wire boundary.
      eventAt: p.eventAt ? p.eventAt.toISOString() : null,
      eventEndsAt: p.eventEndsAt ? p.eventEndsAt.toISOString() : null,
      locationText: p.locationText,
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
      isActivistMailer: p.isActivistMailer,
      feedCommentPeekEnabled: p.feedCommentPeekEnabled,
      topComment: p.topComment
        ? {
            authorDisplayName: p.topComment.authorDisplayName,
            excerpt: p.topComment.excerpt,
            createdAt: p.topComment.createdAt.toISOString(),
          }
        : null,
      reviewedByUserId: p.reviewedByUserId,
      reviewedBy: p.reviewedBy,
    }),
  );

  const cursor: FeedCursor | null = result.nextCursor
    ? {
        createdAt: result.nextCursor.createdAt.toISOString(),
        id: result.nextCursor.id,
      }
    : null;

  return (
    <>
      <PageHeader title="Feed" description="Posts from your network">
        <FeedFilterChips active={filter} />
      </PageHeader>
      <main
        style={{
          padding: 'var(--space-5) var(--space-8) var(--space-8)',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        <FeedList
          key={filter}
          initialPosts={posts}
          initialCursor={cursor}
          loadMore={loadMorePosts.bind(null, filter)}
          onAddReaction={addReactionAction}
          onRemoveReaction={removeReactionAction}
          canReact={reactionsEnabled}
          reactionsEnabled={reactionsEnabled}
        />
      </main>
    </>
  );
}
