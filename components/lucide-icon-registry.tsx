/**
 * @build-unit BU-source-and-kind-icons
 * @spec adrs/0020-source-and-kind-icons.md
 *
 * Single registry mapping lucide-key strings to renderable React
 * components. Consumed by `<SourceBadge>` (via `SourceIconOverride.
 * lucideKey`) and `<PostKindGlyph>` (via `PostKind.lucideIcon`).
 *
 * Adding a new entry: extend `LUCIDE_KEYS`, add the case in
 * `renderLucideKey`, and that's it — no DB migration. The lucide-
 * key value stored in the DB is opaque text; this file decides
 * what each key actually renders.
 *
 * Component-not-lib because some entries (e.g. `tick-cross-pair`)
 * are composite custom JSX, not a single lucide icon.
 */

import type { ReactElement } from 'react';
import { Check, X } from 'lucide-react';
import { TickCrossPair, type TickCrossPairSize } from '@/components/TickCrossPair';

/** Known registry keys. Keep in sync with `renderLucideKey`. */
export const LUCIDE_KEYS = ['tick-cross-pair', 'check', 'x'] as const;
export type LucideKey = (typeof LUCIDE_KEYS)[number];

export function isLucideKey(value: string | null | undefined): value is LucideKey {
  return (
    value !== null && value !== undefined && (LUCIDE_KEYS as readonly string[]).includes(value)
  );
}

interface RenderOptions {
  readonly size: TickCrossPairSize;
}

/**
 * Render a registry key at the requested size. Sizes map to the
 * same chip/compact/micro/hero scale used by `<SourceBadge>` so
 * a key rendered in a chip context picks the chip-size variant.
 */
export function renderLucideKey(key: LucideKey, opts: RenderOptions): ReactElement {
  switch (key) {
    case 'tick-cross-pair':
      return <TickCrossPair size={opts.size} />;
    case 'check':
      return renderSingleCheck(opts.size, false);
    case 'x':
      return renderSingleCheck(opts.size, true);
  }
}

function renderSingleCheck(size: TickCrossPairSize, isCross: boolean): ReactElement {
  // Same size table as TickCrossPair so single-glyph renders match the
  // pair-glyph circles exactly when seen side by side.
  const dims = {
    micro: { circle: 14, icon: 8, halo: 1 },
    compact: { circle: 18, icon: 11, halo: 1.5 },
    chip: { circle: 28, icon: 16, halo: 2 },
    hero: { circle: 44, icon: 22, halo: 3 },
  }[size];
  const Icon = isCross ? X : Check;
  const bg = isCross ? 'var(--colour-danger)' : 'var(--colour-success)';
  const fg = isCross ? 'var(--colour-danger-contrast)' : 'var(--colour-success-contrast)';
  return (
    <span
      data-testid="lucide-single-glyph"
      data-key={isCross ? 'x' : 'check'}
      style={{
        width: dims.circle,
        height: dims.circle,
        borderRadius: '50%',
        background: bg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 0 ${dims.halo}px var(--colour-surface-raised)`,
        flexShrink: 0,
      }}
    >
      <Icon size={dims.icon} color={fg} strokeWidth={3} aria-hidden="true" />
    </span>
  );
}
