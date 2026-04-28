/**
 * @build-unit BU-fab-intent-picker BU-tick-or-cross
 * @spec architecture/decision-log.md (D062, D069, D070)
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
