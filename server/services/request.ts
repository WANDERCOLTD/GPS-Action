/**
 * @build-unit BU-requests-foundation
 * @spec architecture/decision-log.md (D054, D055)
 * @spec product/scenarios.md (SCN-21, SCN-22)
 * @spec architecture/claim-and-lease.md
 *
 * Request service — read-only queries for the foundation BU. Claim,
 * resolve, and audience-toggled comments arrive in the urgent + vetting
 * BUs. Layer boundary: services → db + lib + shared only.
 */

import type { Prisma, Request, RequestStatus, RequestType } from '@prisma/client';
import { prisma } from '@/server/db/client';

export interface RequestListItem {
  id: string;
  type: RequestType;
  status: RequestStatus;
  context: Prisma.JsonValue;
  regionSlug: string | null;
  createdAt: Date;
  createdByUserId: string | null;
  claimedByUserId: string | null;
  claimedAt: Date | null;
  resolvedAt: Date | null;
  claimedBy: { id: string; displayName: string } | null;
  createdBy: { id: string; displayName: string } | null;
}

function mapRequest(
  row: Request & {
    claimedBy: { id: string; displayName: string } | null;
    createdBy: { id: string; displayName: string } | null;
  },
): RequestListItem {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    context: row.context,
    regionSlug: row.regionSlug,
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId,
    claimedByUserId: row.claimedByUserId,
    claimedAt: row.claimedAt,
    resolvedAt: row.resolvedAt,
    claimedBy: row.claimedBy,
    createdBy: row.createdBy,
  };
}

/** "My requests" view — Requests this user submitted. */
export async function listRequestsForSubmitter(userId: string): Promise<RequestListItem[]> {
  const rows = await prisma.request.findMany({
    where: { createdByUserId: userId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      claimedBy: { select: { id: true, displayName: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
  });
  return rows.map(mapRequest);
}

/**
 * Reviewer queue — Requests visible to a caller based on their scopes.
 *
 * For the foundation BU we keep this simple: caller sees the union of
 *   - Requests with type matching any scope grant (e.g. 'queue_manager:vetting'
 *     unlocks type='vetting')
 *   - All Requests if the caller has the unscoped queue_manager role
 *   - All Requests if the caller has admin role
 */
export async function listRequestsForReviewer(input: {
  callerId: string;
  hasUnscopedQueueManager: boolean;
  hasAdmin: boolean;
  scopedTypes: RequestType[];
}): Promise<RequestListItem[]> {
  const { hasUnscopedQueueManager, hasAdmin, scopedTypes } = input;

  if (!hasUnscopedQueueManager && !hasAdmin && scopedTypes.length === 0) {
    return [];
  }

  const where: Prisma.RequestWhereInput = {
    deletedAt: null,
    ...(hasUnscopedQueueManager || hasAdmin ? {} : { type: { in: scopedTypes } }),
  };

  const rows = await prisma.request.findMany({
    where,
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: {
      claimedBy: { select: { id: true, displayName: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
  });
  return rows.map(mapRequest);
}

/**
 * Parse a scope string ('queue_manager:vetting') into its RequestType.
 * Returns null if the scope shape is unknown — service-level filter only.
 */
export function scopeToRequestType(scope: string): RequestType | null {
  const KNOWN: RequestType[] = [
    'vetting',
    'flag',
    'outcome_review',
    'dedup_merge',
    'edit_request',
    'incident',
    'content_submission',
    'link_submission',
  ];
  const [, type] = scope.split(':');
  if (!type) return null;
  return KNOWN.includes(type as RequestType) ? (type as RequestType) : null;
}
