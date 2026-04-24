/**
 * @build-unit BU-feed
 * @spec product/design-philosophy.md
 *
 * Single post card for the feed. Renders author, timestamp, title,
 * body paragraphs, and an optional Activist Mailer button.
 *
 * Not a client component — works in both server and client contexts.
 * When imported by a client component (FeedList), React bundles it
 * for the client automatically.
 */

import type { FC } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';

// ── Types (shared with FeedList and feed page) ──────────────────────────

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
}

export interface FeedCursor {
  createdAt: string; // ISO 8601
  id: string;
}

// ── Utilities ────────────────────────────────────────────────────────────

const AVATAR_COLOURS = [
  '#4577e8', // blue
  '#0f6e56', // green
  '#ba7517', // amber
  '#a32d2d', // red
  '#6b3045', // bordeaux
  '#3c3489', // indigo
  '#d85a30', // orange
];

function getAvatarColour(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length] ?? AVATAR_COLOURS[0] ?? '#4577e8';
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
}

export const PostCard: FC<PostCardProps> = ({ post }) => {
  const paragraphs = post.body.split('\n\n');
  const relativeTime = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });

  return (
    <article className="gps-card">
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

      {/* Activist Mailer button */}
      {post.activistMailerUrl && (
        <div className="gps-card__footer">
          <a
            href={post.activistMailerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="gps-btn gps-btn--primary gps-btn--sm"
          >
            Open in Activist Mailer
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      )}
    </article>
  );
};
