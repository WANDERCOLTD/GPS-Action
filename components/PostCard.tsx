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

import type { FC } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Calendar, MapPin } from 'lucide-react';
import { ReactionPill } from '@/components/ReactionPill';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import { PostShareGroup } from '@/components/PostShareGroup';
import { formatEventRange } from '@/shared/format-event-time';
import { ReviewedByBadge } from '@/components/ReviewedByBadge';
import { ArrowLink } from '@/components/ArrowLink';

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
  /** D072 — id of the reviewer who verdicted this post via kind_review. */
  reviewedByUserId: string | null;
  /** D072 — reviewer profile snapshot for the byline badge. */
  reviewedBy: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
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

// ── KindChip (BU-fab-intent-picker / D062 + BU-feed-card-affordances) ────
//
// One chip per kind, present on every feed card (Reddit-flair pattern).
// `link_share`, `thought`, `tick_or_cross` get neutral tints so the
// chip is informational without competing with their own existing
// visual signals (link card, ✅/❌ glyph).

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

// Reddit-flair pattern: chip sits inline beside the title rather than
// in its own row. `Alert` is orthogonal (D062) — when urgency is on,
// it leads, with the kind chip after.
function KindChip({ kindSlug, urgency }: { kindSlug: string | null; urgency: boolean }) {
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
  const paragraphs = post.body.split('\n\n');
  const relativeTime = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });
  const detailHref = `/post/${post.id}`;

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

  return (
    <article className="gps-card" data-testid="post-card-article" data-post-id={post.id}>
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
                {post.reviewedBy && (
                  <ReviewedByBadge
                    postId={post.id}
                    reviewerId={post.reviewedBy.id}
                    reviewerDisplayName={post.reviewedBy.displayName}
                    reviewerAvatarUrl={post.reviewedBy.avatarUrl}
                    size={18}
                  />
                )}
              </div>
              <time className="gps-meta" dateTime={post.createdAt} suppressHydrationWarning>
                {relativeTime}
              </time>
            </div>
          </div>

          {/* Primary CTA — moved to top of content (just under header) so the
          action sits above the title. D060 §3a / D066-proposed direction. */}
          {primaryCta}

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
            <Link
              href={detailHref}
              data-testid="feed-card-hero-link"
              style={{ display: 'block', marginBottom: 'var(--space-3)' }}
            >
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
                }}
              />
            </Link>
          )}

          {/* Title — kind chip sits inline (Reddit-flair pattern) so the
          eye registers category and headline together. The whole line is
          a real <Link> so iOS taps fire natively (the bug this BU fixes). */}
          <h2 className="gps-subtitle" style={{ marginBottom: 'var(--space-2)' }}>
            <KindChip kindSlug={post.kindSlug} urgency={post.urgency} />
            <Link
              href={detailHref}
              data-testid="feed-card-title-link"
              style={{
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              {post.title}
            </Link>
          </h2>

          {/* Body — `full` keeps the \n\n paragraph split; `compact` collapses
          paragraphs into a single string so `-webkit-line-clamp` can span
          the whole body and renders the optional 96×96 hero thumbnail to
          the right of the clamped text. The thumbnail also wraps the
          detail link so members who instinctively tap thumbnails get a
          third reliable tap target. */}
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
                <Link
                  href={detailHref}
                  data-testid="feed-card-thumb-link"
                  style={{ flex: '0 0 96px', display: 'block' }}
                >
                  <img
                    src={post.heroImageUrl}
                    alt=""
                    loading="lazy"
                    data-testid="post-card-thumb"
                    style={{
                      width: 96,
                      height: 96,
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-md)',
                    }}
                  />
                </Link>
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

          {/* "Read post →" — the visible affordance the user instinctively
          looks for. Right-justified so the eye can find it after scanning
          the body. The whole-card click behaviour is gone; this is the
          contract. */}
          {variant === 'compact' && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 'var(--space-2)',
              }}
            >
              <ArrowLink
                href={detailHref}
                direction="forward"
                size="sm"
                testIdArea="feed"
                testIdSuffix="read-post"
              >
                Read post
              </ArrowLink>
            </div>
          )}

          {/* Secondary linkUrl card (legacy edge case: both AM + link populated).
          Stays at the bottom as supporting context per D060 §3. */}
          {secondaryCta}
        </div>

        {/* Right rail. Two clusters:
            - outbound shares (WhatsApp + socials) at the top
            - inbound interactions (reactions + comments) below a divider
            The whole bottom row is gone — engagement actions live in the
            rail (TikTok-pattern) so the body has more vertical space. */}
        <aside
          data-testid="post-card-rail"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexShrink: 0,
          }}
        >
          <PostShareGroup
            postId={post.id}
            postTitle={post.title}
            postBody={post.body}
            variant="card-rail"
          />

          {(reactionsEnabled || post.commentCount > 0) && (
            <div
              aria-hidden="true"
              style={{
                width: '60%',
                height: 1,
                background: 'var(--colour-border-subtle)',
                margin: 'var(--space-1) 0',
              }}
            />
          )}

          {reactionsEnabled && (
            <div data-testid="feed-card-reaction-cluster">
              <ReactionPill
                reactions={post.reactions}
                onAdd={(emoji) => onAddReaction(post.id, emoji)}
                onRemove={(emoji) => onRemoveReaction(post.id, emoji)}
                canReact={canReact}
              />
            </div>
          )}

          {post.commentCount > 0 && (
            <Link
              href={`${detailHref}#comments`}
              data-testid="post-card-comment-count"
              data-post-id={post.id}
              aria-label={`${post.commentCount} ${post.commentCount === 1 ? 'comment' : 'comments'}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                color: 'var(--colour-text-secondary)',
                textDecoration: 'none',
                fontSize: 'var(--text-xs)',
                lineHeight: 1.1,
              }}
            >
              <MessageSquare size={18} aria-hidden="true" />
              <span>{post.commentCount}</span>
            </Link>
          )}
        </aside>
      </div>
    </article>
  );
};
