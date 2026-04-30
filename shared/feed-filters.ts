/**
 * @build-unit BU-feed-filter BU-feed-card-affordances
 * @spec product/research/search-surfaces.md
 *
 * Closed set of feed filter chips surfaced on `/feed`. Held in /shared
 * so both the service (which applies the where-clause) and the chip
 * component (in /components) can reference the same canonical list
 * without crossing layer boundaries.
 *
 * Order matters — it's the visual order in the chip strip.
 */

export type FeedFilter = 'all' | 'urgent' | 'tick_or_cross' | 'happening_now' | 'meeting' | 'event';

export const FEED_FILTERS: readonly FeedFilter[] = [
  'all',
  'urgent',
  'tick_or_cross',
  'happening_now',
  'meeting',
  'event',
] as const;

export const FEED_FILTER_LABELS: Record<FeedFilter, string> = {
  all: 'All',
  urgent: '⚡ Urgent',
  tick_or_cross: '✅❌',
  happening_now: 'Now',
  meeting: 'Meetings',
  event: 'Events',
};

/**
 * Tone tied to the kind chip the filter selects for. When the chip is
 * active, the FeedFilterChips component applies the matching
 * `.gps-chip--<tone>` modifier, so an active filter's palette mirrors
 * the kind chips on the posts it's surfacing.
 */
export type FeedFilterTone = 'neutral' | 'urgent' | 'primary' | 'info';

export const FEED_FILTER_TONES: Record<FeedFilter, FeedFilterTone> = {
  all: 'neutral',
  urgent: 'urgent',
  tick_or_cross: 'primary',
  happening_now: 'urgent',
  meeting: 'info',
  event: 'info',
};

export function isFeedFilter(value: unknown): value is FeedFilter {
  return typeof value === 'string' && (FEED_FILTERS as readonly string[]).includes(value);
}
