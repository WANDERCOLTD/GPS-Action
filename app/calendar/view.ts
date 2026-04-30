/**
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * Tiny URL-contract helper for the `/calendar` route. Centralises
 * the `?view=agenda|month` literal so the page, the toggle, and the
 * tests share one source of truth.
 */

export const CALENDAR_VIEWS = ['agenda', 'month'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const DEFAULT_CALENDAR_VIEW: CalendarView = 'agenda';

/**
 * Parse a raw `?view=` value (string, string-array, or undefined) and
 * return the canonical view literal. Unknown / missing → `agenda`.
 */
export function parseCalendarView(raw: string | string[] | undefined): CalendarView {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate === 'month') return 'month';
  return DEFAULT_CALENDAR_VIEW;
}
