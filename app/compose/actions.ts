'use server';

/**
 * @build-unit BU-composer BU-link-share BU-am-link-collapse BU-post-hero-demo BU-tick-or-cross
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D060, D064, D069)
 * @spec build/session-briefs/bu-am-link-collapse.md
 * @spec build/session-briefs/bu-post-hero-demo.md
 * @spec build/session-briefs/bu-tick-or-cross.md
 *
 * Server action wrapping post.create for client-side form submit.
 * Mirrors app/feed/actions.ts pattern: createTRPCContext → createCaller.
 * Link-share fields are optional (D060). Hero image (D064) is optional;
 * its allow-list is enforced by the validator.
 *
 * BU-am-link-collapse: the composer no longer submits
 * `activistMailerUrl`. Activist-Mailer URLs paste into the regular
 * `linkUrl` field; the preview card auto-detects the AM domain at
 * render time. The schema validator still accepts
 * `activistMailerUrl` for backwards-compat (legacy seed + service-
 * layer writes); the composer just stops sending it.
 *
 * BU-tick-or-cross: when `signal` is set (kind === tick_or_cross),
 * the action does NOT redirect on success. It returns
 * `{ handoff: { postId, signal } }` so the client can open the
 * SendToNetworkConfirm modal. All other kinds keep the redirect-to-feed
 * behaviour.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { postCreateSchema } from '@/shared/validation/post';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { TRPCError } from '@trpc/server';
import type { Signal } from '@prisma/client';

export interface CreatePostResult {
  errors?: Record<string, string[]>;
  handoff?: {
    postId: string;
    signal: Signal;
    title: string;
    body: string;
  };
}

const VALID_SIGNALS: ReadonlySet<string> = new Set(['promote', 'remove']);

export async function createPostAction(formData: FormData): Promise<CreatePostResult | void> {
  const rawSignal = formData.get('signal')?.toString();
  const signal: Signal | undefined =
    rawSignal && VALID_SIGNALS.has(rawSignal) ? (rawSignal as Signal) : undefined;

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
    heroImageUrl: formData.get('heroImageUrl')?.toString() || undefined,
    signal,
  };

  const parsed = postCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  let createdPostId: string | null = null;
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    const created = await caller.post.create(parsed.data);
    createdPostId = created.id;
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'UNAUTHORIZED') {
      redirect('/dev/login?returnTo=/compose');
    }
    return {
      errors: { _form: ['Could not create post. Try again.'] },
    };
  }

  revalidatePath('/feed');

  // BU-tick-or-cross: signal is set → return handoff payload so the
  // client opens the SendToNetworkConfirm modal instead of redirecting.
  if (signal && createdPostId) {
    return {
      handoff: {
        postId: createdPostId,
        signal,
        title: parsed.data.title,
        body: parsed.data.body,
      },
    };
  }

  redirect('/feed');
}
