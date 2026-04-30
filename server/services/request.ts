/**
 * @build-unit BU-requests-foundation BU-requests-urgent BU-requests-vetting BU-publish-router
 * @spec architecture/decision-log.md (D054, D055, D056, D057, D058, D072)
 * @spec product/scenarios.md (SCN-21, SCN-22, SCN-23)
 * @spec architecture/claim-and-lease.md
 *
 * Request service — read queries + write actions (claim/resolve/
 * createUrgent + kind-review create/close). State-transition writes
 * auto-emit a system-comment on the timeline + a Notification to the
 * submitter (D057).
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { Prisma, Request, RequestPriority, RequestStatus, RequestType } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { getSystemSettingInt } from '@/server/services/system-setting';
import { createNotification } from '@/server/services/notification';
import { createPostReviewAttributionComment } from '@/server/services/comment';

// Sentinel system-user identity for auto-written timeline comments
// (BU-requests-vetting). Seed creates this user; service upserts on
// first call so it works in any environment.
const SYSTEM_USER_EMAIL = 'system@gps-action.test';
let cachedSystemUserId: string | null = null;

async function getSystemUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId;
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    create: { email: SYSTEM_USER_EMAIL, displayName: 'system' },
    update: {},
    select: { id: true },
  });
  cachedSystemUserId = user.id;
  return user.id;
}

/** Write a system-comment to a Request's comment thread (audience: 'all'). */
async function writeSystemComment(input: { requestId: string; body: string }): Promise<void> {
  const systemUserId = await getSystemUserId();
  await prisma.comment.create({
    data: {
      requestId: input.requestId,
      authorId: systemUserId,
      body: input.body,
      audience: 'all',
    },
  });
}

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

  // BU-requests-vetting: timeline + submitter notification
  const claimer = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { displayName: true },
  });
  const fullRequest = await prisma.request.findUnique({
    where: { id: input.requestId },
    select: { createdByUserId: true },
  });
  await writeSystemComment({
    requestId: input.requestId,
    body: `${claimer?.displayName ?? 'Someone'} picked up this request.`,
  });
  if (fullRequest?.createdByUserId && fullRequest.createdByUserId !== input.userId) {
    await createNotification({
      recipientUserId: fullRequest.createdByUserId,
      type: 'request_status_changed',
      requestId: input.requestId,
      fromUserId: input.userId,
      message: `${claimer?.displayName ?? 'Someone'} picked up your request`,
    });
  }

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

  // BU-requests-vetting: timeline + submitter notification
  const resolver = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { displayName: true },
  });
  const noteFragment = input.notes ? ` — "${input.notes.slice(0, 120)}"` : '';
  await writeSystemComment({
    requestId: input.requestId,
    body: `${resolver?.displayName ?? 'Someone'} resolved this request${noteFragment}.`,
  });
  if (existing.createdByUserId && existing.createdByUserId !== input.userId) {
    await createNotification({
      recipientUserId: existing.createdByUserId,
      type: 'request_resolved',
      requestId: input.requestId,
      fromUserId: input.userId,
      message: `${resolver?.displayName ?? 'Someone'} resolved your request`,
    });
  }

  return { ok: true };
}

// ── Kind-review (BU-publish-router / D072) ───────────────────────────────
//
// `kind_review` is the generic request type for reviewing a Post (D072
// §3). Priority is inherited from the kind's `reviewPriority`, so high-
// stakes kinds (urgent / cultural) bubble up the reviewer queue without
// needing per-kind RequestType values.
//
// Two functions:
//   - createKindReviewRequest: opens the request when an author taps
//     "Send to reviewers"
//   - closeKindReviewRequest: applies the verdict (publish / reject /
//     withdrawn) — writes Post.status / Post.reviewedByUserId and
//     inserts the auto-comment when verdict='publish'

export interface CreateKindReviewRequestInput {
  postId: string;
  callerId: string;
  /**
   * Optional Prisma transaction client. When provided the read + write
   * happen inside the supplied tx; the audit-log write still runs on
   * the global client outside the tx (logs aren't part of the integrity
   * boundary). Used by `sendPostForReview` so the Request creation +
   * Post linkage land atomically.
   */
  tx?: Prisma.TransactionClient;
}

export interface CreateKindReviewRequestResult {
  id: string;
  priority: RequestPriority;
}

export async function createKindReviewRequest(
  input: CreateKindReviewRequestInput,
): Promise<CreateKindReviewRequestResult> {
  const db = input.tx ?? prisma;

  // Inherit priority from the post's kind. Falls back to 'normal'
  // when the post has no kind or the kind row is gone — same defensive
  // posture the urgent flow uses.
  const post = await db.post.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      kindId: true,
      kind: { select: { reviewPriority: true } },
    },
  });
  if (!post) {
    throw new Error('createKindReviewRequest: post not found');
  }
  const priority: RequestPriority = post.kind?.reviewPriority ?? 'normal';

  const created = await db.request.create({
    data: {
      type: 'kind_review',
      status: 'unclaimed',
      priority,
      kindId: post.kindId,
      context: { postId: post.id, source: 'publish_modal' },
      createdByUserId: input.callerId,
    },
    select: { id: true },
  });

  await auditLog({
    action: 'request_kind_review_created',
    entityType: 'Request',
    entityId: created.id,
    userId: input.callerId,
    changes: { postId: post.id, priority },
    context: { source: 'publish_modal' },
  });

  return { id: created.id, priority };
}

export type KindReviewVerdict = 'publish' | 'reject' | 'withdrawn';

export interface CloseKindReviewRequestInput {
  requestId: string;
  verdict: KindReviewVerdict;
  reviewerId: string;
  reason?: string | null;
}

export type CloseKindReviewRequestResult =
  | { ok: true; postId: string; verdict: KindReviewVerdict; autoCommentId: string | null }
  | {
      ok: false;
      reason: 'not_found' | 'wrong_type' | 'already_closed' | 'no_post_link';
    };

/**
 * Apply a verdict on a `kind_review` Request and cascade to the linked
 * Post. Verdict effects:
 *
 *   - `publish` — flip Post.status → published, set publishedAt + the
 *     reviewer's id, and (if the auto-comment system setting is on)
 *     insert a `post_review_attribution` Comment. Request status
 *     resolves with reviewer's id.
 *   - `reject` — Post stays draft; reviewer's reason is written to
 *     Request.resolutionNotes; originator is notified via the existing
 *     `request_resolved` channel.
 *   - `withdrawn` — used when the originator discards mid-review.
 *     Request status flips to `abandoned`; Post is left as the
 *     discardPost caller wrote it (no Post mutation here).
 */
export async function closeKindReviewRequest(
  input: CloseKindReviewRequestInput,
): Promise<CloseKindReviewRequestResult> {
  const request = await prisma.request.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      type: true,
      status: true,
      deletedAt: true,
      createdByUserId: true,
      context: true,
    },
  });
  if (!request || request.deletedAt) return { ok: false, reason: 'not_found' };
  if (request.type !== 'kind_review') return { ok: false, reason: 'wrong_type' };
  if (request.status === 'resolved' || request.status === 'abandoned') {
    return { ok: false, reason: 'already_closed' };
  }

  const ctx = request.context as Record<string, unknown> | null;
  const postId = typeof ctx?.postId === 'string' ? ctx.postId : null;
  if (!postId) return { ok: false, reason: 'no_post_link' };

  const now = new Date();
  let autoCommentId: string | null = null;

  if (input.verdict === 'publish') {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { status: true, publishedAt: true },
    });
    await prisma.post.update({
      where: { id: postId },
      data: {
        status: 'published',
        publishedAt: post?.publishedAt ?? now,
        reviewedByUserId: input.reviewerId,
      },
    });

    const auto = await createPostReviewAttributionComment({
      postId,
      reviewerId: input.reviewerId,
    });
    autoCommentId = auto?.id ?? null;
  }

  await prisma.request.update({
    where: { id: input.requestId },
    data: {
      status: input.verdict === 'withdrawn' ? 'abandoned' : 'resolved',
      resolvedAt: now,
      resolvedByUserId: input.reviewerId,
      resolutionNotes: input.reason ?? null,
    },
  });

  await auditLog({
    action: 'request_kind_review_closed',
    entityType: 'Request',
    entityId: request.id,
    userId: input.reviewerId,
    changes: {
      verdict: input.verdict,
      postId,
      hasReason: Boolean(input.reason),
      autoCommentId,
    },
    context: { source: 'publish_modal' },
  });

  // Submitter notifications mirror the existing resolve flow. The
  // reviewer's identity is captured in the audit log + the auto-
  // comment; this just nudges the originator that their request moved.
  if (request.createdByUserId && request.createdByUserId !== input.reviewerId) {
    const reviewer = await prisma.user.findUnique({
      where: { id: input.reviewerId },
      select: { displayName: true },
    });
    const verbByVerdict: Record<KindReviewVerdict, string> = {
      publish: 'reviewed and published your post',
      reject: 'sent back your post',
      withdrawn: 'closed your review request',
    };
    await createNotification({
      recipientUserId: request.createdByUserId,
      type: 'request_resolved',
      requestId: request.id,
      fromUserId: input.reviewerId,
      message: `${reviewer?.displayName ?? 'A reviewer'} ${verbByVerdict[input.verdict]}`,
    });
  }

  return { ok: true, postId, verdict: input.verdict, autoCommentId };
}
