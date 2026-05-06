'use server';

/**
 * @build-unit bu-coord-board-share-allowlist-ui
 * @spec docs/build/session-briefs/bu-coord-board-share-allowlist-ui.md
 *
 * Server actions for the share-with-team allow-list. Wraps the
 * existing tRPC mutations:
 *
 *   - share.addWorkflow    — add a target to the allow-list
 *   - share.removeWorkflow — soft-delete a target from the allow-list
 *
 * Each action returns `{ ok, error? }` so the client can render an
 * inline error without interpreting a TRPCError. Both revalidatePath
 * the settings route on success so the page server-fetches the
 * updated allow-list and addable-target lists.
 */

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';

export interface AllowListActionResult {
  ok: boolean;
  error?: string;
}

interface AllowListActionInput {
  sourceGroupId: string;
  targetGroupId: string;
  /** Used to revalidate the precise settings + ticket-detail routes. */
  groupSlug: string;
}

function settingsPath(groupSlug: string): string {
  return `/board/${groupSlug}/settings`;
}

export async function addWorkflowAction(
  input: AllowListActionInput,
): Promise<AllowListActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.share.addWorkflow({
      sourceGroupId: input.sourceGroupId,
      targetGroupId: input.targetGroupId,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not add target — try again.' };
  }
  revalidatePath(settingsPath(input.groupSlug));
  return { ok: true };
}

export async function removeWorkflowAction(
  input: AllowListActionInput,
): Promise<AllowListActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.share.removeWorkflow({
      sourceGroupId: input.sourceGroupId,
      targetGroupId: input.targetGroupId,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not remove target — try again.' };
  }
  revalidatePath(settingsPath(input.groupSlug));
  return { ok: true };
}
