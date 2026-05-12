/**
 * @build-unit bu-network-sort-options
 * @spec build/session-briefs/bu-network-sort-options.md
 *
 * Server component. Two-option sort toggle for `/network` cards.
 * URL-state-encoded via `?sort=recent|oldest`. Renders as two pill
 * chips alongside the source chip strip so the two filter surfaces
 * (which-chat / which-time-direction) share a visual register.
 *
 * Other axes (most-reacted, most-shared, triage-status) need backend
 * joins and are parked in the brief — they aren't shipped here.
 *
 * `recent` is the implicit default — passing `?sort=recent` and
 * omitting the param both render the same active state; the href
 * for the default option strips the param entirely to keep
 * shareable URLs clean.
 */

import type { CSSProperties, ComponentType } from 'react';
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

const LABEL: Record<NetworkSort, string> = {
  recent: 'Newest',
  oldest: 'Oldest',
};

// Iconography (bu-page-header-system): "Newest" surfaces with the
// descending-sort glyph (most recent → oldest, top-down); "Oldest"
// surfaces with the ascending-sort glyph. Lucide uses the
// NarrowWide/WideNarrow naming to disambiguate from arrow-only icons.
const ICON: Record<
  NetworkSort,
  ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' }>
> = {
  recent: ArrowDownNarrowWide,
  oldest: ArrowUpNarrowWide,
};

const rowStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 'var(--space-2)',
  alignItems: 'center',
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

export function NetworkSortControl({ active, preserveParams = {} }: NetworkSortControlProps) {
  return (
    <div data-testid="network-sort-control" style={rowStyle}>
      <nav aria-label="Sort order" style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
        {NETWORK_SORT_OPTIONS.map((sort) => {
          const isActive = sort === active;
          const href = buildHref(sort, preserveParams);
          const Icon = ICON[sort];
          return (
            <a
              key={sort}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Sort by ${LABEL[sort].toLowerCase()}`}
              title={LABEL[sort]}
              data-testid="network-sort-option"
              data-sort={sort}
              data-active={isActive ? 'true' : 'false'}
              className={isActive ? 'gps-chip gps-chip--active' : 'gps-chip'}
            >
              <Icon size={16} aria-hidden="true" />
            </a>
          );
        })}
      </nav>
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
