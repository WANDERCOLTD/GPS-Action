/**
 * @build-unit bu-network-seen-state bu-network-unread-icon
 * @spec build/session-briefs/bu-network-seen-state.md
 *
 * "Unread only" chip for /network. Server component — renders a
 * single `<a>` that toggles `?unread=1` while preserving other
 * URL state (sources + sort). Matches the styling of the existing
 * `NetworkSourceChipStrip` chips so the two surfaces feel of-a-piece.
 *
 * Filter is applied client-side in `network-feed.tsx` once seen-state
 * has hydrated from localStorage (the server doesn't know which
 * cards are new — that decision belongs to the browser per the
 * tester-isolation rationale in the brief).
 *
 * bu-network-unread-icon: the chip is icon-only (sparkles) so it
 * sits flush with the sort cluster on narrow viewports and yields
 * horizontal space back to the source chip rail. Active/inactive
 * state is conveyed by the `.gps-chip--active` highlight — the
 * glyph itself does not swap.
 */

import type { CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';

interface NetworkUnreadChipProps {
  active: boolean;
  /**
   * Other URL params that must survive a toggle. Today: `source`,
   * `sort`. Mirrors the same `preserveParams` shape used by
   * `NetworkSourceChipStrip` so the page wiring is consistent.
   */
  preserveParams?: Record<string, string | undefined>;
}

function buildHref(active: boolean, preserve: Record<string, string | undefined>): string {
  const parts: string[] = [];
  // Toggling: if currently active, omit; else add `unread=1`.
  if (!active) parts.push('unread=1');
  for (const [k, v] of Object.entries(preserve)) {
    if (v !== undefined && v !== '') parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `/network?${parts.join('&')}` : '/network';
}

const wrapperStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
};

export function NetworkUnreadChip({ active, preserveParams = {} }: NetworkUnreadChipProps) {
  const href = buildHref(active, preserveParams);
  const label = active ? 'Showing only unread — tap to show all' : 'Show only unread';
  return (
    <div style={wrapperStyle}>
      <a
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        title={label}
        data-testid="network-unread-chip"
        data-active={active ? 'true' : 'false'}
        className={active ? 'gps-chip gps-chip--active' : 'gps-chip'}
      >
        <Sparkles size={16} aria-hidden="true" />
      </a>
    </div>
  );
}

/**
 * Parse the `?unread=` searchParam. Truthy values (`1`, `true`,
 * `yes`) all enable the filter; everything else (including absent)
 * disables. Kept permissive so a future "toggle persistently"
 * surface can also drive it without normalising on its side.
 */
export function parseUnreadParam(raw: string | string[] | undefined): boolean {
  if (raw === undefined) return false;
  const flat = Array.isArray(raw) ? raw[0] : raw;
  if (typeof flat !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(flat.toLowerCase());
}
