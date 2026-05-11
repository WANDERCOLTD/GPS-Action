/**
 * @build-unit bu-network-card-layout
 * @spec build/session-briefs/bu-network-card-layout.md
 *
 * Standalone verified-share counter pill. Extracted from `<ShareGroup>`
 * so callers (like `<NetworkCard>`'s vertical share column) can compose
 * it independently from the icon rail — e.g., counter on top, then a
 * WhatsApp button, then the X/IG/FB icons.
 *
 * Rendering rules (preserved from ShareGroup's internal counter):
 *   - Zero counts render greyed with a transparent background +
 *     visible border.
 *   - Non-zero counts use the sunken surface fill with no border.
 *   - Tooltip enumerates per-destination counts.
 */

import type { CSSProperties, FC } from 'react';
import type { ShareDestination } from '@prisma/client';

export interface ShareCountsView {
  total: number;
  perDestination: Partial<Record<ShareDestination, number>>;
}

interface ShareCountPillProps {
  counts: ShareCountsView;
  /**
   * Distinguishes multiple counter pills on the same page (per-card).
   * The `data-target-id` keeps tests selecting the right one.
   */
  targetId?: string;
}

const TOOLTIP_ORDER: ReadonlyArray<ShareDestination> = ['whatsapp', 'x', 'instagram', 'facebook'];

function tooltipText(counts: ShareCountsView): string {
  const breakdown = TOOLTIP_ORDER.map((d) => `${d}: ${counts.perDestination[d] ?? 0}`).join(', ');
  return `${counts.total} verified shares — ${breakdown}`;
}

export const ShareCountPill: FC<ShareCountPillProps> = ({ counts, targetId }) => {
  const isZero = counts.total === 0;
  return (
    <span
      data-testid="share-count-pill"
      data-target-id={targetId}
      data-count={counts.total}
      data-zero={isZero ? 'true' : 'false'}
      title={tooltipText(counts)}
      style={style(isZero)}
    >
      <span aria-hidden="true">★ </span>
      {counts.total}
    </span>
  );
};

function style(isZero: boolean): CSSProperties {
  return {
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-xs)',
    color: isZero ? 'var(--colour-text-tertiary)' : 'var(--colour-text-secondary)',
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--radius-pill)',
    background: isZero ? 'transparent' : 'var(--colour-surface-sunken)',
    border: `1px solid ${isZero ? 'var(--colour-border-subtle)' : 'transparent'}`,
    fontWeight: 'var(--weight-semibold)',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}
