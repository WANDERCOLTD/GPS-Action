'use server';

/**
 * @build-unit BU-composer BU-link-share BU-am-link-collapse BU-post-hero-demo BU-tick-or-cross BU-event-time BU-publish-router
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D060, D064, D069, D072, D073)
 * @spec build/session-briefs/bu-am-link-collapse.md
 * @spec build/session-briefs/bu-post-hero-demo.md
 * @spec build/session-briefs/bu-tick-or-cross.md
 * @spec build/session-briefs/bu-publish-router.md
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Server actions for the compose flow.
 *
 * `createPostAction` (BU-publish-router refactor): always creates the
 * post as a `draft` and returns the post id + a snapshot the client
 * needs to dispatch follow-on lifecycle verbs through
 * `<PostPublishModal>`. It does NOT redirect on success — the modal
 * owns publish / save-as-draft / send-for-review / discard from there.
 * Validation errors are returned in `{ errors }`; an unauthenticated
 * caller redirects to `/dev/login?returnTo=/compose`.
 *
 * BU-event-time / D073: the form submits eventAtDate / eventAtTime /
 * eventEndsAtDate / eventEndsAtTime in Europe/London wall-clock; this
 * action converts them to UTC via shared/format-event-time before
 * passing to postCreateSchema. Empty inputs round-trip as undefined.
 *
 * Lifecycle verb actions (`publishPostAction`,
 * `sendPostForReviewAction`, `saveDraftAction`, `discardPostAction`,
 * `restorePostAction`, `autosaveDraftAction`) wrap the matching tRPC
 * mutations and unwrap typed errors into `{ ok, reason }` so the
 * modal never has to interpret a `TRPCError` directly.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { postCreateSchema } from '@/shared/validation/post';
import { eventInputToUtc } from '@/shared/format-event-time';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { fetchLinkMetadata, type LinkMetadataResult } from '@/server/services/link-metadata';
import { TRPCError } from '@trpc/server';
import type { Signal } from '@prisma/client';

export interface CreatePostResult {
  errors?: Record<string, string[]>;
  /** Set on success — the modal needs the id + body/title/signal to dispatch verbs. */
  draft?: {
    postId: string;
    title: string;
    body: string;
    signal: Signal | null;
    kindSlug: string | null;
  };
}

const VALID_SIGNALS: ReadonlySet<string> = new Set(['promote', 'remove']);

export async function createPostAction(formData: FormData): Promise<CreatePostResult> {
  const rawSignal = formData.get('signal')?.toString();
  const signal: Signal | undefined =
    rawSignal && VALID_SIGNALS.has(rawSignal) ? (rawSignal as Signal) : undefined;
  const kindSlug = formData.get('kindSlug')?.toString() || null;

  // BU-event-time / D073. Composer submits date+time as
  // Europe/London wall-clock; the action converts to UTC here before
  // the Zod schema runs. Empty inputs round-trip to undefined.
  const eventAtDate = formData.get('eventAtDate')?.toString() ?? '';
  const eventAtTime = formData.get('eventAtTime')?.toString() ?? '';
  const eventEndsAtDate = formData.get('eventEndsAtDate')?.toString() ?? '';
  const eventEndsAtTime = formData.get('eventEndsAtTime')?.toString() ?? '';
  const eventAtUtc = eventInputToUtc(eventAtDate || null, eventAtTime || null);
  const eventEndsAtUtc = eventInputToUtc(eventEndsAtDate || null, eventEndsAtTime || null);
  const locationTextRaw = formData.get('locationText')?.toString() ?? '';

  const raw = {
    title: formData.get('title')?.toString() ?? '',
    body: formData.get('body')?.toString() ?? '',
    visibility: formData.get('visibility')?.toString() ?? 'public',
    linkUrl: formData.get('linkUrl')?.toString() || undefined,
    linkTitle: formData.get('linkTitle')?.toString() || undefined,
    linkDescription: formData.get('linkDescription')?.toString() || undefined,
    linkImageUrl: formData.get('linkImageUrl')?.toString() || undefined,
    linkSiteName: formData.get('linkSiteName')?.toString() || undefined,
    // D074 — AM flag posted as the literal "true" / "false" string.
    isActivistMailer: formData.get('isActivistMailer')?.toString() === 'true' ? true : undefined,
    kindId: formData.get('kindId')?.toString() || undefined,
    urgency: formData.get('urgency')?.toString() === 'true' ? true : undefined,
    heroImageUrl: formData.get('heroImageUrl')?.toString() || undefined,
    signal,
    eventAt: eventAtUtc ?? undefined,
    eventEndsAt: eventEndsAtUtc ?? undefined,
    locationText: locationTextRaw.trim() ? locationTextRaw : undefined,
  };

  const parsed = postCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    const created = await caller.post.create(parsed.data);
    return {
      draft: {
        postId: created.id,
        title: parsed.data.title,
        body: parsed.data.body,
        signal: signal ?? null,
        kindSlug,
      },
    };
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'UNAUTHORIZED') {
      redirect('/dev/login?returnTo=/compose');
    }
    console.error('[compose/actions] post.create failed:', err);
    return { errors: { _form: ['Could not create post. Try again.'] } };
  }
}

// ── Lifecycle verbs (BU-publish-router / D072) ───────────────────────────
//
// One thin wrapper per tRPC mutation. Each unwraps the typed result so
// the caller (the publish modal, in a later commit) gets a consistent
// `{ ok, reason }` discriminator and never has to interpret a TRPCError
// directly. Unauthenticated callers redirect to `/dev/login` so the
// modal flow degrades to the same spot as compose. `revalidatePath`
// invalidates the feed and post detail page where state changed.

export type PublishLifecycleReason =
  | 'not_found'
  | 'not_owner'
  | 'in_review'
  | 'discarded'
  | 'already_published'
  | 'already_in_review'
  | 'already_discarded'
  | 'not_discarded'
  | 'no_kind'
  | 'no_fields'
  | 'unknown';

interface ActionFailure {
  ok: false;
  reason: PublishLifecycleReason;
}

function reasonFromError(err: unknown): PublishLifecycleReason {
  if (!(err instanceof TRPCError)) return 'unknown';
  if (err.code === 'NOT_FOUND') return 'not_found';
  if (err.code === 'FORBIDDEN') return 'not_owner';
  if (err.code === 'CONFLICT') return 'in_review';
  if (err.code === 'BAD_REQUEST') {
    const m = err.message;
    if (
      m === 'discarded' ||
      m === 'already_published' ||
      m === 'already_in_review' ||
      m === 'already_discarded' ||
      m === 'not_discarded' ||
      m === 'no_kind' ||
      m === 'no_fields'
    ) {
      return m;
    }
  }
  return 'unknown';
}

async function callerOrRedirect(): Promise<ReturnType<typeof createCaller>> {
  const ctx = await createTRPCContext();
  if (!ctx.user) redirect('/dev/login?returnTo=/feed');
  return createCaller(ctx);
}

export interface PublishPostInput {
  postId: string;
}

export type PublishPostActionResult =
  | { ok: true; postId: string; publishedAt: Date }
  | ActionFailure;

export async function publishPostAction(input: PublishPostInput): Promise<PublishPostActionResult> {
  try {
    const caller = await callerOrRedirect();
    const result = await caller.post.publish({ postId: input.postId });
    revalidatePath('/feed');
    revalidatePath(`/post/${result.postId}`);
    return { ok: true, postId: result.postId, publishedAt: result.publishedAt };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}

export interface SendPostForReviewInput {
  postId: string;
  alsoPublishToFeed: boolean;
}

export type SendPostForReviewActionResult =
  | { ok: true; postId: string; reviewRequestId: string; publishedAt: Date | null }
  | ActionFailure;

export async function sendPostForReviewAction(
  input: SendPostForReviewInput,
): Promise<SendPostForReviewActionResult> {
  try {
    const caller = await callerOrRedirect();
    const result = await caller.post.sendForReview({
      postId: input.postId,
      alsoPublishToFeed: input.alsoPublishToFeed,
    });
    if (input.alsoPublishToFeed) revalidatePath('/feed');
    revalidatePath(`/post/${result.postId}`);
    revalidatePath('/requests');
    return {
      ok: true,
      postId: result.postId,
      reviewRequestId: result.reviewRequestId,
      publishedAt: result.publishedAt,
    };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}

export type SaveDraftActionResult = { ok: true } | ActionFailure;

export async function saveDraftAction(input: { postId: string }): Promise<SaveDraftActionResult> {
  try {
    const caller = await callerOrRedirect();
    await caller.post.saveDraft({ postId: input.postId });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}

export type DiscardPostActionResult = { ok: true; postId: string; deletedAt: Date } | ActionFailure;

export async function discardPostAction(input: {
  postId: string;
}): Promise<DiscardPostActionResult> {
  try {
    const caller = await callerOrRedirect();
    const result = await caller.post.discard({ postId: input.postId });
    revalidatePath('/feed');
    revalidatePath(`/post/${result.postId}`);
    return { ok: true, postId: result.postId, deletedAt: result.deletedAt };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}

export type RestorePostActionResult = { ok: true; postId: string } | ActionFailure;

export async function restorePostAction(input: {
  postId: string;
}): Promise<RestorePostActionResult> {
  try {
    const caller = await callerOrRedirect();
    const result = await caller.post.restore({ postId: input.postId });
    revalidatePath('/feed');
    revalidatePath(`/post/${result.postId}`);
    return { ok: true, postId: result.postId };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}

export interface AutosaveDraftInput {
  postId: string;
  fields: {
    title?: string;
    body?: string;
    visibility?: 'public' | 'authenticated_only';
    linkUrl?: string | null;
    linkTitle?: string | null;
    linkDescription?: string | null;
    linkImageUrl?: string | null;
    linkSiteName?: string | null;
    heroImageUrl?: string | null;
    signal?: 'promote' | 'remove' | null;
    kindId?: string | null;
    urgency?: boolean;
  };
}

export type AutosaveDraftActionResult = { ok: true; updatedAt: Date } | ActionFailure;

export async function autosaveDraftAction(
  input: AutosaveDraftInput,
): Promise<AutosaveDraftActionResult> {
  try {
    const caller = await callerOrRedirect();
    const result = await caller.post.autosaveDraft({
      postId: input.postId,
      fields: input.fields,
    });
    return { ok: true, updatedAt: result.updatedAt };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}

/**
 * Fetch OG/Twitter/HTML metadata for a URL pasted into the link-first
 * compose form. Wraps the pure `fetchLinkMetadata` service.
 *
 * **Auth-gated**: anonymous callers cannot trigger this. The server
 * action otherwise turns the dev server into an open URL fetcher
 * (SSRF: any unauthenticated visitor could ask the server to load
 * arbitrary URLs — including internal services, cloud-metadata
 * endpoints, etc.). Authenticated callers are presumed to be members
 * of the network, raising the bar to "we trust them not to attack."
 *
 * Defence-in-depth: the underlying service also rejects internal /
 * loopback / link-local / RFC1918 hostnames at the URL-parse layer.
 */
export async function fetchLinkMetadataAction(input: { url: string }): Promise<LinkMetadataResult> {
  const ctx = await createTRPCContext();
  if (!ctx.user) {
    return { ok: false, reason: 'unauthorized' };
  }
  return fetchLinkMetadata(input);
}
