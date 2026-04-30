/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Reusable avatar circle. Renders `avatarUrl` when present, otherwise
 * the user's initials in a calm-tinted circle (colour deterministically
 * derived from `displayName` so the same person always gets the same
 * tint).
 *
 * Sizing is caller-controlled in pixels. D072 §6 calls out three
 * canonical sizes for the review-attribution surfaces:
 *   - 18px — PostCard byline badge
 *   - 22px — Post detail sub-byline
 *   - default 32px — comment avatars and general use
 *
 * The component renders no role/system metadata of its own — wrappers
 * like `<ReviewedByBadge>` add the ring + ✓ overlay. Initials fallback
 * uses first + last name initials, never falls back to a generic icon.
 */

import type { CSSProperties, ReactElement } from 'react';

interface UserAvatarProps {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  /** Diameter in pixels. Defaults to 32. */
  readonly size?: number;
  /** Optional className hook for surrounding wrappers. */
  readonly className?: string;
}

const AVATAR_TINTS: readonly string[] = [
  'var(--colour-primary-bright)',
  'var(--colour-success)',
  'var(--colour-warning)',
  'var(--colour-danger)',
  'var(--colour-cultural)',
  'var(--colour-info)',
  'var(--colour-urgent)',
];

const FALLBACK_TINT = 'var(--colour-primary-bright)';

export function UserAvatar({
  userId,
  displayName,
  avatarUrl,
  size = 32,
  className,
}: UserAvatarProps): ReactElement {
  const initials = getInitials(displayName);
  const tint = pickTint(displayName || userId);
  const fontSize = Math.max(10, Math.round(size * 0.42));

  const baseStyle: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    fontFamily: 'var(--font-ui)',
    lineHeight: 1,
  };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        data-testid="user-avatar"
        data-user-id={userId}
        data-variant="image"
        className={className}
        style={{ ...baseStyle, objectFit: 'cover' }}
      />
    );
  }

  return (
    <span
      data-testid="user-avatar"
      data-user-id={userId}
      data-variant="initials"
      aria-hidden="true"
      className={className}
      style={{
        ...baseStyle,
        background: `color-mix(in srgb, ${tint} 18%, var(--colour-surface-sunken))`,
        color: tint,
        fontSize: `${fontSize}px`,
        fontWeight: 600,
      }}
    >
      {initials}
    </span>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

function pickTint(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_TINTS.length;
  return AVATAR_TINTS[idx] ?? FALLBACK_TINT;
}
