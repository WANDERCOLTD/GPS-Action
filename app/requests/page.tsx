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
import { listNotificationsForUser, countUnreadForUser } from '@/server/services/notification';
import { createTRPCContext } from '@/server/routers/context';
import { RequestRow } from '@/components/RequestRow';
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
  kind_review: 'Post review',
};

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

  const [mine, queue, notifications, unreadCount] = await Promise.all([
    listRequestsForSubmitter(userId),
    isReviewer
      ? listRequestsForReviewer({
          callerId: userId,
          hasUnscopedQueueManager,
          hasAdmin,
          scopedTypes,
        })
      : Promise.resolve([] as RequestListItem[]),
    listNotificationsForUser({ userId, limit: 20 }),
    countUnreadForUser(userId),
  ]);

  return (
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

      {/* Notifications section (BU-requests-vetting / D057) — only when there are any */}
      {notifications.length > 0 && (
        <section data-testid="requests-notifications-section">
          <h2
            className="gps-subtitle"
            style={{ marginBottom: 'var(--space-3)' }}
            data-testid="requests-notifications-title"
          >
            Notifications{' '}
            {unreadCount > 0 && (
              <span style={{ color: 'var(--colour-urgent)' }}>({unreadCount} new)</span>
            )}
          </h2>
          <ul
            style={{
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
            data-testid="requests-notifications-list"
          >
            {notifications.slice(0, 5).map((n) => (
              <li
                key={n.id}
                data-testid="requests-notifications-row"
                data-notification-id={n.id}
                data-unread={n.readAt === null || undefined}
                style={{
                  listStyle: 'none',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  background:
                    n.readAt === null
                      ? 'var(--colour-warning-subtle)'
                      : 'var(--colour-surface-raised)',
                  border: '1px solid var(--colour-border-subtle)',
                  fontSize: 'var(--text-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <span style={{ flex: 1 }}>
                  <strong>{n.fromDisplayName ?? 'Someone'}</strong>{' '}
                  {n.type === 'request_mention' && 'mentioned you in a request'}
                  {n.type === 'request_status_changed' && 'updated your request'}
                  {n.type === 'request_resolved' && 'resolved your request'}
                  {n.type === 'request_published' && 'published your draft'}
                  {n.type === 'request_archived' && 'archived your draft'}
                </span>
                {n.requestId && (
                  <Link
                    href={`/requests/${n.requestId}`}
                    data-testid="requests-notifications-open-link"
                    style={{
                      color: 'var(--colour-text-link)',
                      fontSize: 'var(--text-xs)',
                      textDecoration: 'none',
                    }}
                  >
                    Open →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
            Foundation BU: read-only. Claim, comment, and resolve actions land in BU-requests-urgent
            and BU-requests-vetting.
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
  );
}
