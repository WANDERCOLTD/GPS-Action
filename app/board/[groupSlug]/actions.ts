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

export async function moveCardAction(input: MoveCardActionInput): Promise<MoveCardActionResult> {
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
  // Revalidate every list-view that could now be stale: the source
  // page (where the card was) and the destination page (where it's
  // going). Cheaper than narrowly tracking source — three Next.js
  // revalidations is negligible vs. risking a stale render.
  revalidatePath(`/board/${input.groupSlug}`);
  revalidatePath(`/board/${input.groupSlug}/backlog`);
  revalidatePath(`/board/${input.groupSlug}/done`);
  return { ok: true };
}

// ── Propose to backlog ───────────────────────────────────────────────────

export interface ProposeTicketActionInput {
  groupId: string;
  groupSlug: string;
  title: string;
  body: string | null;
}

export interface ProposeTicketActionResult {
  ok: boolean;
  requestId?: string;
  error?: string;
}

export async function proposeTicketAction(
  input: ProposeTicketActionInput,
): Promise<ProposeTicketActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    const result = await caller.board.propose({
      groupId: input.groupId,
      title: input.title,
      body: input.body,
    });
    revalidatePath(`/board/${input.groupSlug}`);
    revalidatePath(`/board/${input.groupSlug}/backlog`);
    return { ok: true, requestId: result.requestId };
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not propose ticket — try again.' };
  }
}

// ── Quick-add into a column ──────────────────────────────────────────────

export interface QuickAddCardActionInput {
  groupId: string;
  groupSlug: string;
  columnId: string;
  title: string;
}

export interface QuickAddCardActionResult {
  ok: boolean;
  requestId?: string;
  error?: string;
}

export async function quickAddCardAction(
  input: QuickAddCardActionInput,
): Promise<QuickAddCardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    const result = await caller.board.quickAdd({
      groupId: input.groupId,
      columnId: input.columnId,
      title: input.title,
    });
    revalidatePath(`/board/${input.groupSlug}`);
    return { ok: true, requestId: result.requestId };
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not add card — try again.' };
  }
}
