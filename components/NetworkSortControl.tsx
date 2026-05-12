/**
 * @build-unit bu-network-sort-options bu-network-sort-toggle
 * @spec build/session-briefs/bu-network-sort-options.md
 *
 * Server component. Single-button sort toggle for `/network` cards.
 * URL-state-encoded via `?sort=recent|oldest`. The icon reflects the
 * CURRENT sort direction; tapping the chip navigates to the opposite,
 * so one tap flips the list direction.
 *
 * Other axes (most-reacted, most-shared, triage-status) need backend
 * joins and are parked in the brief — they aren't shipped here.
 *
 * `recent` is the implicit default — passing `?sort=recent` and
 * omitting the param both render the same active state; the href for
 * the default option strips the param entirely to keep shareable URLs
 * clean.
 *
 * bu-network-sort-toggle: the previous two-chip strip (Newest + Oldest
 * side-by-side) was retired to free horizontal space on narrow
 * viewports — the source chip rail underneath benefits from every
 * pixel back.
 */

import type { CSSProperties } from 'react';
import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react';
import { NETWORK_SORT_OPTIONS, type NetworkSort } from '@/shared/validation/network';

interface NetworkSortControlProps {
  /** Currently-active sort. Defaults to `recent` when the URL has no `?sort=`. */
  active: NetworkSort;
  /**
   * Other URL params that should survive a sort toggle. Today this
   * is the `source` slug list — toggling sort must NOT drop the chip
   * filter the member already applied.
   */
  preserveParams?: Record<string, string | undefined>;
}

const NEXT_SORT: Record<NetworkSort, NetworkSort> = {
  recent: 'oldest',
  oldest: 'recent',
};

const CURRENT_LABEL: Record<NetworkSort, string> = {
  recent: 'Newest first',
  oldest: 'Oldest first',
};

const NEXT_LABEL: Record<NetworkSort, string> = {
  recent: 'Show oldest first',
  oldest: 'Show newest first',
};

function buildHref(sort: NetworkSort, preserve: Record<string, string | undefined>): string {
  // Manual query construction so a preserved comma-list like
  // `source=a,b` stays literal (parity with NetworkSourceChipStrip).
  // `recent` is the implicit default — omit the param to keep the URL
  // clean.
  const parts: string[] = [];
  // Preserve the source list FIRST so the order matches the chip-
  // strip's hrefs — keeps cache hits warm across the two surfaces.
  if (preserve.source !== undefined && preserve.source !== '') {
    parts.push(`source=${preserve.source}`);
  }
  for (const [k, v] of Object.entries(preserve)) {
    if (k === 'source') continue;
    if (v !== undefined && v !== '') parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  if (sort !== 'recent') parts.push(`sort=${sort}`);
  return parts.length ? `/network?${parts.join('&')}` : '/network';
}

const wrapperStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
};

export function NetworkSortControl({ active, preserveParams = {} }: NetworkSortControlProps) {
  // Icon shows the CURRENT sort (down-arrow = newest at top, up-arrow
  // = oldest at top). Tapping navigates to the opposite — so the
  // user understands "this is what I have, tap to flip."
  const Icon = active === 'recent' ? ArrowDownNarrowWide : ArrowUpNarrowWide;
  const nextSort = NEXT_SORT[active];
  const href = buildHref(nextSort, preserveParams);
  const ariaLabel = `${CURRENT_LABEL[active]} — ${NEXT_LABEL[active].toLowerCase()}`;
  return (
    <div data-testid="network-sort-control" style={wrapperStyle}>
      <a
        href={href}
        aria-label={ariaLabel}
        title={NEXT_LABEL[active]}
        data-testid="network-sort-toggle"
        data-current={active}
        data-next={nextSort}
        className="gps-chip"
      >
        <Icon size={16} aria-hidden="true" />
      </a>
    </div>
  );
}

/**
 * Parse `?sort=` to a NetworkSort. Unknown / missing values fall back
 * to `recent` (the implicit default), keeping stale bookmarks happy.
 */
export function parseSortParam(raw: string | string[] | undefined): NetworkSort {
  if (raw === undefined) return 'recent';
  const flat = Array.isArray(raw) ? raw[0] : raw;
  return NETWORK_SORT_OPTIONS.includes(flat as NetworkSort) ? (flat as NetworkSort) : 'recent';
}
