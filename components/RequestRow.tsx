'use client';

/**
 * @build-unit BU-requests-foundation
 * @spec architecture/decision-log.md (D052, D054)
 *
 * Single Request row for the workspace list. Tap-card-to-detail
 * navigates to /requests/[id], matching the PostCard pattern (D052):
 * the row's onClick checks `event.target.closest('a, button, …')` and
 * bails if the click landed on an interactive child (Claim, Resolve
 * form, etc.) so those keep their own action.
 */

import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ClaimButton, ResolveForm } from '@/components/RequestActionButtons';
import { UserAvatar } from '@/components/UserAvatar';
import type { RequestListItem } from '@/server/services/request';
import type { RequestType } from '@prisma/client';

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

// Tone mapping for the type chip — shares the project's gps-chip palette
// (filter strip, kind chips, role chips) so the requests row reads with
// the same visual language as a PostCard's kind chip.
const TYPE_TONES: Record<RequestType, string> = {
  vetting: 'gps-chip--info',
  flag: 'gps-chip--warning',
  outcome_review: 'gps-chip--info',
  dedup_merge: 'gps-chip--neutral',
  edit_request: 'gps-chip--neutral',
  incident: 'gps-chip--urgent',
  content_submission: 'gps-chip--primary',
  link_submission: 'gps-chip--primary',
  kind_review: 'gps-chip--info',
};

const STATUS_LABELS: Record<string, string> = {
  unclaimed: 'new',
  claimed: 'in discussion',
  in_review: 'in discussion',
  resolved: 'done',
  abandoned: 'abandoned',
};

// Map each status to a `gps-chip--<tone>` modifier so the row pills
// share the project's chip palette (filter strip, kind chips, role
// chips). One source of truth for tone tokens.
function statusToneClass(status: string): string {
  switch (status) {
    case 'unclaimed':
      return 'gps-chip--info';
    case 'claimed':
    case 'in_review':
      return 'gps-chip--warning';
    case 'resolved':
      return 'gps-chip--success';
    default:
      return '';
  }
}

export interface RequestRowProps {
  row: RequestListItem;
  /** Whether the caller can act on this row (claim if unclaimed, resolve if claimed by caller). */
  canAct: boolean;
  callerId: string;
}

const INTERACTIVE_SELECTOR = 'a, button, input, label, form, textarea';

export function RequestRow({ row, canAct, callerId }: RequestRowProps) {
  const router = useRouter();

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

  const href = `/requests/${row.id}`;

  function navigate() {
    router.push(href);
  }

  function handleClick(event: ReactMouseEvent<HTMLLIElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    navigate();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLLIElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    event.preventDefault();
    navigate();
  }

  const ariaLabel = `Open request: ${TYPE_LABELS[row.type]}${ctxText ? ` — ${ctxText}` : ''}`;

  return (
    <li
      data-testid="requests-row-card"
      data-request-id={row.id}
      data-urgent={row.urgency || undefined}
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        listStyle: 'none',
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--colour-border-subtle)',
        borderLeft: row.urgency ? '4px solid var(--colour-urgent)' : '4px solid transparent',
        background: row.urgency ? 'var(--colour-urgent-subtle)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        cursor: 'pointer',
      }}
    >
      {/* Top row — type chip + (priority chip slot) + urgent badge.
       * Status chip + timestamp move to the metadata row at the bottom
       * so the eye reads:
       *   chips → byline → primary content → metadata
       * matching the PostCard hierarchy on /feed. */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}
      >
        {row.urgency && (
          <span
            data-testid="requests-row-urgent-badge"
            className="gps-chip gps-chip--static gps-chip--urgent"
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
              background: 'var(--colour-urgent)',
              color: 'var(--colour-urgent-contrast)',
            }}
          >
            {row.kindDisplayName ?? 'Urgent'}
          </span>
        )}
        <span
          data-testid="requests-row-type-chip"
          data-type={row.type}
          className={`gps-chip gps-chip--static ${TYPE_TONES[row.type]}`}
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontWeight: 700,
          }}
        >
          {TYPE_LABELS[row.type]}
        </span>
      </div>
      {row.createdBy && (
        <div
          data-testid="requests-row-submitter-byline"
          data-user-id={row.createdBy.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
          }}
        >
          <UserAvatar
            userId={row.createdBy.id}
            displayName={row.createdBy.displayName}
            avatarUrl={row.createdBy.avatarUrl}
            size={22}
          />
          <span>
            <strong style={{ color: 'var(--colour-text-primary)' }}>
              {row.createdBy.displayName}
            </strong>
            <span style={{ marginLeft: 'var(--space-1)' }}>submitted this</span>
          </span>
        </div>
      )}
      {/* Primary content — promoted to var(--text-base) primary text so
       * the actual "what is this request about" is the most readable
       * line in the row. Falls back to the type label so an empty card
       * never looks blank. */}
      <div
        data-testid="requests-row-summary"
        data-empty={ctxText ? undefined : true}
        style={{
          fontSize: 'var(--text-base)',
          color: 'var(--colour-text-primary)',
          lineHeight: 1.4,
          marginTop: 'var(--space-1)',
        }}
      >
        {ctxText || TYPE_LABELS[row.type]}
      </div>
      {/* Metadata row — timestamp + status + claimed-by, all subdued. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-secondary)',
          marginTop: 'var(--space-1)',
        }}
      >
        <time dateTime={row.createdAt.toISOString()} suppressHydrationWarning>
          {formatDistanceToNow(row.createdAt, { addSuffix: true })}
        </time>
        <span
          className={`gps-chip gps-chip--static ${statusToneClass(row.status)}`}
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
        {row.claimedBy && (
          <span>
            Picked up by{' '}
            <strong style={{ color: 'var(--colour-text-primary)' }}>
              {row.claimedBy.displayName}
            </strong>
          </span>
        )}
      </div>
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
