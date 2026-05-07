'use client';

/**
 * @build-unit BU-feed BU-comments BU-feed-card-clamp BU-event-time BU-postcard-share-polish
 * @spec product/design-philosophy.md
 * @spec architecture/decision-log.md (D052, D061, D064, D073)
 * @spec build/session-briefs/bu-feed-card-clamp.md
 * @spec build/session-briefs/bu-postcard-share-polish.md
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Single post card for the feed. Renders author, timestamp, title,
 * body paragraphs, the reaction pill, comment-count link, and an
 * optional Activist Mailer button.
 *
 * Card layout (top → bottom):
 *  1. Byline row (avatar · name · roles · timestamp · share rail on the
 *     right edge)
 *  2. Hero / video / link-preview
 *  3. Body text
 *  4. Dedicated full-width reaction row (BU-postcard-share-polish) —
 *     subtle top border, `var(--space-3)` padding, sits beneath the
 *     body so reactions get full card width instead of being squeezed
 *     into the right rail.
 *
 * Two body-layout variants (orthogonal to the reaction-row placement
 * above, which is the same in both):
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

import type { CSSProperties, FC } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Calendar, MapPin } from 'lucide-react';
import { ReactionPill } from '@/components/ReactionPill';
import { RelativeTime } from '@/components/RelativeTime';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import { PostShareGroup } from '@/components/PostShareGroup';
import { formatEventRange } from '@/shared/format-event-time';
import { ReviewedByBadge } from '@/components/ReviewedByBadge';
import { AvatarBubble, KindChip, SignalBadgeRow, formatRole } from '@/components/post-meta';

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
  /** D075 — flagged-AM bit. Drives the "Send email →" CTA on the link
   * card and surfaces the post under the AM filter on /feed. */
  isActivistMailer: boolean;
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
  /** D074 — per-kind toggle. When false, no comment-peek row beneath the body. */
  feedCommentPeekEnabled: boolean;
  /** D074 — newest non-deleted, non-system comment for the peek row. */
  topComment: {
    authorDisplayName: string;
    excerpt: string;
    createdAt: string;
  } | null;
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

// ── Comment-peek styles (D074 / BU-feed-card-affordances) ──────────────
//
// Single-line peek beneath the body: when there's a top comment, show
// `<Author · excerpt… · 2h →>`; when there isn't, show a gentle empty
// CTA. The peek itself is rendered inline in the card body — kept here
// as a single component to avoid breaking the post-card unit test's
// JSX-tree walker, which doesn't invoke function components.

const peekRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  marginTop: 'var(--space-3)',
  padding: 'var(--space-2) 0',
  borderTop: '1px solid var(--colour-border-subtle)',
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
  textDecoration: 'none',
  minWidth: 0,
};

const excerptStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--colour-text-primary)',
};

export const PostCard: FC<PostCardProps> = ({
  post,
  onAddReaction,
  onRemoveReaction,
  canReact,
  reactionsEnabled,
  variant = 'compact',
}) => {
  const paragraphs = post.body.split('\n\n');
  const detailHref = `/post/${post.id}`;

  // Primary CTA = the AM URL when present, else the linkUrl. D075:
  // `isAmAction` now reads the persisted `post.isActivistMailer` flag
  // instead of host-matching at render time, so a member's manual AM
  // toggle in compose carries through to what the card shows.
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
      isAmAction={post.isActivistMailer}
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
            <AvatarBubble displayName={post.author.displayName} />
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
              <RelativeTime date={post.createdAt} className="gps-meta" />
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

          {/* D074 — comment peek row. Renders only when a top comment
              exists so the row stays honest content (a real reply
              excerpt) rather than a generic empty CTA. BU-one-click-
              polish removed the "Be the first to respond →" empty state:
              the post detail page now exposes an always-rendered comment
              input on the empty-thread path, so an extra empty-state
              hint on the feed card was redundant. The card itself, the
              title, and the thumbnail all already nav to detail. */}
          {variant === 'compact' && post.feedCommentPeekEnabled && post.topComment && (
            <Link
              href={`${detailHref}#comments`}
              data-testid="post-card-comment-peek"
              data-post-id={post.id}
              style={peekRowStyle}
            >
              <MessageSquare size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
              <strong style={{ flexShrink: 0 }}>{post.topComment.authorDisplayName}</strong>
              <span aria-hidden="true" style={{ opacity: 0.6, flexShrink: 0 }}>
                ·
              </span>
              <span style={excerptStyle}>{post.topComment.excerpt}</span>
              <span aria-hidden="true" style={{ opacity: 0.6, flexShrink: 0 }}>
                · {formatDistanceToNow(new Date(post.topComment.createdAt), { addSuffix: false })} →
              </span>
            </Link>
          )}

          {/* Secondary linkUrl card (legacy edge case: both AM + link populated).
          Stays at the bottom as supporting context per D060 §3. */}
          {secondaryCta}
        </div>

        {/* Right rail — outbound shares only (WhatsApp + socials).
            BU-postcard-share-polish: reactions moved to a dedicated
            full-width row below the card body (see end of this article).
            The rail anchors flush against the card's right inner edge:
            the parent is a flex row, so `margin-left: auto` pushes the
            rail past any leftover gap, and `align-self: flex-start`
            keeps it pinned to the top of the row even when the byline
            content grows taller (e.g. wraps roles onto a second line).
            Mobile collision: the byline content wrapper has
            `flex: 1, minWidth: 0` so its text wraps before crowding
            the 32px-wide rail — no need to shrink the rail icons. */}
        <aside
          data-testid="post-card-rail"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexShrink: 0,
            alignSelf: 'flex-start',
            marginLeft: 'auto',
          }}
        >
          <PostShareGroup
            postId={post.id}
            postTitle={post.title}
            postBody={post.body}
            variant="card-rail"
          />

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

      {/* BU-postcard-share-polish — dedicated full-width reaction row,
          separated from the body by a subtle top border. The reaction
          pill itself stays horizontal (post-#166); we only moved its
          container out of the right rail so it can use full card width
          and breathe. CommentItem and the post-detail page keep their
          original placement. */}
      {reactionsEnabled && (
        <div
          data-testid="feed-card-reaction-cluster"
          style={{
            marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-3)',
            paddingBottom: 'var(--space-3)',
            borderTop: '1px solid var(--colour-border-subtle)',
            width: '100%',
          }}
        >
          <ReactionPill
            reactions={post.reactions}
            onAdd={(emoji) => onAddReaction(post.id, emoji)}
            onRemove={(emoji) => onRemoveReaction(post.id, emoji)}
            canReact={canReact}
          />
        </div>
      )}
    </article>
  );
};
