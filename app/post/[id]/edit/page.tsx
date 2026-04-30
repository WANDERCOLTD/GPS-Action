/**
 * @build-unit BU-event-time
 * @spec architecture/decision-log.md (D073)
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Edit page for an existing Post. Server component — fetches the
 * post, resolves the caller's permissions, and renders <EditPostForm />
 * pre-filled with the current values. The form's server action
 * (updatePostAction) routes through post.update which re-checks
 * permissions service-side.
 *
 * Permissions:
 *  - Author of the post: any field, always.
 *  - Director (admin role): any field, any post.
 *  - Coordinator (queue_manager role): any field, any post (region
 *    scoping is forward-looking — see service-layer comment in
 *    server/services/post.ts).
 *  - Anyone else: redirected to the post detail page.
 *
 * Visibility-not-found posts return notFound(). Soft-deleted posts
 * return notFound() (matches existing list-path semantics).
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { utcToEventInput } from '@/shared/format-event-time';
import { EditPostForm } from '@/components/EditPostForm';
import { updatePostAction } from '@/app/post/[id]/edit/actions';

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Edit post — GPS Action',
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const ctx = await createTRPCContext();

  if (!ctx.user) {
    redirect(`/dev/login?returnTo=/post/${id}/edit`);
  }

  const caller = createCaller(ctx);
  const result = await caller.post.list();
  const post = result.posts.find((p) => p.id === id);

  if (!post) {
    notFound();
  }

  // Permission gate (mirrors the service-layer check; surfaces a
  // friendly redirect rather than a thrown error from the form
  // action). Author always; admin / queue_manager grants any post.
  const isAuthor = post.author.id === ctx.user.id;
  const hasElevatedRole = ctx.activeRoles.some((r) => r === 'admin' || r === 'queue_manager');
  if (!isAuthor && !hasElevatedRole) {
    redirect(`/post/${id}`);
  }

  // BU-event-time / D073. Pre-fill the date+time pickers with the
  // existing event values, formatted as Europe/London wall-clock so
  // the controlled inputs render the same string the user typed.
  const eventStartInput = utcToEventInput(post.eventAt ?? null);
  const eventEndsInput = utcToEventInput(post.eventEndsAt ?? null);
  const initialEventFields = {
    eventAtDate: eventStartInput.date,
    eventAtTime: eventStartInput.time,
    eventEndsAtDate: eventEndsInput.date,
    eventEndsAtTime: eventEndsInput.time,
    locationText: post.locationText ?? '',
  };

  // Bind the postId into the server action so the client form only
  // submits FormData (no extra arg).
  const onSubmit = updatePostAction.bind(null, post.id);

  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <Link
        href={`/post/${id}`}
        data-testid="post-edit-page-back-link"
        style={{
          display: 'inline-block',
          marginBottom: 'var(--space-4)',
          color: 'var(--colour-text-link)',
          fontSize: 'var(--text-sm)',
          textDecoration: 'none',
        }}
      >
        ← Back to post
      </Link>

      <h1
        className="gps-title"
        data-testid="post-edit-page-title"
        style={{ marginBottom: 'var(--space-6)' }}
      >
        Edit post
      </h1>

      <EditPostForm
        post={{
          id: post.id,
          title: post.title,
          body: post.body,
          visibility: post.visibility,
          linkUrl: post.linkUrl,
          linkTitle: post.linkTitle,
          linkDescription: post.linkDescription,
          linkImageUrl: post.linkImageUrl,
          linkSiteName: post.linkSiteName,
          heroImageUrl: post.heroImageUrl,
          kindSlug: post.kindSlug,
          kindDisplayName: post.kindDisplayName,
        }}
        initialEventFields={initialEventFields}
        onSubmit={onSubmit}
      />
    </main>
  );
}
