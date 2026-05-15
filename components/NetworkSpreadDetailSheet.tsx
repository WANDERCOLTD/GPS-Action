/**
 * @build-unit BU-network-spread-gallery
 * @spec build/session-briefs/bu-network-spread-gallery.md
 *
 * Client component. Full-screen drawer that opens on tile-tap.
 * Shows OG image hero + title + spread-trace timeline (every
 * occurrence of the URL in the window, with source-chip + time +
 * forwarded flag).
 *
 * Closes via overlay click or Escape key.
 */

'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { getSourceColor } from '@/shared/styles/source-palette';
import { SourceBadge } from '@/components/SourceBadge';
import { PostShareGroup, spreadTileToShareable } from '@/components/PostShareGroup';
import type { SpreadOccurrence, SpreadTile } from '@/shared/network-spread';

interface NetworkSpreadDetailSheetProps {
  tile: SpreadTile;
  onClose: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--colour-surface-overlay)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 100,
};

const sheetStyle: CSSProperties = {
  background: 'var(--colour-surface-raised)',
  width: '100%',
  maxWidth: 520,
  maxHeight: '92vh',
  overflowY: 'auto',
  borderRadius: '16px 16px 0 0',
  paddingBottom: 'var(--space-5)',
};

const grabber: CSSProperties = {
  width: 38,
  height: 4,
  background: 'var(--colour-border-subtle)',
  borderRadius: 2,
  margin: '8px auto 4px',
};

const heroStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 9',
  objectFit: 'cover',
  display: 'block',
};

const heroFallback: CSSProperties = {
  ...heroStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--colour-surface-sunken)',
  color: 'var(--colour-text-secondary)',
  fontSize: 'var(--text-sm)',
};

const bodyStyle: CSSProperties = { padding: '16px 18px 0' };

const titleStyle: CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  lineHeight: 1.3,
  margin: '4px 0 6px',
};

const domainStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
  marginBottom: 'var(--space-4)',
};

const sectionLabel: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '16px 0 10px',
};

const traceStep: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  gap: 10,
  alignItems: 'center',
  padding: '8px 0',
};

const timeStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
  fontVariantNumeric: 'tabular-nums',
};

const gapStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-tertiary)',
  padding: '2px 0 2px 32px',
};

const ctaRow: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  margin: '20px 18px 0',
};

const btnBase: CSSProperties = {
  flex: 1,
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--colour-border-subtle)',
  background: 'var(--colour-surface-raised)',
  fontSize: 'var(--text-base)',
  fontWeight: 500,
  textAlign: 'center',
  textDecoration: 'none',
  color: 'var(--colour-text-primary)',
  cursor: 'pointer',
};

const btnPrimary: CSSProperties = {
  ...btnBase,
  background: 'var(--colour-primary)',
  color: 'var(--colour-primary-contrast)',
  borderColor: 'var(--colour-primary)',
};

function formatGap(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `↓ ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin > 0 ? `↓ ${hours}h ${remMin}m` : `↓ ${hours}h`;
  const days = Math.floor(hours / 24);
  return `↓ ${days}d`;
}

function formatTime(d: Date): string {
  return d.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });
}

function domainOf(url: string): string {
  try {
    const h = new URL(url).hostname;
    return h.startsWith('www.') ? h.slice(4) : h;
  } catch {
    return url;
  }
}

// Quote block max-lines before "Show more" appears.
const QUOTE_CLAMP_LINES = 4;

const quoteWrapStyle = (color: string): CSSProperties => ({
  margin: '6px 0 8px 32px',
  padding: '8px 12px',
  borderLeft: `3px solid ${color}`,
  background: 'var(--colour-surface-sunken)',
  borderRadius: '0 var(--radius-md) var(--radius-md) 0',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.45,
  color: 'var(--colour-text-primary)',
});

const quoteTextStyle = (expanded: boolean): CSSProperties => ({
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  display: '-webkit-box',
  WebkitLineClamp: expanded ? 'unset' : QUOTE_CLAMP_LINES,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

const showMoreButtonStyle: CSSProperties = {
  marginTop: 4,
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-primary)',
  cursor: 'pointer',
  textDecoration: 'underline',
};

function QuoteBlock({ text, color }: { text: string; color: string }) {
  const [expanded, setExpanded] = useState(false);
  // Heuristic: only show the toggle when the text is genuinely long.
  // Counting lines client-side without measurement is unreliable;
  // approximate via character + newline count.
  const looksLong = text.length > 200 || text.split('\n').length > QUOTE_CLAMP_LINES;
  return (
    <div style={quoteWrapStyle(color)} data-testid="network-spread-detail-quote">
      <div style={quoteTextStyle(expanded)}>{text}</div>
      {looksLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={showMoreButtonStyle}
          data-testid="network-spread-detail-quote-toggle"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function TraceRow({ occurrence, isFirst }: { occurrence: SpreadOccurrence; isFirst: boolean }) {
  const color = getSourceColor(occurrence.source);
  return (
    <div>
      <div style={traceStep}>
        <SourceBadge
          source={occurrence.source}
          iconOverride={occurrence.source.iconOverride ?? null}
          variant="micro"
          showLabel={false}
        />
        <div style={{ fontSize: 'var(--text-sm)' }}>
          <strong>{occurrence.source.label}</strong>
          <div style={{ color: 'var(--colour-text-secondary)', fontSize: 'var(--text-xs)' }}>
            {occurrence.fromName ?? 'Unknown sender'} ·{' '}
            {isFirst ? 'original' : occurrence.isForwarded ? 'forwarded' : 'reposted'}
          </div>
        </div>
        <div style={timeStyle}>{formatTime(occurrence.sentAt)}</div>
      </div>
      {occurrence.textBody && <QuoteBlock text={occurrence.textBody} color={color} />}
    </div>
  );
}

export function NetworkSpreadDetailSheet({ tile, onClose }: NetworkSpreadDetailSheetProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sortedOccurrences = tile.occurrences;
  const totalSpread = sortedOccurrences.length;
  const distinctGroups = tile.distinctSourceCount;

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Spread trace"
      data-testid="network-spread-detail-sheet"
    >
      <div style={sheetStyle}>
        <div style={grabber} aria-hidden="true" />
        {tile.imageUrl ? (
          <img src={tile.imageUrl} alt="" style={heroStyle} referrerPolicy="no-referrer" />
        ) : (
          <div style={heroFallback}>{domainOf(tile.url)}</div>
        )}

        <div style={bodyStyle}>
          <div style={titleStyle}>{tile.title ?? domainOf(tile.url)}</div>
          <div style={domainStyle}>{domainOf(tile.url)}</div>

          <div style={sectionLabel}>
            Spread trace · shared {totalSpread} {totalSpread === 1 ? 'time' : 'times'} into{' '}
            {distinctGroups} {distinctGroups === 1 ? 'group' : 'groups'}
          </div>

          {sortedOccurrences.map((occurrence, idx) => (
            <div key={String(occurrence.messageId)}>
              <TraceRow occurrence={occurrence} isFirst={idx === 0} />
              {idx < sortedOccurrences.length - 1 && (
                <div style={gapStyle}>
                  {formatGap(
                    sortedOccurrences[idx + 1]!.sentAt.getTime() - occurrence.sentAt.getTime(),
                  )}
                </div>
              )}
            </div>
          ))}

          {/*
            bu-spread-polish-responsive: share strip sits between the
            spread-trace timeline and the Open-link CTA — same vertical
            slot as the share-bar on a Post detail. Uses the
            generalised PostShareGroup with a `link-preview` source;
            analytics for gallery shares is a follow-up BU (just
            buttons at v1 per the brief).
          */}
          <div
            style={{
              marginTop: 'var(--space-4)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--colour-border-subtle)',
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <PostShareGroup
              shareable={spreadTileToShareable({
                url: tile.url,
                title: tile.title,
                normalizedUrl: tile.normalizedUrl,
              })}
              variant="detail-bar"
            />
          </div>
        </div>

        <div style={ctaRow}>
          <button
            type="button"
            style={btnBase}
            onClick={onClose}
            data-testid="network-spread-detail-close"
          >
            Close
          </button>
          <a
            href={tile.url}
            target="_blank"
            rel="noopener noreferrer"
            style={btnPrimary}
            data-testid="network-spread-detail-open-link"
          >
            Open link →
          </a>
        </div>
      </div>
    </div>
  );
}
