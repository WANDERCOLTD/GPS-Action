/**
 * @build-unit BU-network-spread-gallery
 * @spec build/session-briefs/bu-network-spread-gallery.md
 *
 * Single tile in the spread gallery. Square crop via
 * `aspect-ratio: 1/1` + `object-fit: cover`. Two overlays:
 *   - Bottom-left: micro source-chip (coloured dot + emoji, no label).
 *     Sourced from `firstSeenSource` (first-seen group).
 *   - Top-right: `×N` badge — only when `occurrenceCount >= 2`.
 *
 * Tiles without a cached OG image fall back to a domain-coloured
 * card with the og:title (or domain) as visible text — per the
 * brief's "render with fallback, don't filter out" decision.
 *
 * Click handler is wired by the parent grid (opens detail sheet).
 */

'use client';

import type { CSSProperties } from 'react';
import { getSourceColor } from '@/shared/styles/source-palette';
import type { SpreadTile } from '@/shared/network-spread';

interface NetworkSpreadTileProps {
  tile: SpreadTile;
  onSelect: (tile: SpreadTile) => void;
}

const tileBase: CSSProperties = {
  position: 'relative',
  aspectRatio: '1 / 1',
  overflow: 'hidden',
  background: 'var(--colour-surface-sunken)',
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  display: 'block',
  width: '100%',
};

const imgStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const noOgStyle = (bg: string): CSSProperties => ({
  ...tileBase,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-2)',
  textAlign: 'center',
  color: 'var(--colour-text-inverse)',
  background: bg,
  fontSize: 'var(--text-xs)',
  lineHeight: 1.3,
});

const srcChipStyle = (bg: string): CSSProperties => ({
  position: 'absolute',
  bottom: 6,
  left: 6,
  width: 22,
  height: 22,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  lineHeight: 1,
  background: bg,
  color: 'var(--colour-text-inverse)',
  boxShadow: 'var(--shadow-sm)',
});

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  background: 'var(--colour-surface-overlay)',
  color: 'var(--colour-text-inverse)',
  fontSize: 11,
  fontWeight: 600,
  padding: '3px 7px',
  borderRadius: 'var(--radius-pill)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
};

function domainOf(url: string): string {
  try {
    const h = new URL(url).hostname;
    return h.startsWith('www.') ? h.slice(4) : h;
  } catch {
    return url;
  }
}

export function NetworkSpreadTile({ tile, onSelect }: NetworkSpreadTileProps) {
  const sourceColor = getSourceColor(tile.firstSeenSource);
  const showBadge = tile.occurrenceCount >= 2;
  const hasImage = Boolean(tile.imageUrl);

  return (
    <button
      type="button"
      style={hasImage ? tileBase : noOgStyle(sourceColor)}
      onClick={() => onSelect(tile)}
      data-testid="network-spread-tile"
      data-occurrence-count={tile.occurrenceCount}
      aria-label={`${tile.title ?? domainOf(tile.url)} — shared into ${tile.distinctSourceCount} ${tile.distinctSourceCount === 1 ? 'group' : 'groups'}`}
    >
      {hasImage ? (
        <img
          src={tile.imageUrl ?? ''}
          alt=""
          style={imgStyle}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>
          <strong style={{ display: 'block', fontSize: 'var(--text-sm)' }}>
            {domainOf(tile.url)}
          </strong>
          <span style={{ display: 'block', marginTop: 4, opacity: 0.9 }}>{tile.title ?? '—'}</span>
        </span>
      )}

      <span style={srcChipStyle(sourceColor)} aria-hidden="true" title={tile.firstSeenSource.label}>
        {tile.firstSeenSource.icon ?? '•'}
      </span>

      {showBadge && (
        <span style={badgeStyle} data-testid="network-spread-tile-badge">
          ×{tile.occurrenceCount}
        </span>
      )}
    </button>
  );
}
