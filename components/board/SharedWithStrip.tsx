'use client';

/**
 * @build-unit bu-ticket-view-fixes (Sub-build B — Item 4 · Sub-build D — Item 5)
 * @spec docs/build/session-briefs/bu-ticket-view-fixes.md
 *
 * The "Shared with: <Team> · <Team>" pill row on the ticket-detail
 * view. Each non-originating pill carries an `×` button; tapping it
 * opens a confirmation modal ("Remove this share with <Team>?") and
 * on confirm fires `unshareFromTeamAction`. After success the page's
 * `revalidatePath` refreshes the strip — no client-side optimism here
 * (matches the rest of the ticket-detail mutation pattern).
 *
 * Permission for the unshare itself is enforced server-side per Q1:
 * originating-team members + receiving-team members + admins all
 * succeed. Receiving-team self-unshare is idempotent. The UI shows
 * the × on every non-originating pill regardless of viewer role; the
 * server is the source of truth for whether the action is allowed.
 *
 * Sub-build D (Item 5): the originating team is dropped from the strip
 * entirely. The breadcrumb / page chrome already names the originating
 * team ("← Writers board"), so showing it again as a pill was redundant
 * noise. If `groups` resolves to an empty list after the filter, the
 * component renders nothing — no "Not shared with any other teams"
 * placeholder; the adjacent Share-with-team button is the affordance
 * for that state.
 */

import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { unshareFromTeamAction } from '@/app/board/[groupSlug]/[ticketId]/actions';

export interface SharedWithGroup {
  groupId: string;
  slug: string;
  displayName: string;
  origin: 'originating' | 'workflow_share' | 'ad_hoc_share';
}

export interface SharedWithStripProps {
  requestId: string;
  groupSlug: string;
  groups: SharedWithGroup[];
}

interface ConfirmState {
  groupId: string;
  displayName: string;
}

export function SharedWithStrip({ requestId, groupSlug, groups }: SharedWithStripProps) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Item 5 (Sub-build D): drop the originating team from the rendered
  // pills. Breadcrumb is the source of truth for which team owns the
  // ticket; doubling it here is redundant.
  const visibleGroups = groups.filter((g) => g.origin !== 'originating');

  if (visibleGroups.length === 0 && !confirm) {
    return null;
  }

  function openConfirm(g: SharedWithGroup) {
    setError(null);
    setConfirm({ groupId: g.groupId, displayName: g.displayName });
  }

  function closeConfirm() {
    if (isPending) return;
    setConfirm(null);
    setError(null);
  }

  function performUnshare() {
    if (!confirm) return;
    setError(null);
    startTransition(async () => {
      const result = await unshareFromTeamAction({
        requestId,
        groupSlug,
        targetGroupId: confirm.groupId,
      });
      if (result.ok) {
        setConfirm(null);
      } else {
        setError(result.error ?? 'Could not unshare — try again.');
      }
    });
  }

  return (
    <>
      <ul
        data-testid="board-ticket-shared-with-list"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        {visibleGroups.map((g) => (
          <li
            key={g.groupId}
            data-testid="board-ticket-shared-with-pill"
            data-origin={g.origin}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: '4px 4px 4px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--colour-surface-raised)',
              border: '1px solid var(--colour-border-subtle)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span>{g.displayName}</span>
            <button
              type="button"
              data-testid="board-ticket-shared-with-unshare-btn"
              data-target-group-id={g.groupId}
              aria-label={`Remove share with ${g.displayName}`}
              title={`Remove share with ${g.displayName}`}
              onClick={() => openConfirm(g)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                padding: 0,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--colour-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {confirm && (
        <div
          data-testid="board-ticket-unshare-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConfirm();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--colour-surface-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 'var(--space-4)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="board-ticket-unshare-title"
            data-testid="board-ticket-unshare-dialog"
            style={{
              background: 'var(--colour-surface-raised)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--colour-border-subtle)',
              padding: 'var(--space-4)',
              maxWidth: 420,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <h2
              id="board-ticket-unshare-title"
              style={{
                margin: 0,
                fontSize: 'var(--text-lg)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Remove share?
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--colour-text-secondary)',
              }}
            >
              Remove this share with <strong>{confirm.displayName}</strong>? They'll lose access to
              this ticket on their board.
            </p>
            {error && (
              <p
                role="alert"
                data-testid="board-ticket-unshare-error"
                style={{
                  margin: 0,
                  color: 'var(--colour-danger)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {error}
              </p>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-2)',
              }}
            >
              <button
                type="button"
                data-testid="board-ticket-unshare-cancel"
                onClick={closeConfirm}
                disabled={isPending}
                className="gps-btn gps-btn--ghost gps-btn--sm"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="board-ticket-unshare-confirm"
                onClick={performUnshare}
                disabled={isPending}
                className="gps-btn gps-btn--danger gps-btn--sm"
              >
                {isPending ? '…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
