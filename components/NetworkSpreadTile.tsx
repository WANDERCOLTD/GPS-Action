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
import type { NetworkCardSource } from '@/shared/network-card';
import type { SpreadTile } from '@/shared/network-spread';

interface NetworkSpreadTileProps {
  tile: SpreadTile;
  onSelect: (tile: SpreadTile) => void;
}

/** Cap on visible source markers per tile. More → "+N" overflow chip. */
const MAX_VISIBLE_SOURCE_MARKERS = 3;

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

/** Container for the multi-source marker stack at bottom-left. */
const markerStackStyle: CSSProperties = {
  position: 'absolute',
  bottom: 6,
  left: 6,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  flexWrap: 'nowrap',
};

/**
 * Mini picker-style pill. Matches the source-chip strip's visual
 * shorthand — colored dot + emoji on a raised surface — without the
 * label (no room on a tile). One pill per distinct source.
 */
const markerPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '2px 5px',
  background: 'var(--colour-surface-raised)',
  borderRadius: 'var(--radius-pill)',
  boxShadow: 'var(--shadow-sm)',
  fontSize: 11,
  lineHeight: 1,
};

const markerDotStyle = (bg: string): CSSProperties => ({
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: bg,
  display: 'inline-block',
  flexShrink: 0,
});

const markerEmojiStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1,
  opacity: 0.85,
};

/** "+N" overflow pill, same shape as a marker pill but text-only. */
const overflowPillStyle: CSSProperties = {
  ...markerPillStyle,
  fontWeight: 600,
  color: 'var(--colour-text-secondary)',
  padding: '2px 6px',
};

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

/**
 * Distinct sources for a tile, sorted by `displayOrder` (the same
 * order the picker chip strip uses). Deduped by slug — multiple
 * occurrences from the same chat collapse to one marker.
 */
function distinctSourcesByOrder(tile: SpreadTile): NetworkCardSource[] {
  const seen = new Map<string, NetworkCardSource>();
  for (const o of tile.occurrences) {
    if (!seen.has(o.source.slug)) seen.set(o.source.slug, o.source);
  }
  return Array.from(seen.values()).sort(
    (a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label),
  );
}

export function NetworkSpreadTile({ tile, onSelect }: NetworkSpreadTileProps) {
  const firstSeenColor = getSourceColor(tile.firstSeenSource);
  const showBadge = tile.occurrenceCount >= 2;
  const hasImage = Boolean(tile.imageUrl);

  const sources = distinctSourcesByOrder(tile);
  const visible = sources.slice(0, MAX_VISIBLE_SOURCE_MARKERS);
  const overflow = Math.max(0, sources.length - visible.length);

  return (
    <button
      type="button"
      style={hasImage ? tileBase : noOgStyle(firstSeenColor)}
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

      <span
        style={markerStackStyle}
        aria-label={`Shared into ${sources.length} ${sources.length === 1 ? 'group' : 'groups'}: ${sources.map((s) => s.label).join(', ')}`}
        data-testid="network-spread-tile-markers"
      >
        {visible.map((source) => (
          <span
            key={source.slug}
            style={markerPillStyle}
            title={source.label}
            data-source-slug={source.slug}
          >
            <span aria-hidden="true" style={markerDotStyle(getSourceColor(source))} />
            {source.icon && (
              <span aria-hidden="true" style={markerEmojiStyle}>
                {source.icon}
              </span>
            )}
          </span>
        ))}
        {overflow > 0 && (
          <span
            style={overflowPillStyle}
            title={`+${overflow} more ${overflow === 1 ? 'group' : 'groups'}: ${sources
              .slice(MAX_VISIBLE_SOURCE_MARKERS)
              .map((s) => s.label)
              .join(', ')}`}
          >
            +{overflow}
          </span>
        )}
      </span>

      {showBadge && (
        <span style={badgeStyle} data-testid="network-spread-tile-badge">
          ×{tile.occurrenceCount}
        </span>
      )}
    </button>
  );
}
