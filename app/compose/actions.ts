'use server';

/**
 * @build-unit BU-composer BU-link-share
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D060)
 *
 * Server action wrapping post.create for client-side form submit.
 * Mirrors app/feed/actions.ts pattern: createTRPCContext → createCaller.
 * Link-share fields are optional (D060).
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
    activistMailerUrl: formData.get('activistMailerUrl')?.toString() || undefined,
    visibility: formData.get('visibility')?.toString() ?? 'public',
    linkUrl: formData.get('linkUrl')?.toString() || undefined,
    linkTitle: formData.get('linkTitle')?.toString() || undefined,
    linkDescription: formData.get('linkDescription')?.toString() || undefined,
    linkImageUrl: formData.get('linkImageUrl')?.toString() || undefined,
    linkSiteName: formData.get('linkSiteName')?.toString() || undefined,
    kind: formData.get('kind')?.toString() || undefined,
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
