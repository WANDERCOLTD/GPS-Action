'use client';

/**
 * @build-unit BU-feed BU-comments
 * @spec product/design-philosophy.md
 * @spec architecture/decision-log.md (D052)
 *
 * Single post card for the feed. Renders author, timestamp, title,
 * body paragraphs, the reaction pill, comment-count link, and an
 * optional Activist Mailer button.
 *
 * Tap-card-to-detail navigates to /post/[id] (BU-comments / D052).
 * The article's onClick checks `event.target.closest('a, button')`
 * and bails if the click landed on an interactive child — this is
 * cleaner than wrapping in <Link> (which would require nested
 * anchors / aggressive stopPropagation across the reaction pill).
 */

import type { FC, MouseEvent as ReactMouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { ReactionPill } from '@/components/ReactionPill';

// ── Types (shared with FeedList and feed page) ──────────────────────────

export type FeedReactionEmoji =
  | 'candle'
  | 'pray'
  | 'heart'
  | 'strong'
  | 'target'
  | 'sparkle'
  | 'thumbsup'
  | 'sad';

export interface FeedReaction {
  emoji: FeedReactionEmoji;
  count: number;
  mine: boolean;
}

export interface FeedPost {
  id: string;
  title: string;
  body: string;
  activistMailerUrl: string | null;
  createdAt: string; // ISO 8601
  author: {
    displayName: string;
    roles: string[];
  };
  reactions: FeedReaction[];
  /** Per BU-comments / D052 — non-deleted count. */
  commentCount: number;
}

export interface FeedCursor {
  createdAt: string; // ISO 8601
  id: string;
}

// ── Utilities ────────────────────────────────────────────────────────────

const AVATAR_COLOURS = [
  'var(--colour-primary-bright)', // blue
  'var(--colour-success)', // green
  'var(--colour-warning)', // amber
  'var(--colour-danger)', // red
  'var(--colour-cultural)', // bordeaux
  'var(--colour-info)', // indigo
  'var(--colour-urgent)', // orange
];

function getAvatarColour(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return (
    AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length] ??
    AVATAR_COLOURS[0] ??
    'var(--colour-primary-bright)'
  );
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function formatRole(role: string): string {
  return role
    .split('_')
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

// ── Component ────────────────────────────────────────────────────────────

interface PostCardProps {
  post: FeedPost;
  /** Server actions injected by the page (server component). */
  onAddReaction: (postId: string, emoji: FeedReactionEmoji) => Promise<void>;
  onRemoveReaction: (postId: string, emoji: FeedReactionEmoji) => Promise<void>;
  /** True when ff_reactions is on AND the caller is authenticated. */
  canReact: boolean;
  /** True when ff_reactions is on (whether or not caller is authed). */
  reactionsEnabled: boolean;
}

export const PostCard: FC<PostCardProps> = ({
  post,
  onAddReaction,
  onRemoveReaction,
  canReact,
  reactionsEnabled,
}) => {
  const router = useRouter();
  const paragraphs = post.body.split('\n\n');
  const relativeTime = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });

  function handleCardClick(event: ReactMouseEvent<HTMLElement>): void {
    // Bail if the click landed on an interactive child (anchor, button,
    // input, label, form, etc.) — the child handles its own action.
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input, label, form, textarea')) return;
    router.push(`/post/${post.id}`);
  }

  return (
    <article
      className="gps-card"
      onClick={handleCardClick}
      role="link"
      aria-label={`Open post: ${post.title}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if ((e.target as HTMLElement).closest('a, button, input, label, form, textarea')) return;
          e.preventDefault();
          router.push(`/post/${post.id}`);
        }
      }}
      data-testid="post-card-article"
      data-post-id={post.id}
      style={{ cursor: 'pointer' }}
    >
      {/* Header: avatar · name · role chip · timestamp */}
      <div className="gps-card__header">
        <span
          className="gps-avatar"
          style={{ background: getAvatarColour(post.author.displayName) }}
          aria-hidden="true"
        >
          {getInitials(post.author.displayName)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gps-row gps-row--tight" style={{ flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 'var(--text-sm)' }}>{post.author.displayName}</strong>
            {post.author.roles.map((role) => (
              <span key={role} className="gps-chip gps-chip--static gps-chip--info">
                {formatRole(role)}
              </span>
            ))}
          </div>
          <time className="gps-meta" dateTime={post.createdAt} suppressHydrationWarning>
            {relativeTime}
          </time>
        </div>
      </div>

      {/* Title */}
      <h2 className="gps-subtitle" style={{ marginBottom: 'var(--space-2)' }}>
        {post.title}
      </h2>

      {/* Body — \n\n split into <p> tags */}
      <div className="gps-card__body">
        {paragraphs.map((paragraph, i) => (
          <p key={i} style={i > 0 ? { marginTop: 'var(--space-3)' } : undefined}>
            {paragraph}
          </p>
        ))}
      </div>

      {/* Reaction pill (BU-reactions / D050) */}
      {reactionsEnabled && (
        <ReactionPill
          reactions={post.reactions}
          onAdd={(emoji) => onAddReaction(post.id, emoji)}
          onRemove={(emoji) => onRemoveReaction(post.id, emoji)}
          canReact={canReact}
        />
      )}

      {/* Comment count (BU-comments / D052) */}
      {post.commentCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
          }}
          data-testid="post-card-comment-count"
          data-post-id={post.id}
        >
          <MessageSquare size={14} aria-hidden="true" />
          <span>
            {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
          </span>
        </div>
      )}

      {/* Activist Mailer button */}
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
  );
};
