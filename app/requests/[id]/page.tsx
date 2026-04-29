/**
 * @build-unit BU-requests-vetting
 * @spec architecture/decision-log.md (D054, D055, D056, D057)
 * @spec product/scenarios.md (SCN-21, SCN-22)
 *
 * Request detail page — comment thread + composer with audience toggle.
 * Single route serves both submitter view (audience-filtered to 'all'
 * comments) and reviewer view (both audiences). Notifications related
 * to this Request are auto-marked-read on visit.
 */

import { notFound, redirect } from 'next/navigation';
import { ArrowLink } from '@/components/ArrowLink';
import { formatDistanceToNow } from 'date-fns';
import { createTRPCContext } from '@/server/routers/context';
import { listCommentsForRequest } from '@/server/services/comment';
import { markReadForRequest } from '@/server/services/notification';
import { scopeToRequestType } from '@/server/services/request';
import { prisma } from '@/server/db/client';
import { ClaimButton, ResolveForm } from '@/components/RequestActionButtons';
import { RequestDetailPanel, type DetailComment } from '@/components/RequestDetailPanel';
import type { RequestType } from '@prisma/client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Request — GPS Action',
};

const TYPE_LABELS: Record<RequestType, string> = {
  vetting: 'Vetting application',
  flag: 'Flagged content',
  outcome_review: 'Outcome review',
  dedup_merge: 'Duplicate merge',
  edit_request: 'Edit request',
  incident: 'Incident',
  content_submission: 'Content submission',
  link_submission: 'Link submission',
  kind_review: 'Post review',
};

const STATUS_LABELS: Record<string, string> = {
  unclaimed: 'new',
  claimed: 'in discussion',
  in_review: 'in discussion',
  resolved: 'done',
  abandoned: 'abandoned',
};

export default async function RequestDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect(`/dev/login?returnTo=/requests/${id}`);
  }
  const userId = ctx.user.id;

  const hasUnscopedQueueManager = ctx.activeRoles.includes('queue_manager');
  const hasAdmin = ctx.activeRoles.includes('admin');
  const scopedTypes: RequestType[] = ctx.activeScopes
    .map(scopeToRequestType)
    .filter((t): t is RequestType => t !== null);
  const isReviewer = hasUnscopedQueueManager || hasAdmin || scopedTypes.length > 0;

  const request = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    include: {
      claimedBy: { select: { id: true, displayName: true } },
      createdBy: { select: { id: true, displayName: true } },
      kind: { select: { slug: true, displayName: true } },
    },
  });

  if (!request) notFound();

  const isSubmitter = request.createdByUserId === userId;
  if (!isSubmitter && !isReviewer) {
    // Caller is neither the submitter nor a reviewer — they can't see this Request.
    notFound();
  }

  // Mark related notifications read on visit (best-effort, fire-and-forget OK).
  await markReadForRequest({ userId, requestId: id });

  const comments = await listCommentsForRequest({
    requestId: id,
    callerId: userId,
    isReviewer,
  });

  // Resolve the system user id once so we can flag system comments client-side.
  const systemUser = await prisma.user.findUnique({
    where: { email: 'system@gps-action.test' },
    select: { id: true },
  });

  const detailComments: DetailComment[] = comments.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    authorDisplayName: c.author.displayName,
    authorIsSystem: systemUser?.id === c.author.id,
    authorRoles: c.author.roles,
    audience: c.audience ?? null,
  }));

  const ctxText =
    typeof request.context === 'object' &&
    request.context !== null &&
    !Array.isArray(request.context) &&
    'summary' in request.context
      ? String((request.context as { summary?: unknown }).summary ?? '')
      : '';

  const canAct =
    isReviewer &&
    (request.status === 'unclaimed' ||
      request.status === 'claimed' ||
      request.status === 'in_review');
  const isClaimedByCaller = request.claimedByUserId === userId;
  const showClaim = canAct && request.status === 'unclaimed';
  const showResolve =
    canAct &&
    (request.status === 'claimed' || request.status === 'in_review') &&
    (isClaimedByCaller || hasAdmin);

  return (
    <main
      style={{
        padding: 'var(--space-6) var(--space-4)',
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}
    >
      <ArrowLink
        href="/requests"
        direction="back"
        testIdArea="requests"
        testIdSuffix="detail-back"
      >
        Back to Requests
      </ArrowLink>

      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: request.urgency
            ? 'var(--colour-urgent-subtle)'
            : 'var(--colour-surface-raised)',
          border: '1px solid var(--colour-border-subtle)',
          borderLeft: request.urgency ? '4px solid var(--colour-urgent)' : '4px solid transparent',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {request.urgency && (
            <span
              data-testid="requests-detail-urgent-badge"
              style={{
                fontSize: 'var(--text-2xs)',
                background: 'var(--colour-urgent)',
                color: 'var(--colour-urgent-contrast)',
                padding: '2px var(--space-2)',
                borderRadius: 'var(--radius-pill)',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              {request.kind?.displayName ?? 'Urgent'}
            </span>
          )}
          <strong>{TYPE_LABELS[request.type]}</strong>
          <span
            data-testid="requests-detail-status"
            style={{
              fontSize: 'var(--text-2xs)',
              padding: '2px var(--space-2)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--colour-surface-sunken)',
              textTransform: 'uppercase',
            }}
          >
            {STATUS_LABELS[request.status] ?? request.status}
          </span>
          <time
            dateTime={request.createdAt.toISOString()}
            style={{
              marginLeft: 'auto',
              fontSize: 'var(--text-xs)',
              color: 'var(--colour-text-secondary)',
            }}
            suppressHydrationWarning
          >
            {formatDistanceToNow(request.createdAt, { addSuffix: true })}
          </time>
        </div>
        {ctxText && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--colour-text-primary)',
            }}
          >
            {ctxText}
          </p>
        )}
        {request.createdBy && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--colour-text-secondary)' }}>
            Submitted by <strong>{request.createdBy.displayName}</strong>
            {request.claimedBy && (
              <>
                {' · Picked up by '}
                <strong>{request.claimedBy.displayName}</strong>
              </>
            )}
          </div>
        )}
        {showClaim && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <ClaimButton requestId={request.id} />
          </div>
        )}
        {showResolve && <ResolveForm requestId={request.id} />}
      </header>

      <section data-testid="requests-detail-thread-section">
        <h2
          className="gps-subtitle"
          style={{ marginBottom: 'var(--space-3)' }}
          data-testid="requests-detail-thread-title"
        >
          Discussion ({comments.length})
        </h2>
        <RequestDetailPanel
          requestId={request.id}
          comments={detailComments}
          isReviewer={isReviewer}
        />
      </section>
    </main>
  );
}
