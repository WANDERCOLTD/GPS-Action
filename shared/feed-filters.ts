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

/**
 * Per BU-icon-strips: `FEED_FILTER_LABELS` is the screen-reader /
 * tooltip label only. The chip's *visible* glyph is determined per
 * filter by `FeedFilterChips` (lucide for most; brand `<img>` for AM;
 * the literal `✅❌` emoji for tick-or-cross). "All" is the only chip
 * whose label remains the visible text content.
 */
export const FEED_FILTER_LABELS: Record<FeedFilter, string> = {
  all: 'All',
  urgent: 'Urgent',
  activist_mailer: 'Activist Mailer',
  tick_or_cross: 'Promote or Report',
  happening_now: 'Happening now',
  meeting: 'Meetings',
  event: 'Events',
};

/**
 * Optional brand glyph URL for the chip — e.g. the Activist Mailer
 * logo. Rendered as a small `<img>` by FeedFilterChips, in place of a
 * lucide line icon. Per BU-icon-strips this is a deliberate
 * partner-brand exception (per share-taxonomy); lucide `Megaphone` is
 * reserved as the future fallback if the brand glyph ever swaps.
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
