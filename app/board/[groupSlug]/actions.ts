'use server';

/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, drag-wiring follow-up)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Server actions for Surface 1 — currently just `moveCardAction`,
 * which wraps `board.moveCard` so the kanban grid (a client
 * component) can invoke it from `onDragEnd`. On success the action
 * `revalidatePath`s the per-group board route so the next render
 * carries fresh card positions; the client also keeps an optimistic
 * copy and reverts on failure.
 */

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';

export interface MoveCardActionResult {
  ok: boolean;
  error?: string;
}

export type MoveCardActionDestination =
  | { lane: 'active'; columnId: string }
  | { lane: 'backlog' | 'done' | 'abandoned' };

export interface MoveCardActionInput {
  requestId: string;
  groupId: string;
  /** Used to revalidate the precise board route on success. */
  groupSlug: string;
  destination: MoveCardActionDestination;
  beforeRequestId?: string | null;
  afterRequestId?: string | null;
}

export async function moveCardAction(
  input: MoveCardActionInput,
): Promise<MoveCardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.board.moveCard({
      requestId: input.requestId,
      groupId: input.groupId,
      destination: input.destination,
      beforeRequestId: input.beforeRequestId ?? null,
      afterRequestId: input.afterRequestId ?? null,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not move the card — try again.' };
  }
  revalidatePath(`/board/${input.groupSlug}`);
  return { ok: true };
}
