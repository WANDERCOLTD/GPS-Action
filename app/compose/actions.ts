'use server';

/**
 * @build-unit BU-composer BU-link-share BU-am-link-collapse
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D060)
 * @spec build/session-briefs/bu-am-link-collapse.md
 *
 * Server action wrapping post.create for client-side form submit.
 * Mirrors app/feed/actions.ts pattern: createTRPCContext → createCaller.
 * Link-share fields are optional (D060).
 *
 * BU-am-link-collapse: the composer no longer submits
 * `activistMailerUrl`. Activist-Mailer URLs paste into the regular
 * `linkUrl` field; the preview card auto-detects the AM domain at
 * render time. The schema validator still accepts
 * `activistMailerUrl` for backwards-compat (legacy seed + service-
 * layer writes); the composer just stops sending it.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { postCreateSchema } from '@/shared/validation/post';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { TRPCError } from '@trpc/server';

export interface CreatePostResult {
  errors?: Record<string, string[]>;
}

export async function createPostAction(formData: FormData): Promise<CreatePostResult | void> {
  const raw = {
    title: formData.get('title')?.toString() ?? '',
    body: formData.get('body')?.toString() ?? '',
    visibility: formData.get('visibility')?.toString() ?? 'public',
    linkUrl: formData.get('linkUrl')?.toString() || undefined,
    linkTitle: formData.get('linkTitle')?.toString() || undefined,
    linkDescription: formData.get('linkDescription')?.toString() || undefined,
    linkImageUrl: formData.get('linkImageUrl')?.toString() || undefined,
    linkSiteName: formData.get('linkSiteName')?.toString() || undefined,
    kindId: formData.get('kindId')?.toString() || undefined,
    urgency: formData.get('urgency')?.toString() === 'true' ? true : undefined,
  };

  const parsed = postCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.post.create(parsed.data);
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'UNAUTHORIZED') {
      redirect('/dev/login?returnTo=/compose');
    }
    return {
      errors: { _form: ['Could not create post. Try again.'] },
    };
  }

  revalidatePath('/feed');
  redirect('/feed');
}
