/**
 * @build-unit BU-feed-filter
 * @spec product/research/search-surfaces.md (§4 — chips persist; search is modal)
 * @spec product/design-philosophy.md
 *
 * Horizontal pill row that replaces the `<h1>Feed</h1>` on `/feed`.
 * Single-active, URL-driven via `?filter=<slug>`. Server component —
 * each chip is a `<Link>` so navigation is plain HTTP and back-button
 * semantics work without client state.
 *
 * The page passes `active` (from `searchParams.filter`); chips not
 * matching that value render in their default ghost style.
 */

import * as React from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  FEED_FILTERS,
  FEED_FILTER_LABELS,
  FEED_FILTER_TONES,
  type FeedFilter,
} from '@/shared/feed-filters';

interface FeedFilterChipsProps {
  active: FeedFilter;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  marginBottom: 'var(--space-6)',
  paddingBottom: 'var(--space-1)',
};

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function FeedFilterChips({ active }: FeedFilterChipsProps) {
  return (
    <>
      <h1 style={srOnlyStyle}>Feed</h1>
      <nav aria-label="Feed filters" data-testid="feed-filter-chips" style={rowStyle}>
        {FEED_FILTERS.map((filter) => {
          const isActive = filter === active;
          const href = filter === 'all' ? '/feed' : `/feed?filter=${filter}`;
          // Active chip mirrors the kind chip on the posts it surfaces:
          // urgent / Now → urgent palette, meeting / event → info,
          // tick_or_cross → primary, all → neutral. Inactive chips fall
          // back to the default ghost.
          const tone = FEED_FILTER_TONES[filter];
          const className = isActive ? `gps-chip gps-chip--${tone}` : 'gps-chip';
          return (
            <Link
              key={filter}
              href={href}
              prefetch={false}
              data-testid={`feed-filter-${filter}`}
              data-tone={tone}
              aria-current={isActive ? 'page' : undefined}
              className={className}
            >
              {FEED_FILTER_LABELS[filter]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
