/**
 * @build-unit BU-requests-foundation
 * @spec architecture/decision-log.md (D054)
 * @spec product/scenarios.md (SCN-21, SCN-22)
 *
 * Requests workspace — single tab containing both submitter and reviewer
 * views per D054. Submitter view ("My requests") shows the user's own
 * submitted Requests. Reviewer view shows the queue for any scopes the
 * user holds (queue_manager / queue_manager:vetting etc).
 *
 * Foundation BU: read-only display. Claim/resolve/comments arrive in
 * the urgent + vetting BUs.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { createTRPCContext } from '@/server/routers/context';
import { AppNav } from '@/components/AppNav';
import { ClaimButton, ResolveForm } from '@/components/RequestActionButtons';
import {
  listRequestsForSubmitter,
  listRequestsForReviewer,
  scopeToRequestType,
  type RequestListItem,
} from '@/server/services/request';
import type { RequestType } from '@prisma/client';

export const metadata = {
  title: 'Requests — GPS Action',
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
};

const STATUS_LABELS: Record<string, string> = {
  unclaimed: 'new',
  claimed: 'in discussion',
  in_review: 'in discussion',
  resolved: 'done',
  abandoned: 'abandoned',
};

function statusColour(status: string): string {
  switch (status) {
    case 'unclaimed':
      return 'var(--colour-info-subtle)';
    case 'claimed':
    case 'in_review':
      return 'var(--colour-warning-subtle)';
    case 'resolved':
      return 'var(--colour-success-subtle)';
    default:
      return 'var(--colour-surface-sunken)';
  }
}

interface RequestRowProps {
  row: RequestListItem;
  /** Whether the caller can act on this row (claim if unclaimed, resolve if claimed by caller). */
  canAct: boolean;
  callerId: string;
}

function RequestRow({ row, canAct, callerId }: RequestRowProps) {
  const ctxText =
    typeof row.context === 'object' &&
    row.context !== null &&
    !Array.isArray(row.context) &&
    'summary' in row.context
      ? String((row.context as { summary?: unknown }).summary ?? '')
      : '';

  const isClaimedByCaller = row.claimedByUserId === callerId;
  const showClaim = canAct && row.status === 'unclaimed';
  const showResolve =
    canAct && (row.status === 'claimed' || row.status === 'in_review') && isClaimedByCaller;

  return (
    <li
      data-testid="requests-row"
      data-request-id={row.id}
      data-urgent={row.urgency || undefined}
      style={{
        listStyle: 'none',
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--colour-border-subtle)',
        borderLeft: row.urgency ? '4px solid var(--colour-urgent)' : '4px solid transparent',
        background: row.urgency ? 'var(--colour-urgent-subtle)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}
      >
        {row.urgency && (
          <span
            data-testid="requests-row-urgent-badge"
            style={{
              fontSize: 'var(--text-2xs)',
              background: 'var(--colour-urgent)',
              color: 'var(--colour-urgent-contrast)',
              padding: '2px var(--space-2)',
              borderRadius: 'var(--radius-pill)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
            }}
          >
            {row.alertCategoryDisplayName ?? 'Urgent'}
          </span>
        )}
        <strong style={{ fontSize: 'var(--text-sm)' }}>{TYPE_LABELS[row.type]}</strong>
        <span
          style={{
            fontSize: 'var(--text-2xs)',
            background: statusColour(row.status),
            padding: '2px var(--space-2)',
            borderRadius: 'var(--radius-pill)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--text-xs)',
            color: 'var(--colour-text-secondary)',
          }}
        >
          {formatDistanceToNow(row.createdAt, { addSuffix: true })}
        </span>
      </div>
      {ctxText && (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--colour-text-secondary)' }}>
          {ctxText}
        </div>
      )}
      {row.claimedBy && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--colour-text-secondary)' }}>
          Picked up by <strong>{row.claimedBy.displayName}</strong>
        </div>
      )}
      {row.createdBy && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--colour-text-secondary)' }}>
          Submitted by <strong>{row.createdBy.displayName}</strong>
        </div>
      )}
      {row.resolutionNotes && (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--colour-text-secondary)',
            fontStyle: 'italic',
          }}
        >
          Resolved with note: {row.resolutionNotes}
        </div>
      )}
      {showClaim && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <ClaimButton requestId={row.id} />
        </div>
      )}
      {showResolve && <ResolveForm requestId={row.id} />}
    </li>
  );
}

export default async function RequestsPage() {
  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect('/dev/login?returnTo=/requests');
  }

  const userId = ctx.user.id;
  const hasUnscopedQueueManager = ctx.activeRoles.includes('queue_manager');
  const hasAdmin = ctx.activeRoles.includes('admin');
  const scopedTypes: RequestType[] = ctx.activeScopes
    .map(scopeToRequestType)
    .filter((t): t is RequestType => t !== null);

  const isReviewer = hasUnscopedQueueManager || hasAdmin || scopedTypes.length > 0;

  const [mine, queue] = await Promise.all([
    listRequestsForSubmitter(userId),
    isReviewer
      ? listRequestsForReviewer({
          callerId: userId,
          hasUnscopedQueueManager,
          hasAdmin,
          scopedTypes,
        })
      : Promise.resolve([] as RequestListItem[]),
  ]);

  return (
    <>
      <AppNav active="requests" hasReviewerAccess={isReviewer} />
      <main
        style={{
          padding: 'var(--space-6) var(--space-4)',
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
        }}
      >
        <h1 className="gps-title" data-testid="requests-page-title">
          Requests
        </h1>

        {/* Submitter section — always visible */}
        <section data-testid="requests-submitter-section">
          <h2
            className="gps-subtitle"
            style={{ marginBottom: 'var(--space-3)' }}
            data-testid="requests-submitter-title"
          >
            My requests ({mine.length})
          </h2>
          {mine.length === 0 ? (
            <p
              style={{ color: 'var(--colour-text-secondary)', fontSize: 'var(--text-sm)' }}
              data-testid="requests-submitter-empty"
            >
              Nothing to show. Things you submit (vetting, flags, edit requests) will appear here.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0 }}>
              {mine.map((r) => (
                <RequestRow key={r.id} row={r} canAct={false} callerId={userId} />
              ))}
            </ul>
          )}
        </section>

        {/* Reviewer section — only if caller has a reviewer scope */}
        {isReviewer && (
          <section data-testid="requests-reviewer-section">
            <h2
              className="gps-subtitle"
              style={{ marginBottom: 'var(--space-3)' }}
              data-testid="requests-reviewer-title"
            >
              Reviewer queue ({queue.length})
            </h2>
            <p
              style={{
                color: 'var(--colour-text-secondary)',
                fontSize: 'var(--text-xs)',
                marginBottom: 'var(--space-3)',
              }}
            >
              {hasAdmin || hasUnscopedQueueManager
                ? 'You see all Request types.'
                : `You see: ${scopedTypes.map((t) => TYPE_LABELS[t]).join(', ')}.`}
            </p>
            {queue.length === 0 ? (
              <p
                style={{ color: 'var(--colour-text-secondary)', fontSize: 'var(--text-sm)' }}
                data-testid="requests-reviewer-empty"
              >
                Nothing in the queue. New Requests will surface here.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0 }}>
                {queue.map((r) => (
                  <RequestRow key={r.id} row={r} canAct={true} callerId={userId} />
                ))}
              </ul>
            )}
            <p
              style={{
                marginTop: 'var(--space-4)',
                fontSize: 'var(--text-xs)',
                color: 'var(--colour-text-secondary)',
              }}
            >
              Foundation BU: read-only. Claim, comment, and resolve actions land in
              BU-requests-urgent and BU-requests-vetting.
            </p>
          </section>
        )}

        <div
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--colour-border-subtle)',
          }}
        >
          <Link
            href="/feed"
            data-testid="requests-back-feed-link"
            style={{
              color: 'var(--colour-text-link)',
              fontSize: 'var(--text-sm)',
              textDecoration: 'none',
            }}
          >
            ← Back to feed
          </Link>
        </div>
      </main>
    </>
  );
}
