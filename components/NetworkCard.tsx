'use client';

/**
 * @build-unit BU-network-feed BU-network-reactions bu-network-shares
 * @spec adrs/0017-network-card-state.md
 * @spec adrs/0018-share-event-polymorphic.md
 * @spec build/session-briefs/bu-network-shares.md
 * @spec product/design-philosophy.md
 *
 * Single card on /network. One row from Grant (AIFA)'s WhatsApp-link
 * pipe joined with our local NetworkCardState. Click target is the
 * external URL (new tab); triage controls live in a small footer row.
 *
 * Anonymous members (`fromName === null`, ~70% of senders are
 * `@lid`-only) render as "anonymous member" + a small senderHash hint
 * the parent uses to visually cluster cards from the same sender.
 *
 * Triage controls: NEW / TRIAGED / PROMOTED / DISCARDED. The parent
 * passes `onSetStatus`; this component is presentational + dispatch.
 * The `pending` flag on each button reflects an in-flight mutation
 * for that card so duplicate clicks are idempotent.
 *
 * BU-network-reactions — the same 8-emoji ReactionPill that lives on
 * /feed mounts here between the meta row and the link-preview block.
 * Reactions are optional props; when `onAddReaction` is omitted the
 * pill is suppressed (keeps prior tests / non-reactions callers
 * working). The pill component is polymorphic by callback wrap.
 *
 * bu-network-shares — share rail (X / IG / FB) plus a separate WhatsApp
 * button sit between the link preview and the triage row. The share
 * URL is the upstream `card.url` (Telegraph article etc.), NOT a GPS
 * page — Sharon's followers want to read the article directly. Verified
 * share count pill renders to the left of the social rail. On every
 * tap, the parent's `onShareInitiated` opens the verify dialog when
 * focus returns to GPS Action.
 *
 * F14: every actionable element carries a `data-testid` rooted on
 * the messageId for unique selection during tests.
 */

import type { CSSProperties, MouseEvent } from 'react';
import type { ShareDestination } from '@prisma/client';
import type { NetworkCardStatus, SerializedNetworkCard } from '@/shared/network-card';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import { ReactionPill } from '@/components/ReactionPill';
import { ShareCountPill } from '@/components/ShareCountPill';
import { ShareGroup } from '@/components/ShareGroup';
import { WhatsAppShareTargetButton } from '@/components/WhatsAppShareTargetButton';
import { fallbackTitleFromUrl } from '@/shared/share/share-urls';
import type { FeedReaction, FeedReactionEmoji } from '@/components/PostCard';

interface NetworkCardProps {
  card: SerializedNetworkCard;
  onSetStatus: (status: NetworkCardStatus) => void;
  pending: boolean;
  /** BU-network-reactions — aggregate reactions on this card. */
  reactions?: FeedReaction[];
  /** BU-network-reactions — toggle on. Omit to hide the pill entirely. */
  onAddReaction?: (emoji: FeedReactionEmoji) => Promise<void>;
  /** BU-network-reactions — toggle off. Required when onAddReaction set. */
  onRemoveReaction?: (emoji: FeedReactionEmoji) => Promise<void>;
  /** BU-network-reactions — false hides the pill (logged-out callers, flag off). */
  canReact?: boolean;
  /**
   * bu-network-shares — fires after a share-button tap (intent ping
   * already sent). Parent owns the verify-prompt dialog state. Omit
   * to silently skip the verify flow (counter still accrues intents
   * but no verification prompt appears).
   */
  onShareInitiated?: (messageId: string, destination: ShareDestination) => void;
}

export function NetworkCard({
  card,
  onSetStatus,
  pending,
  reactions,
  onAddReaction,
  onRemoveReaction,
  canReact = true,
  onShareInitiated,
}: NetworkCardProps) {
  const title = card.linkTitle ?? hostnameOf(card.url);
  const sender = card.fromName ?? 'anonymous member';
  const isAnon = card.fromName === null;
  // Today the allowlist is GPS Action Network! + a test group; both
  // render generically. When more groups land a label table joins by
  // chat_id (Grant's `gps_chat_labels` view).
  const groupLabel = 'GPS Action Network!';

  // When a link preview is available, the LinkPreviewCard becomes the
  // primary clickable surface (hero + title + description + CTA). The
  // text title link above is suppressed to avoid double-linking the
  // same URL. Without a preview, fall back to the original plain title.
  const hasPreview = card.linkPreview !== null;

  // The title shown in the share text. Prefer the OG preview title
  // (best signal), fall back to the message's link_title from
  // Grant's pipe, then to the hostname (per brief's open question:
  // "lean: hostname of url").
  const shareTitle = card.linkPreview?.title ?? card.linkTitle ?? fallbackTitleFromUrl(card.url);

  const handleShareInitiated = (destination: ShareDestination): void => {
    if (onShareInitiated) onShareInitiated(card.messageId, destination);
  };

  return (
    <article
      data-testid="network-card"
      data-message-id={card.messageId}
      data-status={card.state.status}
      data-anon={isAnon ? 'true' : 'false'}
      data-has-preview={hasPreview ? 'true' : 'false'}
      style={cardStyle}
    >
      {!hasPreview && (
        <header style={{ marginBottom: 'var(--space-2)' }}>
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="network-card-link"
            data-message-id={card.messageId}
            style={titleLinkStyle}
          >
            {title}
          </a>
        </header>
      )}

      <p style={metaRowStyle}>
        <span data-testid="network-card-sender" data-message-id={card.messageId}>
          {sender}
        </span>
        <span aria-hidden="true">·</span>
        <span data-testid="network-card-group" data-message-id={card.messageId}>
          {groupLabel}
        </span>
        <span aria-hidden="true">·</span>
        <time
          dateTime={card.sentAt}
          data-testid="network-card-time"
          data-message-id={card.messageId}
          title={card.sentAt}
        >
          {relativeTime(card.sentAt)}
        </time>
      </p>

      {/* Layout shell — LHS holds the content (hero/body/reactions/triage),
       *  RHS holds the share column. ≥720px = side-by-side, <720px =
       *  single column with the share column collapsing to a horizontal
       *  rail below the body. Classes defined in styles/components.css. */}
      <div className="gps-network-card-layout">
        <div className="gps-network-card-main">
          {card.linkPreview && (
            <div
              data-testid="network-card-preview"
              data-message-id={card.messageId}
              style={{ marginBottom: 'var(--space-3)' }}
            >
              <LinkPreviewCard
                linkUrl={card.url}
                linkTitle={card.linkPreview.title}
                linkDescription={card.linkPreview.description}
                linkImageUrl={card.linkPreview.imageUrl}
                linkSiteName={card.linkPreview.siteName}
                linkFaviconUrl={card.linkPreview.faviconUrl}
                // X / Twitter posts surface the user's avatar as og:image,
                // which renders as an oversized hero at the large size.
                // Drop to the compact 96×96 thumbnail for those hosts so
                // the avatar reads as a thumbnail rather than the card's
                // hero (bu-network-unfurl-fixes).
                size={isXLikeUrl(card.url) ? 'small' : 'large'}
              />
            </div>
          )}

          {card.textBody && (
            <p
              data-testid="network-card-body"
              data-message-id={card.messageId}
              style={{
                margin: 0,
                marginBottom: 'var(--space-3)',
                color: 'var(--colour-text-primary)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--line-normal)',
                whiteSpace: 'pre-wrap',
                // Long URLs pasted into the message body (e.g. Facebook
                // post permalinks) have no whitespace to break on and
                // overflow the card's right edge. `anywhere` breaks
                // mid-token so the URL stays inside the card. Safe for
                // ordinary prose — only kicks in when a token wouldn't
                // otherwise fit.
                overflowWrap: 'anywhere',
              }}
            >
              {card.textBody}
            </p>
          )}

          {/* Reactions sit directly above the triage row — the closing
           *  sentiment beat before the coordinator action row. */}
          {onAddReaction && onRemoveReaction && (
            <div
              data-testid="network-card-reactions"
              data-message-id={card.messageId}
              style={reactionRowStyle}
            >
              <ReactionPill
                reactions={reactions ?? []}
                onAdd={onAddReaction}
                onRemove={onRemoveReaction}
                canReact={canReact}
                testIdSuffix={card.messageId}
              />
            </div>
          )}

          <footer style={triageRowStyle}>
            <button
              type="button"
              data-testid="network-card-triage-triaged"
              data-message-id={card.messageId}
              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                if (pending) return;
                onSetStatus('TRIAGED');
              }}
              disabled={pending}
              style={triageButtonStyle(card.state.status === 'TRIAGED')}
            >
              Triaged
            </button>
            <button
              type="button"
              data-testid="network-card-triage-promoted"
              data-message-id={card.messageId}
              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                if (pending) return;
                onSetStatus('PROMOTED');
              }}
              disabled={pending}
              style={triageButtonStyle(card.state.status === 'PROMOTED')}
            >
              Promoted
            </button>
            <button
              type="button"
              data-testid="network-card-triage-discarded"
              data-message-id={card.messageId}
              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                if (pending) return;
                onSetStatus('DISCARDED');
              }}
              disabled={pending}
              style={triageButtonStyle(card.state.status === 'DISCARDED')}
            >
              Discarded
            </button>
            {card.state.status !== 'NEW' && (
              <button
                type="button"
                data-testid="network-card-triage-reset"
                data-message-id={card.messageId}
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  if (pending) return;
                  onSetStatus('NEW');
                }}
                disabled={pending}
                style={resetButtonStyle}
              >
                Reset
              </button>
            )}
          </footer>
        </div>

        {/* RHS share column — counter (top), WhatsApp (most-used after
         *  counter), then X / IG / FB. On <720px viewports, the CSS
         *  class flips to flex-direction: row so the same items render
         *  horizontally below the main content. The hideCounter flag
         *  on ShareGroup lets us hoist the counter outside the group
         *  so WhatsApp can slot between it and the social-icon rail. */}
        <div
          data-testid="network-card-share-column"
          data-message-id={card.messageId}
          className="gps-network-card-share-column"
        >
          {card.shareCounts && (
            <ShareCountPill counts={card.shareCounts} targetId={card.messageId} />
          )}
          <WhatsAppShareTargetButton
            url={card.url}
            title={shareTitle}
            targetType="network_card"
            targetId={card.messageId}
            onShareInitiated={() => handleShareInitiated('whatsapp')}
          />
          <ShareGroup
            url={card.url}
            title={shareTitle}
            targetType="network_card"
            targetId={card.messageId}
            counts={card.shareCounts}
            hideCounter
            onShareInitiated={handleShareInitiated}
          />
        </div>
      </div>
    </article>
  );
}

// ── Styling (inline, tokens-only — palette refresh in flight) ─────────────

const cardStyle: CSSProperties = {
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4) var(--space-5)',
  marginBottom: 'var(--space-3)',
  fontFamily: 'var(--font-ui)',
};

const titleLinkStyle: CSSProperties = {
  color: 'var(--colour-text-link)',
  textDecoration: 'none',
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--weight-semibold)',
  lineHeight: 'var(--line-tight)',
  display: 'inline-block',
};

const metaRowStyle: CSSProperties = {
  margin: 0,
  marginBottom: 'var(--space-3)',
  color: 'var(--colour-text-tertiary)',
  fontSize: 'var(--text-sm)',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
  alignItems: 'baseline',
};

const triageRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
  marginTop: 'var(--space-2)',
};

// BU-network-reactions — small breathing room between the meta row and
// the link-preview hero. The pill renders its own internal padding.
const reactionRowStyle: CSSProperties = {
  marginBottom: 'var(--space-3)',
};

function triageButtonStyle(active: boolean): CSSProperties {
  return {
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid var(--colour-border-subtle)',
    background: active ? 'var(--colour-surface-sunken)' : 'transparent',
    color: 'var(--colour-text-primary)',
    fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-normal)',
    cursor: 'pointer',
    minHeight: 32,
  };
}

const resetButtonStyle: CSSProperties = {
  ...triageButtonStyle(false),
  color: 'var(--colour-text-tertiary)',
  borderStyle: 'dashed',
};

// ── Display helpers ────────────────────────────────────────────────────────

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * X / Twitter URLs return the user's avatar as `og:image`, which is
 * close to square and ~400px — rendering it as a 16:9 hero blows it
 * up. We drop those cards to the small (96×96 thumbnail) variant so
 * the avatar reads as a thumbnail. Covers `x.com`, `twitter.com`,
 * and the `mobile.` subdomain variants. (`www.` is stripped first.)
 */
function isXLikeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com';
  } catch {
    return false;
  }
}

function relativeTime(iso: string): string {
  const sentAt = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - sentAt;
  if (Number.isNaN(diffMs)) return '';
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}
