/**
 * @build-unit bu-group-identity
 * @spec docs/build/session-briefs/bu-group-identity.md
 * @spec docs/adrs/0013-group-colour-identity.md
 *
 * GroupBadge — the canonical visual chip for a Group across the app.
 * Pure presentational; takes a flat group descriptor and renders.
 *
 * Sizes (per ADR-0013 §sizes):
 *   xs · 16px · initials only             — inline byline / dense lists
 *   sm · 24px · initials + corner glyph   — default
 *   md · 40px · initials + corner glyph   — gallery tiles (logo wins if set)
 *   lg · 64px · initials + corner glyph   — board headers (logo wins if set)
 *
 * `logoUrl` policy: at sizes ≥ md, the logo replaces the initials inside
 * the chip body; the colour-key still frames the chip so identity stays
 * consistent. xs/sm always use initials (logos don't read at small sizes).
 *
 * Accessibility:
 *   - `decorative={true}` (caller signals the chip is paired with a
 *     visible group name in the same row) → chip is `aria-hidden`.
 *   - `decorative={false}` (default; chip is standing on its own) →
 *     chip carries `role="img"` + `aria-label="<displayName> (<kind>)"`.
 *   Colour is reinforcement, never the sole signifier — the kind glyph
 *   plus visible/announced group name carry the identity.
 */

import type { CSSProperties, ReactElement } from 'react';
import { Workflow, MapPin, Network, Briefcase, Hash } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type GroupBadgeKind = 'workstream' | 'region' | 'network' | 'team' | 'topic';

export type GroupBadgeColourKey =
  | 'slate'
  | 'rust'
  | 'moss'
  | 'plum'
  | 'ochre'
  | 'teal'
  | 'indigo'
  | 'coral'
  | 'sage'
  | 'amber'
  | 'rose'
  | 'stone';

export type GroupBadgeSize = 'xs' | 'sm' | 'md' | 'lg';

export interface GroupBadgeGroup {
  readonly displayName: string;
  readonly kind: GroupBadgeKind;
  readonly colourKey: GroupBadgeColourKey;
  readonly logoUrl?: string | null;
}

interface GroupBadgeProps {
  readonly group: GroupBadgeGroup;
  readonly size?: GroupBadgeSize;
  /**
   * True when paired with a visible group name in the same row — the
   * chip becomes `aria-hidden` to avoid double-announcement. Default
   * false (chip carries its own `aria-label`).
   */
  readonly decorative?: boolean;
  readonly className?: string;
}

const KIND_GLYPH: Record<GroupBadgeKind, LucideIcon> = {
  workstream: Workflow,
  region: MapPin,
  network: Network,
  team: Briefcase,
  topic: Hash,
};

const KIND_LABEL: Record<GroupBadgeKind, string> = {
  workstream: 'Workstream',
  region: 'Region',
  network: 'Network',
  team: 'Team',
  topic: 'Topic',
};

interface SizeSpec {
  readonly chipPx: number;
  readonly initialsPx: number;
  readonly cornerPx: number;
  readonly glyphPx: number;
  readonly radiusVar: string;
  readonly logoEligible: boolean;
  readonly cornerVisible: boolean;
}

const SIZE_SPEC: Record<GroupBadgeSize, SizeSpec> = {
  xs: {
    chipPx: 16,
    initialsPx: 9,
    cornerPx: 0,
    glyphPx: 0,
    radiusVar: 'var(--radius-sm)',
    logoEligible: false,
    cornerVisible: false,
  },
  sm: {
    chipPx: 24,
    initialsPx: 11,
    cornerPx: 12,
    glyphPx: 8,
    radiusVar: 'var(--radius-md)',
    logoEligible: false,
    cornerVisible: true,
  },
  md: {
    chipPx: 40,
    initialsPx: 15,
    cornerPx: 16,
    glyphPx: 10,
    radiusVar: 'var(--radius-md)',
    logoEligible: true,
    cornerVisible: true,
  },
  lg: {
    chipPx: 64,
    initialsPx: 24,
    cornerPx: 22,
    glyphPx: 14,
    radiusVar: 'var(--radius-lg)',
    logoEligible: true,
    cornerVisible: true,
  },
};

export function GroupBadge({
  group,
  size = 'sm',
  decorative = false,
  className,
}: GroupBadgeProps): ReactElement {
  const spec = SIZE_SPEC[size];
  const initials = getInitials(group.displayName);
  const bgVar = `var(--colour-group-${group.colourKey})`;
  const textVar = `var(--colour-group-${group.colourKey}-text)`;
  const KindGlyph = KIND_GLYPH[group.kind];

  const ariaProps = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': `${group.displayName} (${KIND_LABEL[group.kind]})` };

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    flexShrink: 0,
    width: `${spec.chipPx}px`,
    height: `${spec.chipPx}px`,
  };

  const chipStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: spec.radiusVar,
    background: bgVar,
    color: textVar,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
    fontSize: `${spec.initialsPx}px`,
    lineHeight: 1,
    overflow: 'hidden',
  };

  const showLogo = spec.logoEligible && Boolean(group.logoUrl);

  return (
    <span
      data-testid="group-badge"
      data-group-kind={group.kind}
      data-group-colour={group.colourKey}
      data-size={size}
      className={className}
      style={wrapperStyle}
      {...ariaProps}
    >
      <span data-testid="group-badge-chip" style={chipStyle}>
        {showLogo ? (
          <img
            src={group.logoUrl ?? ''}
            alt=""
            aria-hidden="true"
            data-testid="group-badge-logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <span data-testid="group-badge-initials">{initials}</span>
        )}
      </span>
      {spec.cornerVisible && (
        <span
          data-testid="group-badge-corner"
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '-2px',
            bottom: '-2px',
            width: `${spec.cornerPx}px`,
            height: `${spec.cornerPx}px`,
            borderRadius: 'var(--radius-circle)',
            background: 'var(--colour-surface-raised)',
            color: textVar,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 1px var(--colour-border-subtle)',
          }}
        >
          <KindGlyph size={spec.glyphPx} strokeWidth={2.25} />
        </span>
      )}
    </span>
  );
}

/**
 * Initials derivation (per brief): first letter of the first two words,
 * accent-stripped, uppercased. Single-word names fall back to the first
 * two characters of that word so the chip never reads as a single
 * letter (which loses identity in dense lists). Empty / whitespace-only
 * input yields "?" to avoid a blank chip.
 */
export function getInitials(name: string): string {
  // U+0300..U+036F is the Unicode "Combining Diacritical Marks" block —
  // NFKD splits accented chars into base + combining mark, so stripping
  // this range yields the ASCII initial.
  const stripped = name.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const parts = stripped.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const word = parts[0] ?? '';
    return word.slice(0, 2).toUpperCase() || '?';
  }
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase() || '?';
}
