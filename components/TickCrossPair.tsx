/**
 * @build-unit BU-source-and-kind-icons
 * @spec adrs/0020-source-and-kind-icons.md
 *
 * The "tick + cross overlap pair" glyph. Two filled circles —
 * green-check (left, behind) and red-X (right, in front) — with a
 * ~35% horizontal overlap and a thin white halo on each circle so
 * the overlap reads against any background.
 *
 * Single source of truth for the visual; consumed by:
 *   - `<SourceBadge>` when a source has `lucideKey = 'tick-cross-pair'`
 *     (e.g. the GPS Network ✅ or ❌ chat)
 *   - `<PostKindGlyph>` when a PostKind has `lucideIcon = 'tick-cross-pair'`
 *     (e.g. the `tick_or_cross` kind in the FAB intent picker)
 *
 * Three size variants match the cartouche size variants used in
 * `<SourceBadge>`: chip / compact / micro. They share the same
 * proportional layout; only pixel dimensions change.
 */

import type { CSSProperties } from 'react';

export type TickCrossPairSize = 'micro' | 'compact' | 'chip' | 'hero';

interface TickCrossPairProps {
  /** Pixel scale. Defaults to `chip` (28px circles). */
  readonly size?: TickCrossPairSize;
  /** Decorative — hide from screen readers when wrapped in a labelled parent. */
  readonly ariaHidden?: boolean;
  /** Optional aria-label when used as a standalone element. */
  readonly ariaLabel?: string;
}

interface SizeSpec {
  circleSize: number;
  iconSize: number;
  haloSize: number;
  overlapPx: number;
  strokeWidth: number;
}

const SIZES: Record<TickCrossPairSize, SizeSpec> = {
  micro: { circleSize: 14, iconSize: 8, haloSize: 1, overlapPx: 5, strokeWidth: 4 },
  compact: { circleSize: 18, iconSize: 11, haloSize: 1.5, overlapPx: 7, strokeWidth: 3.5 },
  chip: { circleSize: 28, iconSize: 16, haloSize: 2, overlapPx: 10, strokeWidth: 3 },
  hero: { circleSize: 44, iconSize: 22, haloSize: 3, overlapPx: 16, strokeWidth: 2.8 },
};

const wrapStyle = (overlap: number): CSSProperties => ({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  // The right circle's margin-left handles the actual overlap.
  marginRight: 0,
  marginLeft: 0,
  gap: -overlap, // not valid CSS — set via the inline child margin instead
});

const circleStyle = (s: SizeSpec, halo: string): CSSProperties => ({
  width: s.circleSize,
  height: s.circleSize,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: `0 0 0 ${s.haloSize}px ${halo}`,
  flexShrink: 0,
});

export function TickCrossPair({ size = 'chip', ariaHidden = true, ariaLabel }: TickCrossPairProps) {
  const s = SIZES[size];
  const halo = 'var(--colour-surface-raised)';
  return (
    <span
      data-testid="tick-cross-pair"
      data-size={size}
      aria-hidden={ariaHidden && !ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      style={wrapStyle(s.overlapPx)}
    >
      {/* Green tick — left, behind */}
      <span style={{ ...circleStyle(s, halo), background: 'var(--colour-success)' }}>
        <svg
          viewBox="0 0 24 24"
          width={s.iconSize}
          height={s.iconSize}
          fill="none"
          stroke="var(--colour-success-contrast)"
          strokeWidth={s.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {/* Red cross — right, in front, overlapping left */}
      <span
        style={{
          ...circleStyle(s, halo),
          background: 'var(--colour-danger)',
          marginLeft: -s.overlapPx,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={s.iconSize}
          height={s.iconSize}
          fill="none"
          stroke="var(--colour-danger-contrast)"
          strokeWidth={s.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    </span>
  );
}
