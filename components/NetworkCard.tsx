'use client';

/**
 * @build-unit BU-network-feed
 * @spec adrs/0017-network-card-state.md
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
 * F14: every actionable element carries a `data-testid` rooted on
 * the messageId for unique selection during tests.
 */

import type { CSSProperties, MouseEvent } from 'react';
import type { NetworkCardStatus, SerializedNetworkCard } from '@/shared/network-card';

interface NetworkCardProps {
  card: SerializedNetworkCard;
  onSetStatus: (status: NetworkCardStatus) => void;
  pending: boolean;
}

export function NetworkCard({ card, onSetStatus, pending }: NetworkCardProps) {
  const title = card.linkTitle ?? hostnameOf(card.url);
  const sender = card.fromName ?? 'anonymous member';
  const isAnon = card.fromName === null;
  // Today the allowlist is GPS Action Network! + a test group; both
  // render generically. When more groups land a label table joins by
  // chat_id (Grant's `gps_chat_labels` view).
  const groupLabel = 'GPS Action Network!';

  return (
    <article
      data-testid="network-card"
      data-message-id={card.messageId}
      data-status={card.state.status}
      data-anon={isAnon ? 'true' : 'false'}
      style={cardStyle}
    >
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
          }}
        >
          {card.textBody}
        </p>
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
