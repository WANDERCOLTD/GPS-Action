'use server';

/**
 * @build-unit BU-event-time
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D073)
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Server action wrapping post.update for the /post/[id]/edit form.
 * Mirrors app/compose/actions.ts: createTRPCContext → createCaller,
 * Zod validation, redirect / error pattern.
 *
 * BU-event-time / D073: composer + edit submit Europe/London
 * wall-clock; this action converts to UTC via shared/format-event-time
 * before passing to postUpdateSchema. Empty inputs round-trip to null
 * (explicit clear) on the edit surface, where the user MAY want to
 * remove a previously-set timestamp.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { postUpdateSchema } from '@/shared/validation/post';
import { eventInputToUtc } from '@/shared/format-event-time';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { TRPCError } from '@trpc/server';

export interface UpdatePostResult {
  errors?: Record<string, string[]>;
}

export async function updatePostAction(
  postId: string,
  formData: FormData,
): Promise<UpdatePostResult | void> {
  const eventAtDate = formData.get('eventAtDate')?.toString() ?? '';
  const eventAtTime = formData.get('eventAtTime')?.toString() ?? '';
  const eventEndsAtDate = formData.get('eventEndsAtDate')?.toString() ?? '';
  const eventEndsAtTime = formData.get('eventEndsAtTime')?.toString() ?? '';
  const locationTextRaw = formData.get('locationText')?.toString() ?? '';

  // BU-event-time / D073. The edit surface needs explicit-null
  // semantics: an empty input means "clear the previously-set value".
  // Pass null (not undefined) when the user blanked the field.
  const eventAtUtc = eventAtDate ? eventInputToUtc(eventAtDate, eventAtTime || null) : null;
  const eventEndsAtUtc = eventEndsAtDate
    ? eventInputToUtc(eventEndsAtDate, eventEndsAtTime || null)
    : null;

  const raw = {
    id: postId,
    title: formData.get('title')?.toString() ?? undefined,
    body: formData.get('body')?.toString() ?? undefined,
    visibility: formData.get('visibility')?.toString() ?? undefined,
    linkUrl: formData.get('linkUrl')?.toString() ?? undefined,
    linkTitle: formData.get('linkTitle')?.toString() ?? undefined,
    linkDescription: formData.get('linkDescription')?.toString() ?? undefined,
    linkImageUrl: formData.get('linkImageUrl')?.toString() ?? undefined,
    linkSiteName: formData.get('linkSiteName')?.toString() ?? undefined,
    heroImageUrl: formData.get('heroImageUrl')?.toString() ?? undefined,
    eventAt: eventAtUtc,
    eventEndsAt: eventEndsAtUtc,
    locationText: locationTextRaw.trim() ? locationTextRaw : '',
  };

  const parsed = postUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.post.update(parsed.data);
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'UNAUTHORIZED') {
      redirect(`/dev/login?returnTo=/post/${postId}/edit`);
    }
    console.error('[post/edit/actions] post.update failed:', err);
    return {
      errors: { _form: ['Could not save changes. Try again.'] },
    };
  }

  revalidatePath('/feed');
  revalidatePath(`/post/${postId}`);
  redirect(`/post/${postId}`);
}
