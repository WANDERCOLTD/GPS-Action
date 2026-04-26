'use server';

/**
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052)
 *
 * Server action for the post-detail page. Called by the
 * CommentComposer client component when a member submits a reply.
 * Resolves the current user from the cookie so the auth +
 * ff_comments gate apply via the router.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';

export async function addCommentAction(postId: string, body: string): Promise<{ id: string }> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  return caller.comment.add({ postId, body });
}
