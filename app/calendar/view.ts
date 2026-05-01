/**
 * @build-unit BU-calendar-view BU-calendar-near-me
 * @spec architecture/decision-log.md (D073, D076)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 * @spec docs/build/session-briefs/bu-calendar-near-me.md
 *
 * Tiny URL-contract helper for the `/calendar` route. Centralises
 * the `?view=agenda|month|near` literal so the page, the toggle, and
 * the tests share one source of truth.
 *
 * BU-calendar-near-me adds the `near` view + a sibling `?sort=` param
 * (date | distance) — see `parseNearSort` below.
 */

export const CALENDAR_VIEWS = ['agenda', 'month', 'near'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const DEFAULT_CALENDAR_VIEW: CalendarView = 'agenda';

/**
 * Parse a raw `?view=` value (string, string-array, or undefined) and
 * return the canonical view literal. Unknown / missing → `agenda`.
 */
export function parseCalendarView(raw: string | string[] | undefined): CalendarView {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate === 'month') return 'month';
  if (candidate === 'near') return 'near';
  return DEFAULT_CALENDAR_VIEW;
}

/**
 * BU-calendar-near-me: secondary sort within the `near` view. Default
 * is `distance` (the headline of the surface); members can flip to
 * `date` if they'd rather see the next event up top.
 */
export const NEAR_SORTS = ['distance', 'date'] as const;
export type NearSort = (typeof NEAR_SORTS)[number];
export const DEFAULT_NEAR_SORT: NearSort = 'distance';

export function parseNearSort(raw: string | string[] | undefined): NearSort {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate === 'date') return 'date';
  return DEFAULT_NEAR_SORT;
}
