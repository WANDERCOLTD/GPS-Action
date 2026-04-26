/**
 * @build-unit BU-comments BU-reactions
 * @spec architecture/decision-log.md (D052)
 * @spec product/scenarios.md (SCN-20)
 *
 * Single comment render. Author display name + role chips +
 * "new member" chip + body (paragraph-split) + relative timestamp
 * + reaction pill below body (when reactions enabled).
 *
 * No edit / delete UI in MVP per D052.
 */

import type { FC } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { SystemRole } from '@prisma/client';
import type { FeedReaction, FeedReactionEmoji } from '@/components/PostCard';
import { ReactionPill } from '@/components/ReactionPill';

export interface CommentForView {
  id: string;
  body: string;
  createdAt: string; // ISO 8601
  author: {
    id: string;
    displayName: string;
    roles: SystemRole[];
    isNewMember: boolean;
  };
  reactions: FeedReaction[];
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
}

export const CommentItem: FC<CommentItemProps> = ({
  comment,
  reactionsEnabled,
  canReact,
  onAddReaction,
  onRemoveReaction,
}) => {
  const paragraphs = comment.body.split('\n\n');
  const relativeTime = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  return (
    <article
      data-testid="comment-item"
      data-comment-id={comment.id}
      style={{
        padding: 'var(--space-3) 0',
        borderBottom: '1px solid var(--colour-border-subtle)',
      }}
    >
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
        <time
          className="gps-meta"
          dateTime={comment.createdAt}
          suppressHydrationWarning
          style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)' }}
        >
          {relativeTime}
        </time>
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--colour-text-primary)' }}>
        {paragraphs.map((paragraph, i) => (
          <p key={i} style={i > 0 ? { marginTop: 'var(--space-2)' } : undefined}>
            {paragraph}
          </p>
        ))}
      </div>
      {reactionsEnabled && (
        <ReactionPill
          reactions={comment.reactions}
          onAdd={(emoji) => onAddReaction(comment.id, emoji)}
          onRemove={(emoji) => onRemoveReaction(comment.id, emoji)}
          canReact={canReact}
        />
      )}
    </article>
  );
};
