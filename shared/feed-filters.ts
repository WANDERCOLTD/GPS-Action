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

export type FeedFilter =
  | 'all'
  | 'urgent'
  | 'activist_mailer'
  | 'tick_or_cross'
  | 'happening_now'
  | 'meeting'
  | 'event';

export const FEED_FILTERS: readonly FeedFilter[] = [
  'all',
  'urgent',
  'activist_mailer',
  'tick_or_cross',
  'happening_now',
  'meeting',
  'event',
] as const;

export const FEED_FILTER_LABELS: Record<FeedFilter, string> = {
  all: 'All',
  urgent: '⚡ Urgent',
  activist_mailer: 'AM',
  tick_or_cross: '✅❌',
  happening_now: 'Now',
  meeting: 'Meetings',
  event: 'Events',
};

/**
 * Optional brand glyph URL for the chip — e.g. the Activist Mailer
 * logo. Rendered as a small `<img>` before the text label by
 * FeedFilterChips. Plain emoji labels (Urgent, ✅❌) don't need this.
 */
export const FEED_FILTER_ICONS: Partial<Record<FeedFilter, string>> = {
  activist_mailer: '/brands/activist-mailer.webp',
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
  activist_mailer: 'primary',
  tick_or_cross: 'primary',
  happening_now: 'urgent',
  meeting: 'info',
  event: 'info',
};

export function isFeedFilter(value: unknown): value is FeedFilter {
  return typeof value === 'string' && (FEED_FILTERS as readonly string[]).includes(value);
}
