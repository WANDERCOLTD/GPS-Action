/**
 * @build-unit BU-fab-intent-picker BU-tick-or-cross BU-event-time
 * @spec architecture/decision-log.md (D062, D069, D070, D073)
 *
 * Canonical list of PostKind slugs the application code statically
 * depends on. Per D070, every slug in this list MUST exist as a
 * non-deleted PostKind row in the database — enforced by
 * `server/lib/assert-reference-data.ts` and the CI reference-data
 * gate.
 *
 * To add a new PostKind: append the slug here, write an idempotent
 * data migration that inserts the row, and update the composer's
 * INTENT_META + KindPickerSheet tile set. The CI gate will fail the
 * merge if the migration is missing.
 *
 * BU-event-time / D073: `kindIsTimeBearing(slug)` is the single
 * source of truth for which kinds carry structured event-time data
 * (eventAt / eventEndsAt / locationText on Post). Composer (show /
 * hide pickers), PostCard (show / hide event row), and the upcoming
 * bu-calendar-view (which kinds appear in the agenda) all consume
 * this helper. Flipping a kind on or off is a one-line change in
 * `TIME_BEARING_KIND_SLUGS` below.
 */

export const REQUIRED_POST_KIND_SLUGS = [
  'happening_now',
  'link_share',
  'call_to_action',
  'cultural',
  'outcome',
  'thought',
  'event',
  'meeting',
  'tick_or_cross',
] as const;

export type RequiredPostKindSlug = (typeof REQUIRED_POST_KIND_SLUGS)[number];

/**
 * BU-event-time / D073. The set of PostKind slugs that surface the
 * structured event-time fields (eventAt / eventEndsAt / locationText)
 * in the composer and on PostCard. v1 mapping:
 *
 *  - meeting        → true   (a real meeting wants a date + time)
 *  - event          → true   (vigil, demo, gathering — needs a when)
 *  - happening_now  → true   (urgent post; the time IS the news)
 *  - everything else → false (cultural, outcome, thought, link_share,
 *                             call_to_action, tick_or_cross)
 *
 * The list is intentionally a const-asserted tuple so adding /
 * removing a slug is a one-line change here, with TypeScript
 * narrowing the union for any callers that pattern-match.
 */
export const TIME_BEARING_KIND_SLUGS = ['meeting', 'event', 'happening_now'] as const;

export type TimeBearingKindSlug = (typeof TIME_BEARING_KIND_SLUGS)[number];

const TIME_BEARING_SET: ReadonlySet<string> = new Set(TIME_BEARING_KIND_SLUGS);

/**
 * Returns true when the given PostKind slug surfaces structured
 * event-time fields. Single source of truth — see
 * TIME_BEARING_KIND_SLUGS above for the v1 mapping. Accepts null /
 * undefined / unknown slug strings and returns false in all such
 * cases (defensive: a Post with `kindId === null` is never
 * time-bearing).
 */
export function kindIsTimeBearing(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return TIME_BEARING_SET.has(slug);
}
