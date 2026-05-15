/**
 * @build-unit BU-network-spread-gallery
 * @spec build/session-briefs/bu-network-spread-gallery.md
 *
 * Server component. Sort dropdown on `/network/spread`. Three modes:
 * Most spread / Trending (24h) / Most recent share. URL-state-encoded
 * as `?sort=mostSpread|trending|mostRecent`. Default `mostSpread`.
 *
 * Mirrors `NetworkSortControl`'s anchor-as-dropdown pattern (three
 * `<a>`s in a visual group). Server-render keeps it hydration-free.
 */

import type { CSSProperties } from 'react';
import { SPREAD_SORT_OPTIONS, type SpreadSort } from '@/shared/network-spread';

interface NetworkSpreadSortControlProps {
  active: SpreadSort;
  preserveParams?: Record<string, string | undefined>;
}

const SORT_LABELS: Record<SpreadSort, string> = {
  mostSpread: 'Most spread',
  trending: 'Trending',
  mostRecent: 'Most recent',
};

const groupStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
};

function buildHref(
  sort: SpreadSort,
  preserveParams: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  if (sort !== 'mostSpread') params.set('sort', sort);
  for (const [k, v] of Object.entries(preserveParams)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '?';
}

export function NetworkSpreadSortControl({
  active,
  preserveParams,
}: NetworkSpreadSortControlProps) {
  return (
    <div
      style={groupStyle}
      role="group"
      aria-label="Sort spread tiles"
      data-testid="network-spread-sort-control"
    >
      {SPREAD_SORT_OPTIONS.map((sort) => {
        const isActive = sort === active;
        return (
          <a
            key={sort}
            href={buildHref(sort, preserveParams)}
            className={`gps-chip${isActive ? ' gps-chip--active' : ''}`}
            aria-current={isActive ? 'true' : undefined}
            data-testid="network-spread-sort-option"
            data-sort={sort}
          >
            {SORT_LABELS[sort]}
          </a>
        );
      })}
    </div>
  );
}

export function parseSpreadSortParam(raw: string | string[] | undefined): SpreadSort {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && (SPREAD_SORT_OPTIONS as readonly string[]).includes(value)) {
    return value as SpreadSort;
  }
  return 'mostSpread';
}
