'use server';

/**
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 *
 * Server action for feed pagination. Called by the FeedList client
 * component's "Load more" button. Resolves the current user from
 * the cookie so visibility rules apply consistently.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import type { FeedPost, FeedCursor } from '@/components/PostCard';
import type { LoadMoreResult } from '@/components/FeedList';

export async function loadMorePosts(cursor: FeedCursor): Promise<LoadMoreResult> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);

  const result = await caller.post.list({
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
        createdAt: p.createdAt.toISOString(),
        author: {
          displayName: p.author.displayName,
          roles: p.author.roles as string[],
        },
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
