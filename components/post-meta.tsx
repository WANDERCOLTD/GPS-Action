/**
 * @build-unit BU-feed-card-affordances
 * @spec build/session-briefs/bu-feed-card-affordances.md
 *
 * Shared post-meta primitives — kind chip, signal badge row, avatar
 * bubble, role formatting. Extracted from PostCard so the post-detail
 * page can use the same visual treatment without duplicating the
 * tinted-pill palette, signal-row layout, or avatar-colour hash.
 *
 * Pure presentational pieces — no fetching, no hooks, no client/server
 * boundary requirements. Detail page (RSC) and PostCard (client)
 * both import freely.
 */

import type { CSSProperties, FC, ReactElement } from 'react';

// ── Kind chip palette ───────────────────────────────────────────────────
//
// One chip per PostKind, present in card / detail bylines (Reddit-flair
// pattern). `link_share`, `thought`, `tick_or_cross` get neutral tints
// so the chip is informational without competing with their own
// existing visual signals (link card, ✅/❌ glyph).

interface KindChipPalette {
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
}

export const KIND_CHIPS: Record<string, KindChipPalette> = {
  happening_now: {
    label: 'Happening now',
    bg: 'var(--colour-urgent-subtle)',
    fg: 'var(--colour-urgent)',
  },
  cultural: {
    label: 'Cultural',
    bg: 'var(--colour-cultural-subtle)',
    fg: 'var(--colour-cultural)',
  },
  call_to_action: {
    label: 'Call to action',
    bg: 'var(--colour-primary-subtle)',
    fg: 'var(--colour-primary)',
  },
  outcome: {
    label: 'Outcome',
    bg: 'var(--colour-success-subtle)',
    fg: 'var(--colour-success)',
  },
  event: {
    label: 'Event',
    bg: 'var(--colour-info-subtle)',
    fg: 'var(--colour-info)',
  },
  meeting: {
    label: 'Meeting',
    bg: 'var(--colour-info-subtle)',
    fg: 'var(--colour-info)',
  },
  link_share: {
    label: 'Link',
    bg: 'var(--colour-surface-sunken)',
    fg: 'var(--colour-text-secondary)',
  },
  thought: {
    label: 'Thought',
    bg: 'var(--colour-surface-sunken)',
    fg: 'var(--colour-text-secondary)',
  },
  tick_or_cross: {
    label: 'Network ask',
    bg: 'var(--colour-surface-sunken)',
    fg: 'var(--colour-text-secondary)',
  },
};

interface KindChipProps {
  readonly kindSlug: string | null;
  readonly urgency: boolean;
}

/**
 * Inline kind chip + optional `Alert` chip (for D062 urgency=true).
 * Sits beside the title; both are upper-case 2xs labels.
 */
export const KindChip: FC<KindChipProps> = ({ kindSlug, urgency }) => {
  const chip = kindSlug ? KIND_CHIPS[kindSlug] : null;
  if (!urgency && !chip) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 'var(--space-1)',
        marginRight: 'var(--space-2)',
        verticalAlign: 'middle',
      }}
    >
      {urgency && (
        <span
          data-testid="post-urgent-chip"
          style={{
            display: 'inline-block',
            padding: '2px var(--space-2)',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--colour-urgent)',
            color: 'var(--colour-urgent-contrast)',
            fontSize: 'var(--text-2xs)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
          }}
        >
          Alert
        </span>
      )}
      {chip && kindSlug && (
        <span
          data-testid="post-kind-chip"
          data-kind={kindSlug}
          style={{
            display: 'inline-block',
            padding: '2px var(--space-2)',
            borderRadius: 'var(--radius-pill)',
            background: chip.bg,
            color: chip.fg,
            fontSize: 'var(--text-2xs)',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
          }}
        >
          {chip.label}
        </span>
      )}
    </span>
  );
};

// ── Signal badge row (BU-tick-or-cross / D069) ──────────────────────────

interface SignalBadgeRowProps {
  readonly signal: 'promote' | 'remove';
  readonly sharedToNetworkAt: string | null;
}

/**
 * ✅/❌ badge plus optional "Sent to GPS Network" pill. Rendered above
 * the title for tick_or_cross posts in card / detail.
 */
export const SignalBadgeRow: FC<SignalBadgeRowProps> = ({ signal, sharedToNetworkAt }) => {
  const glyph = signal === 'promote' ? '✅' : '❌';
  return (
    <div
      data-testid="post-card-signal-row"
      data-signal={signal}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-2)',
        flexWrap: 'wrap',
      }}
    >
      <span
        data-testid="post-card-signal-badge"
        aria-label={signal === 'promote' ? 'Amplify' : 'Flag'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px var(--space-2)',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--colour-surface-sunken)',
          color: 'var(--colour-text-primary)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          border: '1px solid var(--colour-border-subtle)',
        }}
      >
        {glyph}
      </span>
      {sharedToNetworkAt && (
        <span
          data-testid="post-card-sent-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px var(--space-2)',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--colour-info-subtle)',
            color: 'var(--colour-text-primary)',
            fontSize: 'var(--text-2xs)',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          Sent to GPS Network
        </span>
      )}
    </div>
  );
};

// ── Avatar bubble + helpers ─────────────────────────────────────────────

const AVATAR_COLOURS = [
  'var(--colour-primary-bright)', // blue
  'var(--colour-success)', // green
  'var(--colour-warning)', // amber
  'var(--colour-danger)', // red
  'var(--colour-cultural)', // bordeaux
  'var(--colour-info)', // indigo
  'var(--colour-urgent)', // orange
];

export function getAvatarColour(name: string): string {
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

export function getInitials(name: string): string {
  const parts = name.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function formatRole(role: string): string {
  return role
    .split('_')
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

interface AvatarBubbleProps {
  readonly displayName: string;
  /** Optional explicit size; defaults to the gps-avatar token. */
  readonly style?: CSSProperties;
}

/**
 * Coloured initials bubble — hash of the name picks one of seven brand
 * tints. Use for byline avatars in card and detail.
 */
export function AvatarBubble({ displayName, style }: AvatarBubbleProps): ReactElement {
  return (
    <span
      className="gps-avatar"
      style={{ background: getAvatarColour(displayName), ...style }}
      aria-hidden="true"
    >
      {getInitials(displayName)}
    </span>
  );
}
