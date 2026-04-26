'use server';

/**
 * @build-unit BU-requests-urgent
 * @spec architecture/decision-log.md (D058)
 * @spec product/scenarios.md (SCN-23)
 *
 * Server actions for the Requests workspace — claim and resolve.
 * Both wrap the corresponding tRPC procedure via createCaller.
 */

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function claimRequestAction(requestId: string): Promise<ActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.request.claim({ requestId });
  } catch (err) {
    if (err instanceof TRPCError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: 'Could not claim — try again.' };
  }
  revalidatePath('/requests');
  revalidatePath('/feed');
  return { ok: true };
}

export async function resolveRequestAction(input: {
  requestId: string;
  notes: string;
}): Promise<ActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.request.resolve({
      requestId: input.requestId,
      notes: input.notes.trim() || undefined,
    });
  } catch (err) {
    if (err instanceof TRPCError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: 'Could not resolve — try again.' };
  }
  revalidatePath('/requests');
  revalidatePath('/feed');
  return { ok: true };
}
