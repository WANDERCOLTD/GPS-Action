'use server';

/**
 * @build-unit BU-requests-urgent
 * @spec architecture/decision-log.md (D058)
 * @spec product/scenarios.md (SCN-23)
 *
 * Server action wrapping request.createUrgent for the alert composer.
 * Validates input via the same zod schema the router uses, then calls
 * the procedure via createCaller. Mirrors app/compose/actions.ts.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';

export interface CreateUrgentResult {
  errors?: Record<string, string[]>;
}

const formSchema = z.object({
  alertCategoryId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(2000),
});

export async function createUrgentAction(formData: FormData): Promise<CreateUrgentResult | void> {
  const raw = {
    alertCategoryId: formData.get('alertCategoryId')?.toString() ?? '',
    title: formData.get('title')?.toString() ?? '',
    body: formData.get('body')?.toString() ?? '',
  };

  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.request.createUrgent(parsed.data);
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'UNAUTHORIZED') {
      redirect('/dev/login?returnTo=/alert/new');
    }
    return { errors: { _form: ['Could not raise alert. Try again.'] } };
  }

  revalidatePath('/requests');
  revalidatePath('/feed');
  redirect('/requests');
}
