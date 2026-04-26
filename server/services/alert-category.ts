/**
 * @build-unit BU-requests-urgent
 * @spec architecture/decision-log.md (D058)
 *
 * AlertCategory service — read access for the alert composer's category
 * picker. Admin CRUD lands in BU-admin-crud. Layer boundary: services →
 * db + lib + shared only.
 */

import type { AlertCategory } from '@prisma/client';
import { prisma } from '@/server/db/client';

export interface AlertCategorySummary {
  id: string;
  slug: string;
  displayName: string;
  icon: string | null;
}

function mapCategory(row: AlertCategory): AlertCategorySummary {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    icon: row.icon,
  };
}

/** All non-deleted alert categories, ordered for display. */
export async function listActiveAlertCategories(): Promise<AlertCategorySummary[]> {
  const rows = await prisma.alertCategory.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
  });
  return rows.map(mapCategory);
}

/** Lookup by slug for the composer when a specific category is preselected. */
export async function getAlertCategoryBySlug(slug: string): Promise<AlertCategorySummary | null> {
  const row = await prisma.alertCategory.findFirst({
    where: { slug, deletedAt: null },
  });
  return row ? mapCategory(row) : null;
}
