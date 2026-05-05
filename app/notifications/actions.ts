'use server';

/**
 * @build-unit bu-coordination-board (build seq #6 — Surface 3, PR #6)
 * @spec build/session-briefs/bu-coordination-board.md
 * @spec product/scenarios.md (SCN-34)
 *
 * Server actions for the Notifications pane. Pure Surface-3 wiring —
 * the row's click fires `acknowledgeNotificationAction` and navigates
 * to the source ticket. There is no separate "mark read" gesture.
 */

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function acknowledgeNotificationAction(notificationId: string): Promise<ActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.notificationKanban.acknowledge({ notificationId });
  } catch (err) {
    if (err instanceof TRPCError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: 'Could not acknowledge — try again.' };
  }
  revalidatePath('/notifications');
  return { ok: true };
}
