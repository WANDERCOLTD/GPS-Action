'use server';

/**
 * @build-unit bu-coordination-board (build seq #5 — Surface 2, PR #5b)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Server actions for the BoardActionPair on Surface 2. Wraps the four
 * existing tRPC mutations:
 *
 *   - assignment.assignSelf      — auto-subscribes (Tier-2 default #4).
 *   - assignment.unassignSelf    — leaves any existing subscription in place.
 *   - subscription.followSelf    — manual gesture, source = 'explicit'.
 *   - subscription.unfollowSelf  — soft-deletes the subscription row.
 *
 * Each action returns `{ ok, error? }` so the client can render an
 * inline error without interpreting a TRPCError. All four
 * `revalidatePath` the ticket-detail route on success so the page
 * server-fetches the updated assignees / subscribers list.
 */

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';

export interface BoardActionResult {
  ok: boolean;
  error?: string;
}

interface BoardActionInput {
  requestId: string;
  /** Used to revalidate the precise ticket-detail route on success. */
  groupSlug: string;
}

function ticketPath(input: BoardActionInput): string {
  return `/board/${input.groupSlug}/${input.requestId}`;
}

export async function assignSelfAction(input: BoardActionInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.assignment.assignSelf({ requestId: input.requestId });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not assign — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

export async function unassignSelfAction(input: BoardActionInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.assignment.unassignSelf({ requestId: input.requestId });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not unassign — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

export async function followSelfAction(input: BoardActionInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.subscription.followSelf({ requestId: input.requestId });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not follow — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

export async function unfollowSelfAction(input: BoardActionInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.subscription.unfollowSelf({ requestId: input.requestId });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not unfollow — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

interface EditTitleInput extends BoardActionInput {
  /** The group whose board the editor is acting on (drives the gate). */
  groupId: string;
  title: string;
}

interface EditBodyInput extends BoardActionInput {
  groupId: string;
  /** null clears the description. */
  body: string | null;
}

export async function editTitleAction(input: EditTitleInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.board.editTitle({
      requestId: input.requestId,
      groupId: input.groupId,
      title: input.title,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not save — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

export async function editBodyAction(input: EditBodyInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.board.editBody({
      requestId: input.requestId,
      groupId: input.groupId,
      body: input.body,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not save — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}
