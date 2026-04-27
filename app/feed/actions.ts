'use server';

/**
 * @build-unit BU-feed BU-reactions
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D050)
 *
 * Server actions for the feed:
 *   - loadMorePosts (BU-feed) — paginate
 *   - addReaction / removeReaction (BU-reactions / D050) —
 *     toggle a reaction; called by the ReactionPill client component.
 *
 * Resolves the current user from the cookie so visibility rules and
 * the auth gate apply consistently to every action.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import type { FeedPost, FeedCursor, FeedReactionEmoji } from '@/components/PostCard';
import type { LoadMoreResult } from '@/components/FeedList';
import type { FeedFilter } from '@/shared/feed-filters';

export async function loadMorePosts(
  filter: FeedFilter,
  cursor: FeedCursor,
): Promise<LoadMoreResult> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);

  const result = await caller.post.list({
    filter,
    cursor: {
      createdAt: new Date(cursor.createdAt),
      id: cursor.id,
    },
  });

  return {
    posts: result.posts.map(
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
    ),
    nextCursor: result.nextCursor
      ? {
          createdAt: result.nextCursor.createdAt.toISOString(),
          id: result.nextCursor.id,
        }
      : null,
  };
}

export async function addReactionAction(postId: string, emoji: FeedReactionEmoji): Promise<void> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  await caller.reaction.add({ postId, emoji });
}

export async function removeReactionAction(
  postId: string,
  emoji: FeedReactionEmoji,
): Promise<void> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  await caller.reaction.remove({ postId, emoji });
}
