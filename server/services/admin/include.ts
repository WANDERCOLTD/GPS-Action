/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Helpers for resolving dotted-path `listColumns` from
 * `entityMetadata` into Prisma `include` shapes and for flattening
 * loaded rows into `AdminRow` (dotted-path keys). MVP supports
 * single-level relation paths only (e.g. `author.displayName`,
 * `parent.displayName`). Multi-level paths surface as a build error
 * in tests.
 */

import type { AdminRow } from '@/server/services/admin/types';

/**
 * Map of relation name → set of fields requested on that relation.
 */
type IncludePlan = Record<string, Set<string>>;

/**
 * Walk a list of dotted-path columns; collect the implied
 * `select` shape per relation. Scalar columns (no dot) are
 * skipped; the caller selects them via the table itself.
 */
export function planIncludeFromColumns(columns: ReadonlyArray<string>): IncludePlan {
  const plan: IncludePlan = {};
  for (const path of columns) {
    const dot = path.indexOf('.');
    if (dot < 0) continue;
    const relation = path.slice(0, dot);
    const remainder = path.slice(dot + 1);
    if (remainder.includes('.')) {
      throw new Error(
        `[admin/include] multi-level dotted path not supported in slice 1: "${path}"`,
      );
    }
    const set = plan[relation] ?? new Set<string>();
    set.add(remainder);
    plan[relation] = set;
  }
  return plan;
}

/**
 * Convert an IncludePlan into a Prisma-shaped include object.
 * Always includes `id` on the relation so downstream code can link.
 */
export function planToPrismaInclude(
  plan: IncludePlan,
): Record<string, { select: Record<string, true> }> {
  const out: Record<string, { select: Record<string, true> }> = {};
  for (const relation of Object.keys(plan)) {
    const fields = plan[relation];
    if (!fields) continue;
    const select: Record<string, true> = { id: true };
    for (const field of fields) {
      select[field] = true;
    }
    out[relation] = { select };
  }
  return out;
}

/**
 * Flatten a loaded Prisma row into an AdminRow keyed by `listColumns`
 * paths. Scalar fields pass through; dotted-path columns resolve via
 * the included relation. Missing relations resolve to `null` rather
 * than `undefined` so JSON serialisation is stable.
 */
export function flattenRowForColumns(
  row: Record<string, unknown>,
  columns: ReadonlyArray<string>,
): AdminRow {
  const out: AdminRow = { id: String(row.id) };
  // Always carry deletedAt through if present so callers can render
  // the soft-deleted banner without re-querying.
  if (row.deletedAt !== undefined) {
    (out as Record<string, unknown>).deletedAt = row.deletedAt;
  }
  for (const path of columns) {
    const dot = path.indexOf('.');
    if (dot < 0) {
      (out as Record<string, unknown>)[path] = row[path] ?? null;
      continue;
    }
    const relation = path.slice(0, dot);
    const remainder = path.slice(dot + 1);
    const related = row[relation] as Record<string, unknown> | null | undefined;
    (out as Record<string, unknown>)[path] = related ? (related[remainder] ?? null) : null;
  }
  return out;
}
