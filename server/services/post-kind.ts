/**
 * @build-unit BU-fab-intent-picker BU-publish-router
 * @spec architecture/decision-log.md (D062, D072)
 *
 * PostKind service — read access for the composer (kind picker, alert
 * eligibility lookup) and reviewer surfaces. Replaces the old
 * AlertCategory service per D062's merger.
 *
 * Code defines the slug set; admin manages per-row policy
 * (isAlertEligible, displayName, sortOrder, soft-delete) — admin CRUD
 * UI lands in BU-admin-crud.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { PostKind, ReviewMode, RequestPriority } from '@prisma/client';
import { prisma } from '@/server/db/client';

export interface PostKindSummary {
  id: string;
  slug: string;
  displayName: string;
  icon: string | null;
  isAlertEligible: boolean;
  sortOrder: number;
  /** D072 — kind-specific publish-modal action slugs. */
  actionSlugs: string[];
  /** D072 — drives the publish modal's preselected default. */
  reviewMode: ReviewMode;
  /** D072 — when false, the "Post to feed" base card is hidden. */
  canSelfPublish: boolean;
  /** D072 — priority a kind_review Request inherits from this kind. */
  reviewPriority: RequestPriority;
}

function mapKind(row: PostKind): PostKindSummary {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    icon: row.icon,
    isAlertEligible: row.isAlertEligible,
    sortOrder: row.sortOrder,
    actionSlugs: row.actionSlugs,
    reviewMode: row.reviewMode,
    canSelfPublish: row.canSelfPublish,
    reviewPriority: row.reviewPriority,
  };
}

/** All non-deleted PostKinds, ordered for display. */
export async function listActivePostKinds(): Promise<PostKindSummary[]> {
  const rows = await prisma.postKind.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
  });
  return rows.map(mapKind);
}

/** Lookup by slug — used by composer to resolve ?intent= → id. */
export async function getPostKindBySlug(slug: string): Promise<PostKindSummary | null> {
  const row = await prisma.postKind.findFirst({ where: { slug, deletedAt: null } });
  return row ? mapKind(row) : null;
}

/** Lookup by id — used to validate FK + check alert eligibility on writes. */
export async function getPostKindById(id: string): Promise<PostKindSummary | null> {
  const row = await prisma.postKind.findFirst({ where: { id, deletedAt: null } });
  return row ? mapKind(row) : null;
}

/** Just the alert-eligible subset (for the alert toggle gate). */
export async function listAlertEligiblePostKinds(): Promise<PostKindSummary[]> {
  const rows = await prisma.postKind.findMany({
    where: { deletedAt: null, isAlertEligible: true },
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
  });
  return rows.map(mapKind);
}
