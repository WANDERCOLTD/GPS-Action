'use server';

/**
 * @build-unit BU-requests-vetting
 * @spec architecture/decision-log.md (D056, D057)
 * @spec product/scenarios.md (SCN-21, SCN-22)
 *
 * Server actions for the Request detail panel. Wraps comment creation
 * and the existing claim/resolve actions through createCaller.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { CommentAudience } from '@prisma/client';
import { createTRPCContext } from '@/server/routers/context';
import { createCommentForRequest } from '@/server/services/comment';
import { markReadForRequest } from '@/server/services/notification';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const addCommentSchema = z.object({
  requestId: z.string().min(1),
  body: z.string().trim().min(1).max(10000),
  audience: z.enum(['all', 'reviewers']),
});

export async function addCommentToRequestAction(input: {
  requestId: string;
  body: string;
  audience: CommentAudience;
}): Promise<ActionResult> {
  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input' };
  }

  try {
    const ctx = await createTRPCContext();
    if (!ctx.user) {
      return { ok: false, error: 'Not authenticated' };
    }
    // The caller's audience choice is honoured but only reviewers can
    // post `audience: 'reviewers'` — submitters must use 'all'.
    const isReviewer =
      ctx.activeRoles.includes('admin') ||
      ctx.activeRoles.includes('queue_manager') ||
      ctx.activeScopes.length > 0;
    const audience: CommentAudience = isReviewer ? parsed.data.audience : 'all';

    await createCommentForRequest({
      requestId: parsed.data.requestId,
      body: parsed.data.body,
      authorId: ctx.user.id,
      audience,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not add comment',
    };
  }

  revalidatePath(`/requests/${input.requestId}`);
  revalidatePath('/requests');
  return { ok: true };
}

export async function markRequestNotificationsReadAction(requestId: string): Promise<void> {
  const ctx = await createTRPCContext();
  if (!ctx.user) return;
  await markReadForRequest({ userId: ctx.user.id, requestId });
  revalidatePath('/requests');
}
