/**
 * @build-unit BU-requests-foundation BU-requests-urgent
 * @spec architecture/decision-log.md (D054, D055, D058)
 * @spec product/scenarios.md (SCN-21, SCN-22, SCN-23)
 * @spec architecture/claim-and-lease.md
 *
 * Request service — read queries (BU-requests-foundation) plus
 * createUrgent / claim / resolve write actions (BU-requests-urgent).
 * Audience-toggled comments still arrive in BU-requests-vetting.
 * Layer boundary: services → db + lib + shared only.
 */

import type { Prisma, Request, RequestStatus, RequestType } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { getSystemSettingInt } from '@/server/services/system-setting';

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
  resolutionNotes: string | null;
  /** D058 — urgent flag, only true for the alert flow */
  urgency: boolean;
  urgencyExpiresAt: Date | null;
  kindSlug: string | null;
  kindDisplayName: string | null;
  claimedBy: { id: string; displayName: string } | null;
  createdBy: { id: string; displayName: string } | null;
}

type RequestWithJoins = Request & {
  claimedBy: { id: string; displayName: string } | null;
  createdBy: { id: string; displayName: string } | null;
  kind: { slug: string; displayName: string } | null;
};

function mapRequest(row: RequestWithJoins): RequestListItem {
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
    resolutionNotes: row.resolutionNotes,
    urgency: row.urgency,
    urgencyExpiresAt: row.urgencyExpiresAt,
    kindSlug: row.kind?.slug ?? null,
    kindDisplayName: row.kind?.displayName ?? null,
    claimedBy: row.claimedBy,
    createdBy: row.createdBy,
  };
}

const REQUEST_INCLUDE = {
  claimedBy: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, displayName: true } },
  kind: { select: { slug: true, displayName: true } },
} as const;

/** "My requests" view — Requests this user submitted. */
export async function listRequestsForSubmitter(userId: string): Promise<RequestListItem[]> {
  const rows = await prisma.request.findMany({
    where: { createdByUserId: userId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }],
    include: REQUEST_INCLUDE,
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

  // D058 — visibility broadening: urgent Requests bypass the scope filter.
  // A scoped reviewer sees their own type AND every urgent Request.
  const baseTypeFilter =
    hasUnscopedQueueManager || hasAdmin ? undefined : { type: { in: scopedTypes } };

  const where: Prisma.RequestWhereInput = baseTypeFilter
    ? {
        deletedAt: null,
        OR: [baseTypeFilter, { urgency: true }],
      }
    : { deletedAt: null };

  const rows = await prisma.request.findMany({
    where,
    orderBy: [{ urgency: 'desc' }, { status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: REQUEST_INCLUDE,
  });
  return rows.map(mapRequest);
}

/**
 * Polling endpoint backing — returns urgent Requests visible to the caller.
 * D058: every authenticated user with any reviewer scope sees urgent.
 * Authentication enforced at the router boundary.
 */
export async function listUrgentForPolling(): Promise<RequestListItem[]> {
  const rows = await prisma.request.findMany({
    where: { urgency: true, deletedAt: null },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 50,
    include: REQUEST_INCLUDE,
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

// ── Write actions (BU-requests-urgent — D058) ────────────────────────────

export interface CreateUrgentInput {
  callerId: string;
  kindId: string;
  title: string;
  body: string;
  regionSlug?: string | null;
}

/** Create an urgent Request and emit an audit-log entry. */
export async function createUrgentRequest(input: CreateUrgentInput): Promise<{ id: string }> {
  const ttlHours = await getSystemSettingInt('urgent_ttl_hours', 4);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const created = await prisma.request.create({
    data: {
      type: 'incident',
      status: 'unclaimed',
      priority: 'urgent',
      urgency: true,
      urgencyExpiresAt: expiresAt,
      kindId: input.kindId,
      regionSlug: input.regionSlug ?? null,
      context: {
        summary: input.title,
        body: input.body,
        source: 'alert_composer',
      },
      createdByUserId: input.callerId,
    },
    select: { id: true },
  });

  await auditLog({
    action: 'request_urgent_created',
    entityType: 'Request',
    entityId: created.id,
    userId: input.callerId,
    changes: {
      titleLength: input.title.length,
      bodyLength: input.body.length,
      ttlHours,
      kindId: input.kindId,
    },
    context: { source: 'alert_composer' },
  });

  return created;
}

export type ClaimResult = { ok: true } | { ok: false; reason: 'not_found' | 'already_claimed' };

/**
 * Atomic claim — uses updateMany with a status='unclaimed' guard so two
 * reviewers can't double-claim. Returns reason='already_claimed' when the
 * row exists but a race lost. Per claim-and-lease.md.
 */
export async function claimRequest(input: {
  requestId: string;
  userId: string;
}): Promise<ClaimResult> {
  const result = await prisma.request.updateMany({
    where: { id: input.requestId, status: 'unclaimed', deletedAt: null },
    data: {
      status: 'claimed',
      claimedByUserId: input.userId,
      claimedAt: new Date(),
    },
  });

  if (result.count === 0) {
    const exists = await prisma.request.findUnique({ where: { id: input.requestId } });
    return { ok: false, reason: exists ? 'already_claimed' : 'not_found' };
  }

  await auditLog({
    action: 'request_claimed',
    entityType: 'Request',
    entityId: input.requestId,
    userId: input.userId,
    changes: { claimedAt: new Date().toISOString() },
    context: { source: 'requests_workspace' },
  });

  return { ok: true };
}

export type ResolveResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'wrong_state' | 'not_claimer' };

/**
 * Resolve a claimed Request. The caller must be the claimer (or admin —
 * enforced at the router boundary). Writes resolutionNotes if provided.
 */
export async function resolveRequest(input: {
  requestId: string;
  userId: string;
  isAdmin: boolean;
  notes: string | null;
}): Promise<ResolveResult> {
  const existing = await prisma.request.findUnique({ where: { id: input.requestId } });
  if (!existing || existing.deletedAt) return { ok: false, reason: 'not_found' };
  if (existing.status !== 'claimed' && existing.status !== 'in_review') {
    return { ok: false, reason: 'wrong_state' };
  }
  if (!input.isAdmin && existing.claimedByUserId !== input.userId) {
    return { ok: false, reason: 'not_claimer' };
  }

  await prisma.request.update({
    where: { id: input.requestId },
    data: {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedByUserId: input.userId,
      resolutionNotes: input.notes,
    },
  });

  await auditLog({
    action: 'request_resolved',
    entityType: 'Request',
    entityId: input.requestId,
    userId: input.userId,
    changes: {
      resolvedAt: new Date().toISOString(),
      hasNotes: Boolean(input.notes),
    },
    context: { source: 'requests_workspace' },
  });

  return { ok: true };
}
