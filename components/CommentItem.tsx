/**
 * @build-unit BU-comments BU-reactions BU-publish-router BU-comments-card-lift
 * @spec architecture/decision-log.md (D052, D072)
 * @spec product/scenarios.md (SCN-20)
 *
 * Single comment render. Card-style article (raised surface, subtle
 * border, padded) with the author's avatar on the left and the
 * byline + body + reactions stacked on the right — same idiom as
 * PostCard so the discussion thread reads as a thread of mini-cards
 * rather than a flat list. Byline carries the display name + role
 * chips + "new member" chip + relative timestamp.
 *
 * D072 — when `systemKind === 'post_review_attribution'` the comment
 * renders with a system-author treatment: the reviewer's avatar IS
 * the comment avatar (closes the badge↔comment loop), the body is
 * single-line and italicised, the article anchors at
 * `post-${postId}-review-comment` so the byline badge can scroll to
 * it. Author cannot delete (UI-side rule); admin can.
 *
 * No edit / delete UI in MVP per D052.
 */

import type { FC } from 'react';
import type { CommentSystemKind, SystemRole } from '@prisma/client';
import type { FeedReaction, FeedReactionEmoji } from '@/components/PostCard';
import { ReactionPill } from '@/components/ReactionPill';
import { RelativeTime } from '@/components/RelativeTime';
import { UserAvatar } from '@/components/UserAvatar';

export interface CommentForView {
  id: string;
  body: string;
  createdAt: string; // ISO 8601
  author: {
    id: string;
    displayName: string;
    roles: SystemRole[];
    isNewMember: boolean;
    avatarUrl: string | null;
  };
  reactions: FeedReaction[];
  /** D072 — non-null marks the comment as system-authored. */
  systemKind: CommentSystemKind | null;
}

function formatRole(role: string): string {
  return role
    .split('_')
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

interface CommentItemProps {
  comment: CommentForView;
  reactionsEnabled: boolean;
  canReact: boolean;
  onAddReaction: (commentId: string, emoji: FeedReactionEmoji) => Promise<void>;
  onRemoveReaction: (commentId: string, emoji: FeedReactionEmoji) => Promise<void>;
  /** Required for the system-comment anchor id when systemKind is set. */
  postId?: string;
}

export const CommentItem: FC<CommentItemProps> = ({
  comment,
  reactionsEnabled,
  canReact,
  onAddReaction,
  onRemoveReaction,
  postId,
}) => {
  const isReviewAttribution = comment.systemKind === 'post_review_attribution';
  if (isReviewAttribution) {
    return <ReviewAttributionComment comment={comment} postId={postId} />;
  }

  const paragraphs = comment.body.split('\n\n');

  return (
    <article
      id={`comment-${comment.id}`}
      data-testid="comment-item"
      data-comment-id={comment.id}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-2)',
        background: 'var(--colour-surface-raised)',
        border: '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <UserAvatar
        userId={comment.author.id}
        displayName={comment.author.displayName}
        avatarUrl={comment.author.avatarUrl}
        size={36}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="gps-row gps-row--tight"
          style={{ flexWrap: 'wrap', marginBottom: 'var(--space-1)' }}
        >
          <strong style={{ fontSize: 'var(--text-sm)' }}>{comment.author.displayName}</strong>
          {comment.author.roles.map((role) => (
            <span key={role} className="gps-chip gps-chip--static gps-chip--info">
              {formatRole(role)}
            </span>
          ))}
          {comment.author.isNewMember && (
            <span className="gps-chip gps-chip--static" style={{ opacity: 0.85 }}>
              new member
            </span>
          )}
          <RelativeTime
            date={comment.createdAt}
            className="gps-meta"
            style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)' }}
          />
        </div>
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--colour-text-primary)' }}>
          {paragraphs.map((paragraph, i) => (
            <p key={i} style={i > 0 ? { marginTop: 'var(--space-2)' } : undefined}>
              {paragraph}
            </p>
          ))}
        </div>
        {reactionsEnabled && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <ReactionPill
              reactions={comment.reactions}
              onAdd={(emoji) => onAddReaction(comment.id, emoji)}
              onRemove={(emoji) => onRemoveReaction(comment.id, emoji)}
              canReact={canReact}
            />
          </div>
        )}
      </div>
    </article>
  );
};

interface ReviewAttributionCommentProps {
  comment: CommentForView;
  postId?: string;
}

function ReviewAttributionComment({ comment, postId }: ReviewAttributionCommentProps) {
  const anchorId = postId ? `post-${postId}-review-comment` : undefined;
  return (
    <article
      id={anchorId}
      data-testid="comment-system-review-attribution"
      data-comment-id={comment.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        background:
          'color-mix(in srgb, var(--colour-text-secondary) 6%, var(--colour-surface-raised))',
        borderLeft: '3px solid var(--colour-success)',
      }}
    >
      <UserAvatar
        userId={comment.author.id}
        displayName={comment.author.displayName}
        avatarUrl={comment.author.avatarUrl}
        size={28}
      />
      <span
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--colour-text-secondary)',
          fontStyle: 'italic',
        }}
      >
        {comment.body}
      </span>
    </article>
  );
}
