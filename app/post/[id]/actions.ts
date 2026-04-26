'use server';

/**
 * @build-unit BU-comments BU-reactions
 * @spec architecture/decision-log.md (D052)
 * @spec product/scenarios.md (SCN-20)
 *
 * Server actions for the post-detail page. Called by client
 * components on the detail page; resolve the current user from
 * the cookie so the auth + ff_* gates apply via the router.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import type { FeedReactionEmoji } from '@/components/PostCard';

export async function addCommentAction(postId: string, body: string): Promise<{ id: string }> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  return caller.comment.add({ postId, body });
}

export async function addReactionToCommentAction(
  commentId: string,
  emoji: FeedReactionEmoji,
): Promise<void> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  await caller.reaction.addToComment({ commentId, emoji });
}

export async function removeReactionFromCommentAction(
  commentId: string,
  emoji: FeedReactionEmoji,
): Promise<void> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  await caller.reaction.removeFromComment({ commentId, emoji });
}
