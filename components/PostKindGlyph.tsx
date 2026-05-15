/**
 * @build-unit BU-source-and-kind-icons
 * @spec adrs/0020-source-and-kind-icons.md
 *
 * Single source of truth for rendering a PostKind icon — replaces
 * the per-component hardcoded-lucide arrays in `KindPickerSheet`,
 * `PostForm`, etc.
 *
 * Render priority:
 *   1. `lucideIcon` (registry key) → lucide-icon-registry
 *   2. `icon` (emoji) → text fallback
 *   3. Nothing → returns null
 *
 * Size variants map to the same scale as `TickCrossPair` /
 * `SourceBadge` so a kind glyph rendered next to a source badge
 * matches proportionally.
 */

import type { CSSProperties } from 'react';
import { isLucideKey, renderLucideKey, type LucideKey } from '@/components/lucide-icon-registry';
import type { TickCrossPairSize } from '@/components/TickCrossPair';

interface PostKindGlyphProps {
  readonly lucideIcon: string | null | undefined;
  readonly icon: string | null | undefined;
  readonly size?: TickCrossPairSize;
  /** Decorative — defaults true since callers usually label the surrounding control. */
  readonly ariaHidden?: boolean;
}

const EMOJI_FONT_SIZE: Record<TickCrossPairSize, number> = {
  micro: 12,
  compact: 16,
  chip: 22,
  hero: 36,
};

export function PostKindGlyph({
  lucideIcon,
  icon,
  size = 'chip',
  ariaHidden = true,
}: PostKindGlyphProps) {
  if (isLucideKey(lucideIcon)) {
    return (
      <span data-testid="post-kind-glyph" data-source="lucide" data-key={lucideIcon}>
        {renderLucideKey(lucideIcon as LucideKey, { size })}
      </span>
    );
  }
  if (icon) {
    const style: CSSProperties = {
      fontSize: EMOJI_FONT_SIZE[size],
      lineHeight: 1,
    };
    return (
      <span
        data-testid="post-kind-glyph"
        data-source="emoji"
        style={style}
        aria-hidden={ariaHidden}
      >
        {icon}
      </span>
    );
  }
  return null;
}
