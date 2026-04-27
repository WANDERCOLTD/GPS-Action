/**
 * @build-unit BU-feed-filter
 * @spec product/research/search-surfaces.md
 *
 * Closed set of feed filter chips surfaced on `/feed`. Held in /shared
 * so both the service (which applies the where-clause) and the chip
 * component (in /components) can reference the same canonical list
 * without crossing layer boundaries.
 */

export type FeedFilter = 'all' | 'urgent' | 'happening_now' | 'meeting' | 'event';

export const FEED_FILTERS: readonly FeedFilter[] = [
  'all',
  'urgent',
  'happening_now',
  'meeting',
  'event',
] as const;

export const FEED_FILTER_LABELS: Record<FeedFilter, string> = {
  all: 'All',
  urgent: '⚡ Urgent',
  happening_now: 'Happening now',
  meeting: 'Meetings',
  event: 'Events',
};

export function isFeedFilter(value: unknown): value is FeedFilter {
  return typeof value === 'string' && (FEED_FILTERS as readonly string[]).includes(value);
}
