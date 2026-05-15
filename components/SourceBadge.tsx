/**
 * @build-unit BU-source-and-kind-icons
 * @spec adrs/0020-source-and-kind-icons.md
 *
 * Single source of truth for rendering a WhatsApp source group as a
 * cartouche-framed pill. The cartouche is a pill with a 1.5px
 * coloured border matching the source's colour — visually declares
 * "this represents a WhatsApp group" distinct from PostKind chips,
 * filter chips, or feature glyphs.
 *
 * Three variants:
 *   - `chip`    — full picker chip: cartouche + label (chip size 28px slot)
 *   - `compact` — gallery tile overlay: cartouche only, no label (18px)
 *   - `micro`   — spread-trace timeline rows: cartouche only (14–22px)
 *
 * Icon-slot rendering order (first that applies wins):
 *   1. `iconOverride.iconKind === 'image'` → render `<img src={imageUrl}>`
 *   2. `iconOverride.iconKind === 'lucide'` → render registry key
 *   3. Fallback to `source.icon` (emoji) from gps_chat_labels
 *   4. If no emoji either → render a dot in the source colour
 */

import type { CSSProperties, ReactNode } from 'react';
import { getSourceColor } from '@/shared/styles/source-palette';
import { isLucideKey, renderLucideKey, type LucideKey } from '@/components/lucide-icon-registry';
import type { NetworkCardSource } from '@/shared/network-card';
import type { TickCrossPairSize } from '@/components/TickCrossPair';

export type SourceBadgeVariant = 'chip' | 'compact' | 'micro';

/**
 * Server-side serialised shape of a `SourceIconOverride` row. Plain
 * data so this component renders in both server and client contexts.
 */
export interface SourceIconOverrideValue {
  readonly iconKind: 'image' | 'lucide';
  readonly imageUrl: string | null;
  readonly lucideKey: string | null;
}

interface SourceBadgeProps {
  readonly source: NetworkCardSource;
  readonly variant?: SourceBadgeVariant;
  readonly showLabel?: boolean;
  /**
   * Optional override from `SourceIconOverride`. When omitted or null,
   * falls back to source.icon (emoji) → coloured dot.
   */
  readonly iconOverride?: SourceIconOverrideValue | null;
  /** Optional URL for `chip` variant — turns the cartouche into a link. */
  readonly href?: string;
  /** Visual state when the cartouche is the currently-selected filter. */
  readonly active?: boolean;
  /** Extra data attributes (e.g. data-source-slug for tests). */
  readonly dataAttrs?: Record<string, string>;
  /** Optional explicit aria-label; defaults to source.label. */
  readonly ariaLabel?: string;
  /** Tooltip override; defaults to source.description ?? source.label. */
  readonly title?: string;
}

interface VariantSpec {
  iconSlot: number;
  cartouchePadX: number;
  cartouchePadY: number;
  fontSize: string;
  gap: number;
  border: number;
  lucideSize: TickCrossPairSize;
}

const VARIANTS: Record<SourceBadgeVariant, VariantSpec> = {
  chip: {
    iconSlot: 26,
    cartouchePadX: 12,
    cartouchePadY: 5,
    fontSize: 'var(--text-sm)',
    gap: 8,
    border: 1.5,
    lucideSize: 'chip',
  },
  compact: {
    iconSlot: 18,
    cartouchePadX: 7,
    cartouchePadY: 3,
    fontSize: 'var(--text-xs)',
    gap: 5,
    border: 1.5,
    lucideSize: 'compact',
  },
  micro: {
    iconSlot: 22,
    cartouchePadX: 8,
    cartouchePadY: 3,
    fontSize: 'var(--text-xs)',
    gap: 6,
    border: 1.25,
    lucideSize: 'compact',
  },
};

function cartoucheStyle(v: VariantSpec, color: string, active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: v.gap,
    padding: `${v.cartouchePadY}px ${v.cartouchePadX}px ${v.cartouchePadY}px ${Math.max(v.cartouchePadX - 4, 4)}px`,
    border: `${v.border}px solid ${color}`,
    borderRadius: 'var(--radius-pill)',
    background: active ? color : 'var(--colour-surface-raised)',
    color: active ? 'var(--colour-text-inverse)' : 'var(--colour-text-primary)',
    fontSize: v.fontSize,
    lineHeight: 1.2,
    textDecoration: 'none',
    fontWeight: 500,
    flexShrink: 0,
  };
}

function iconSlotStyle(v: VariantSpec): CSSProperties {
  return {
    width: v.iconSlot,
    height: v.iconSlot,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
}

function imageStyle(v: VariantSpec): CSSProperties {
  return {
    width: v.iconSlot,
    height: v.iconSlot,
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
  };
}

function emojiStyle(v: VariantSpec): CSSProperties {
  return {
    fontSize: Math.round(v.iconSlot * 0.62),
    lineHeight: 1,
  };
}

function colouredDotStyle(v: VariantSpec, color: string): CSSProperties {
  const dot = Math.max(8, Math.round(v.iconSlot * 0.45));
  return {
    width: dot,
    height: dot,
    borderRadius: '50%',
    background: color,
    display: 'inline-block',
  };
}

function renderIconSlot(
  source: NetworkCardSource,
  variant: VariantSpec,
  override: SourceIconOverrideValue | null | undefined,
  color: string,
): ReactNode {
  if (override?.iconKind === 'image' && override.imageUrl) {
    return (
      <img
        src={override.imageUrl}
        alt=""
        style={imageStyle(variant)}
        loading="lazy"
        referrerPolicy="no-referrer"
        data-testid="source-badge-image"
      />
    );
  }
  if (override?.iconKind === 'lucide' && isLucideKey(override.lucideKey)) {
    return renderLucideKey(override.lucideKey as LucideKey, { size: variant.lucideSize });
  }
  if (source.icon) {
    return (
      <span style={emojiStyle(variant)} aria-hidden="true">
        {source.icon}
      </span>
    );
  }
  return <span style={colouredDotStyle(variant, color)} aria-hidden="true" />;
}

export function SourceBadge({
  source,
  variant = 'chip',
  showLabel,
  iconOverride,
  href,
  active = false,
  dataAttrs,
  ariaLabel,
  title,
}: SourceBadgeProps) {
  const v = VARIANTS[variant];
  const color = getSourceColor(source);
  // showLabel default: chip = yes, compact/micro = no.
  const labelVisible = showLabel ?? variant === 'chip';

  const content = (
    <>
      <span style={iconSlotStyle(v)}>{renderIconSlot(source, v, iconOverride, color)}</span>
      {labelVisible && <span>{source.label}</span>}
    </>
  );

  const commonProps = {
    'data-source-slug': source.slug,
    'data-variant': variant,
    'data-active': active ? 'true' : 'false',
    'aria-label': ariaLabel ?? source.label,
    title: title ?? source.description ?? source.label,
    ...dataAttrs,
  };

  if (href) {
    return (
      <a
        data-testid="network-source-badge"
        href={href}
        style={cartoucheStyle(v, color, active)}
        {...commonProps}
      >
        {content}
      </a>
    );
  }
  return (
    <span
      data-testid="network-source-badge"
      style={cartoucheStyle(v, color, active)}
      {...commonProps}
    >
      {content}
    </span>
  );
}
