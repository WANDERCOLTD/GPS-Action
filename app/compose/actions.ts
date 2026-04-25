'use server';

/**
 * @build-unit BU-composer
 * @spec architecture/api-contract.md
 *
 * Server action wrapping post.create for client-side form submit.
 * Mirrors app/feed/actions.ts pattern: createTRPCContext → createCaller.
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
