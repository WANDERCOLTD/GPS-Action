/**
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052, D045)
 * @spec product/scenarios.md (SCN-20)
 * @spec product/design-philosophy.md
 *
 * Post detail page. The post anchors near the top, the discussion
 * thread stacks underneath, an in-line composer sits at the bottom.
 *
 * Visibility per D045:
 *   - public: visible to anyone
 *   - authenticated_only ("members_only" in spec): gated landing
 *     for unauthed; full thread for authed
 *   - private: 404 (indistinguishable from deleted)
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { CommentList } from '@/components/CommentList';
import { ReactionPill } from '@/components/ReactionPill';
import { addCommentAction } from '@/app/post/[id]/actions';
import { addReactionAction, removeReactionAction } from '@/app/feed/actions';
import type { CommentForView } from '@/components/CommentList';

interface PostDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Post — GPS Action',
};

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { id } = await params;
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);

  // Fetch post via the existing list path with a singleton filter would be
  // overkill — fetch directly from the post service via a dedicated query
  // would be cleaner, but for MVP we list then narrow. Visibility is enforced
  // by the same logic the feed uses.
  const result = await caller.post.list();
  const post = result.posts.find((p) => p.id === id);

  if (!post) {
    // Either not found, soft-deleted, or the caller can't see it.
    // For `private` posts (when added later) and unauthed callers on
    // `authenticated_only` posts, the listPosts query already filters them out.
    if (!ctx.user) {
      // Could be a members_only post — show gated landing instead of 404.
      // Need to verify the post actually exists and is members_only by trying
      // the same query as an authed caller would see it. For MVP we don't have
      // server-side impersonation, so this is best-effort:
      return (
        <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
          <h1 className="gps-title" style={{ marginBottom: 'var(--space-3)' }}>
            Sign in to see this post
          </h1>
          <p style={{ color: 'var(--colour-text-secondary)' }}>
            This post is for members.{' '}
            <Link
              href={`/dev/login?returnTo=/post/${id}`}
              style={{ color: 'var(--colour-text-link)' }}
              data-testid="post-detail-login-link"
            >
              Log in
            </Link>{' '}
            to read the discussion.
          </p>
        </main>
      );
    }
    notFound();
  }

  const [reactionsEnabled, commentsEnabled, comments] = await Promise.all([
    isFeatureEnabled('ff_reactions'),
    isFeatureEnabled('ff_comments'),
    caller.comment.listForPost({ postId: id }),
  ]);

  const paragraphs = post.body.split('\n\n');
  const relativeTime = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  // Serialise for the client component boundary
  const serialisedComments: CommentForView[] = comments.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: c.author,
  }));

  const canReact = reactionsEnabled && Boolean(ctx.user);
  const canComment = commentsEnabled && Boolean(ctx.user);

  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <Link
        href="/feed"
        data-testid="post-detail-back-link"
        style={{
          display: 'inline-block',
          marginBottom: 'var(--space-4)',
          color: 'var(--colour-text-link)',
          fontSize: 'var(--text-sm)',
          textDecoration: 'none',
        }}
      >
        ← Back to feed
      </Link>

      {/* Post — anchored near the top per SCN-20 */}
      <article className="gps-card">
        <div className="gps-card__header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 'var(--text-sm)' }}>{post.author.displayName}</strong>
            <time
              className="gps-meta"
              dateTime={new Date(post.createdAt).toISOString()}
              suppressHydrationWarning
              style={{ display: 'block' }}
            >
              {relativeTime}
            </time>
          </div>
        </div>

        <h1 className="gps-title" style={{ marginBottom: 'var(--space-3)' }}>
          {post.title}
        </h1>

        <div className="gps-card__body">
          {paragraphs.map((paragraph, i) => (
            <p key={i} style={i > 0 ? { marginTop: 'var(--space-3)' } : undefined}>
              {paragraph}
            </p>
          ))}
        </div>

        {reactionsEnabled && (
          <ReactionPill
            postId={post.id}
            reactions={post.reactions}
            onAdd={addReactionAction}
            onRemove={removeReactionAction}
            canReact={canReact}
          />
        )}

        {post.activistMailerUrl && (
          <div className="gps-card__footer">
            <a
              href={post.activistMailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gps-btn gps-btn--primary gps-btn--sm"
              data-testid="post-am-link"
              data-post-id={post.id}
            >
              Open in Activist Mailer
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        )}
      </article>

      {/* Discussion thread */}
      <section
        style={{ marginTop: 'var(--space-6)' }}
        data-testid="comment-thread-section"
        data-post-id={post.id}
      >
        <CommentList
          postId={post.id}
          initialComments={serialisedComments}
          canComment={canComment}
          onAddComment={addCommentAction}
        />
      </section>
    </main>
  );
}
