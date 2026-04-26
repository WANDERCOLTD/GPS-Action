/**
 * @build-unit BU-admin-audit-integration
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-audit-integration.md
 *
 * Diff helper for the admin audit pipeline. Compares two row
 * snapshots and returns the set of fields that changed, with PII
 * fields stripped out per the locked Q1 list.
 *
 * Slice 1 simplicity: equality is `===` for primitives, `getTime()`
 * for Date, `JSON.stringify` for arrays + plain objects. Refining
 * deep-nested-JSON sensitivity is a follow-up if audit noise
 * becomes a real concern.
 */

/**
 * PII fields stripped from `changes.before / after / diff` before
 * the audit row is written. Locked 2026-04-26 (Q1 of brief). Note
 * `displayName` is intentionally NOT here — it's the public
 * identifier, not PII.
 */
export const PII_FIELDS: ReadonlySet<string> = new Set([
  'email',
  'phoneNumber',
  'ipAddress',
  'userAgent',
]);

export interface FieldChange {
  readonly from: unknown;
  readonly to: unknown;
}

export type Diff = Record<string, FieldChange>;

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Compute the diff between two row snapshots. Only includes fields
 * that actually changed. PII fields are excluded entirely (not
 * shown as `from` or `to`).
 *
 * Returns `{}` when the snapshots are identical or every change
 * is in a PII field — surfaces no-op updates honestly.
 */
export function computeDiff(before: Record<string, unknown>, after: Record<string, unknown>): Diff {
  const out: Diff = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (PII_FIELDS.has(key)) continue;
    if (valuesEqual(before[key], after[key])) continue;
    out[key] = { from: before[key] ?? null, to: after[key] ?? null };
  }
  return out;
}

/**
 * Strip PII fields from a row snapshot. Used when capturing
 * `changes.before` or `changes.after` for create / soft-delete /
 * restore / hard-delete (where we record the full row, not a diff).
 */
export function stripPii(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (PII_FIELDS.has(key)) continue;
    out[key] = value;
  }
  return out;
}
