/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * The compact "reviewed by" badge surfaced wherever a post has
 * `reviewedByUserId` set (PostCard byline, post detail sub-byline).
 * Wraps `<UserAvatar />` with a 1.5px ring to distinguish it from a
 * regular avatar at a glance, plus a 6px ✓ overlay bottom-right.
 *
 * Tap → scrolls to the auto-comment in the thread (anchor id
 * `post-${postId}-review-comment`) so the badge, sub-byline, and
 * pinned comment all anchor to the same conceptual link.
 */

import type { CSSProperties, ReactElement } from 'react';
import { UserAvatar } from '@/components/UserAvatar';

interface ReviewedByBadgeProps {
  readonly postId: string;
  readonly reviewerId: string;
  readonly reviewerDisplayName: string;
  readonly reviewerAvatarUrl?: string | null;
  /** Diameter in pixels. D072 §6 calls out 18 (PostCard) and 22 (detail). */
  readonly size?: number;
  /** When true, paints the small ✓ overlay; default true. */
  readonly showCheckmark?: boolean;
}

const RING_TINT = 'color-mix(in srgb, var(--colour-text-secondary) 50%, transparent)';

export function ReviewedByBadge({
  postId,
  reviewerId,
  reviewerDisplayName,
  reviewerAvatarUrl,
  size = 18,
  showCheckmark = true,
}: ReviewedByBadgeProps): ReactElement {
  const tooltip = `Reviewed by ${reviewerDisplayName}`;
  const ringWidth = 1.5;
  const innerSize = size - ringWidth * 2;
  const checkSize = Math.max(8, Math.round(size * 0.4));

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    border: `${ringWidth}px solid ${RING_TINT}`,
    boxSizing: 'border-box',
    flexShrink: 0,
    textDecoration: 'none',
    color: 'inherit',
  };

  const checkStyle: CSSProperties = {
    position: 'absolute',
    bottom: '-2px',
    right: '-2px',
    width: `${checkSize}px`,
    height: `${checkSize}px`,
    borderRadius: '50%',
    background: 'var(--colour-success)',
    color: 'var(--colour-surface-raised)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${Math.max(6, Math.round(checkSize * 0.7))}px`,
    fontWeight: 700,
    lineHeight: 1,
    border: '1px solid var(--colour-surface-raised)',
  };

  return (
    <a
      href={`#post-${postId}-review-comment`}
      data-testid="post-reviewed-by-badge"
      data-post-id={postId}
      data-reviewer-id={reviewerId}
      title={tooltip}
      aria-label={tooltip}
      style={wrapperStyle}
    >
      <UserAvatar
        userId={reviewerId}
        displayName={reviewerDisplayName}
        avatarUrl={reviewerAvatarUrl}
        size={innerSize}
      />
      {showCheckmark ? (
        <span aria-hidden="true" data-testid="post-reviewed-by-badge-check" style={checkStyle}>
          ✓
        </span>
      ) : null}
    </a>
  );
}
