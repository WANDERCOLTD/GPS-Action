'use server';

/**
 * @build-unit BU-comments BU-reactions BU-tick-or-cross
 * @spec architecture/decision-log.md (D052, D069)
 * @spec product/scenarios.md (SCN-20)
 *
 * Server actions for the post-detail page. Called by client
 * components on the detail page; resolve the current user from
 * the cookie so the auth + ff_* gates apply via the router.
 *
 * BU-tick-or-cross: `markPostSharedToNetworkAction` wraps
 * `post.markSharedToNetwork` so the SendToNetworkConfirm modal (and
 * the card-side retry CTA) can flip the timestamp without reaching
 * for the tRPC client directly.
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

// BU-tick-or-cross / D069. Idempotent self-report after the WhatsApp
// handoff. Returns the row's `sharedToNetworkAt` so the caller can
// echo the timestamp back into local UI state without a refetch.
export async function markPostSharedToNetworkAction(
  postId: string,
): Promise<{ alreadyShared: boolean; sharedToNetworkAt: Date }> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  return caller.post.markSharedToNetwork({ postId });
}
