'use client';

/**
 * @build-unit BU-feed BU-comments BU-feed-card-clamp BU-event-time
 * @spec product/design-philosophy.md
 * @spec architecture/decision-log.md (D052, D061, D064, D073)
 * @spec build/session-briefs/bu-feed-card-clamp.md
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Single post card for the feed. Renders author, timestamp, title,
 * body paragraphs, the reaction pill, comment-count link, and an
 * optional Activist Mailer button.
 *
 * Two layouts:
 *  - `full`    — original render: full-width 16:9 hero above title,
 *                body paragraphs unclamped. Used on the detail page
 *                and anywhere a long-form read is the goal.
 *  - `compact` — `/feed` default. Body clamped to 3 lines via
 *                `-webkit-line-clamp`; hero shrinks to a 96×96 right
 *                thumbnail next to the body (Reddit-card / Medium
 *                pattern). Honours D061: tap-anywhere navs to detail
 *                where the full body is shown — no inline expand.
 *
 * Tap-card-to-detail navigates to /post/[id] (BU-comments / D052).
 * The article's onClick checks `event.target.closest('a, button')`
 * and bails if the click landed on an interactive child — this is
 * cleaner than wrapping in <Link> (which would require nested
 * anchors / aggressive stopPropagation across the reaction pill).
 *
 * BU-event-time / D073: when `eventAt` is set, an absolute date+time
 * row renders above the title, with `locationText` (if present) on
 * the line below. Range support — when `eventEndsAt` is also set,
 * the row formats as "Sat 3 May · 6–8pm" (single-day) or
 * "Sat 3 May 6pm – Sun 4 May 9am" (multi-day). All formatting routes
 * through shared/format-event-time.ts so the timezone discipline
 * (UTC storage, Europe/London render) stays in one place.
 */

import type { FC, MouseEvent as ReactMouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Calendar, MapPin } from 'lucide-react';
import { ReactionPill } from '@/components/ReactionPill';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import { PostShareGroup } from '@/components/PostShareGroup';
import { formatEventRange } from '@/shared/format-event-time';

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
  /** Link-share preview card data (BU-link-share / D060). */
  linkUrl: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  linkImageUrl: string | null;
  linkSiteName: string | null;
  /** Intent kind (BU-fab-intent-picker / D062 revised — FK + display fields). */
  kindSlug: string | null;
  kindDisplayName: string | null;
  /** Alert flag (D062 revised, orthogonal to kind). */
  urgency: boolean;
  /** Member-picked hero image URL (BU-post-hero-demo / D064). Hero
   * wins over linkImageUrl for the top-of-card slot when both exist. */
  heroImageUrl: string | null;
  /** Amplify (✅) / flag (❌) choice for tick_or_cross posts (BU-tick-or-cross / D069). */
  signal: 'promote' | 'remove' | null;
  /** ISO timestamp set when the author confirmed the WhatsApp paste landed. */
  sharedToNetworkAt: string | null;
  /** Structured event-time fields (BU-event-time / D073). All ISO 8601 / null. */
  eventAt: string | null;
  eventEndsAt: string | null;
  locationText: string | null;
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

// ── KindChip (BU-fab-intent-picker / D062) ───────────────────────────────

const KIND_CHIPS: Record<string, { label: string; bg: string; fg: string }> = {
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
};

// BU-tick-or-cross / D069. Calm badge — the glyph alone carries the
// meaning. Both ✅ and ❌ get the same visual treatment per the brief's
// tone rules: no red on the flag side, no anxiety amplification. When
// the author has confirmed the WhatsApp paste, a "Sent to GPS Network"
// pill renders next to the glyph. Both children are inline-flex so they
// sit on a single line without overflowing narrow cards.
function SignalBadgeRow({
  signal,
  sharedToNetworkAt,
}: {
  signal: 'promote' | 'remove';
  sharedToNetworkAt: string | null;
}) {
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
}

function KindChip({ kindSlug, urgency }: { kindSlug: string | null; urgency: boolean }) {
  // Alert flag chip (D062 revised — orthogonal). Renders ahead of the kind
  // chip so urgency is the first thing the eye catches.
  const alertChip = urgency ? (
    <span
      data-testid="post-urgent-chip"
      style={{
        display: 'inline-block',
        marginRight: 'var(--space-2)',
        marginBottom: 'var(--space-2)',
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
  ) : null;

  if (!kindSlug) return alertChip;
  const chip = KIND_CHIPS[kindSlug];
  if (!chip) return alertChip;
  return (
    <div style={{ marginBottom: 'var(--space-1)' }}>
      {alertChip}
      <span
        data-testid="post-kind-chip"
        data-kind={kindSlug}
        style={{
          display: 'inline-block',
          marginBottom: 'var(--space-1)',
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
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────

export type PostCardVariant = 'full' | 'compact';

interface PostCardProps {
  post: FeedPost;
  /** Server actions injected by the page (server component). */
  onAddReaction: (postId: string, emoji: FeedReactionEmoji) => Promise<void>;
  onRemoveReaction: (postId: string, emoji: FeedReactionEmoji) => Promise<void>;
  /** True when ff_reactions is on AND the caller is authenticated. */
  canReact: boolean;
  /** True when ff_reactions is on (whether or not caller is authed). */
  reactionsEnabled: boolean;
  /**
   * BU-feed-card-clamp / RT-001. `compact` (the feed default) clamps the
   * body to 3 lines and shrinks the hero to a 96×96 right thumbnail.
   * `full` keeps the unclamped, hero-on-top layout — used by detail
   * pages and previews that need the long read.
   */
  variant?: PostCardVariant;
}

export const PostCard: FC<PostCardProps> = ({
  post,
  onAddReaction,
  onRemoveReaction,
  canReact,
  reactionsEnabled,
  variant = 'compact',
}) => {
  const router = useRouter();
  const paragraphs = post.body.split('\n\n');
  const relativeTime = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });

  // Primary CTA = the AM URL when present, else the linkUrl. Renders as the
  // top-of-card visual, just below the header (D060 §3 puts AM first when both
  // are set; D066 generalises this to a primary/secondary Action[] model).
  // Secondary CTA = the linkUrl, but only when an AM URL is also set; the
  // legacy "both populated" path keeps its supporting-context slot at the bottom.
  const primaryCta = post.activistMailerUrl ? (
    <LinkPreviewCard
      linkUrl={post.activistMailerUrl}
      linkTitle={null}
      linkDescription={null}
      linkImageUrl={null}
      linkSiteName={null}
      size="small"
      isAmAction={true}
    />
  ) : post.linkUrl ? (
    <LinkPreviewCard
      linkUrl={post.linkUrl}
      linkTitle={post.linkTitle}
      linkDescription={post.linkDescription}
      linkImageUrl={post.linkImageUrl}
      linkSiteName={post.linkSiteName}
      size="small"
    />
  ) : null;

  const secondaryCta =
    post.activistMailerUrl && post.linkUrl ? (
      <LinkPreviewCard
        linkUrl={post.linkUrl}
        linkTitle={post.linkTitle}
        linkDescription={post.linkDescription}
        linkImageUrl={post.linkImageUrl}
        linkSiteName={post.linkSiteName}
        size="small"
      />
    ) : null;

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
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
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

          {/* Primary CTA — moved to top of content (just under header) so the
          action sits above the title. D060 §3a / D066-proposed direction. */}
          {primaryCta}

          {/* Kind chip (BU-fab-intent-picker / D062) — only for kinds that warrant a visual badge */}
          <KindChip kindSlug={post.kindSlug} urgency={post.urgency} />

          {/* BU-tick-or-cross / D069 — amplify/flag glyph + sent-pill row */}
          {post.signal && (
            <SignalBadgeRow signal={post.signal} sharedToNetworkAt={post.sharedToNetworkAt} />
          )}

          {/* BU-event-time / D073 — absolute event date+time, above the title.
          Renders only when eventAt is set (which the composer only
          surfaces for time-bearing kinds — meeting / event /
          happening_now per shared/post-kinds.ts kindIsTimeBearing).
          Inlined (not a child component) so the test walker finds
          the root testid without a custom React renderer. */}
          {post.eventAt && (
            <div
              data-testid="post-card-event-time"
              data-event-at={post.eventAt}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                marginTop: 'var(--space-1)',
                marginBottom: 'var(--space-2)',
              }}
            >
              <div
                data-testid="post-card-event-time-row"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--colour-info)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <Calendar size={14} aria-hidden="true" />
                <time dateTime={post.eventAt} suppressHydrationWarning>
                  {formatEventRange(
                    new Date(post.eventAt),
                    post.eventEndsAt ? new Date(post.eventEndsAt) : null,
                  )}
                </time>
              </div>
              {post.locationText && post.locationText.trim() !== '' && (
                <div
                  data-testid="post-card-event-location"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--colour-text-secondary)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <MapPin size={12} aria-hidden="true" />
                  <span>{post.locationText}</span>
                </div>
              )}
            </div>
          )}

          {/* Hero image — `full` only (BU-post-hero-demo / D064). In `compact`
          the hero shrinks to a 96×96 right thumbnail rendered next to the
          body, below. */}
          {variant === 'full' && post.heroImageUrl && (
            <img
              src={post.heroImageUrl}
              alt=""
              loading="lazy"
              data-testid="post-card-hero-image"
              style={{
                display: 'block',
                width: '100%',
                aspectRatio: '16 / 9',
                objectFit: 'cover',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-3)',
              }}
            />
          )}

          {/* Title */}
          <h2 className="gps-subtitle" style={{ marginBottom: 'var(--space-2)' }}>
            {post.title}
          </h2>

          {/* Body — `full` keeps the \n\n paragraph split; `compact` collapses
          paragraphs into a single string so `-webkit-line-clamp` can span
          the whole body and renders the optional 96×96 hero thumbnail to
          the right of the clamped text. */}
          {variant === 'compact' ? (
            <div
              data-testid="post-card-body"
              data-variant="compact"
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-2)',
              }}
            >
              <div
                className="gps-card__body"
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {post.body.replace(/\n\n+/g, ' ')}
              </div>
              {post.heroImageUrl && (
                <img
                  src={post.heroImageUrl}
                  alt=""
                  loading="lazy"
                  data-testid="post-card-thumb"
                  style={{
                    flex: '0 0 96px',
                    width: 96,
                    height: 96,
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              )}
            </div>
          ) : (
            <div className="gps-card__body" data-testid="post-card-body" data-variant="full">
              {paragraphs.map((paragraph, i) => (
                <p key={i} style={i > 0 ? { marginTop: 'var(--space-3)' } : undefined}>
                  {paragraph}
                </p>
              ))}
            </div>
          )}

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

          {/* Secondary linkUrl card (legacy edge case: both AM + link populated).
          Stays at the bottom as supporting context per D060 §3. */}
          {secondaryCta}
        </div>

        {/* Right rail of share affordances — WhatsApp (lead) + socials.
        Mirrors the detail page's horizontal share-bar but in vertical card form. */}
        <PostShareGroup
          postId={post.id}
          postTitle={post.title}
          postBody={post.body}
          variant="card-rail"
        />
      </div>
    </article>
  );
};
