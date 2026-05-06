'use client';

/**
 * @build-unit bu-coordination-board (Surface 2 — atom 5e)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Share-with-team picker. Outline button on Surface 2; opens a modal
 * listing the workflow allow-list targets (per `GroupShareWorkflow`)
 * minus any group already linked to the ticket. Picking a target
 * fires `shareWithTeamAction` which calls `share.toGroup` in
 * `mode: 'workflow'` and revalidates the ticket route so the new
 * share appears in the "Shared with" pill row.
 *
 * Ad-hoc share (admin-only, picks any group) is deferred — see the
 * brief's Surface 2 description: this picker is the "single share
 * control" but workflow targets are the v1 surface. Ad-hoc lands as
 * a follow-up atom alongside the all-groups search.
 */

import { useState, useTransition } from 'react';
import { Users, X } from 'lucide-react';
import { shareWithTeamAction } from '@/app/board/[groupSlug]/[ticketId]/actions';

export interface ShareWithTeamTarget {
  groupId: string;
  displayName: string;
  slug: string;
}

export interface ShareWithTeamButtonProps {
  requestId: string;
  groupSlug: string;
  /** Viewer's current group — drives workflow lookup at the source side. */
  sourceGroupId: string;
  /**
   * Workflow allow-list targets minus any group already linked to the
   * ticket. Empty means there's nothing to share with — button still
   * renders (so admins can see something exists) but is disabled.
   */
  availableTargets: ShareWithTeamTarget[];
}

export function ShareWithTeamButton({
  requestId,
  groupSlug,
  sourceGroupId,
  availableTargets,
}: ShareWithTeamButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const noTargets = availableTargets.length === 0;

  function close() {
    setOpen(false);
    setError(null);
  }

  function pick(targetGroupId: string) {
    setError(null);
    startTransition(async () => {
      const result = await shareWithTeamAction({
        requestId,
        groupSlug,
        sourceGroupId,
        targetGroupId,
      });
      if (result.ok) {
        close();
      } else {
        setError(result.error ?? 'Could not share — try again.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        data-testid="board-share-team-btn"
        onClick={() => setOpen(true)}
        disabled={noTargets}
        title={noTargets ? 'No teams configured for sharing yet' : undefined}
        className="gps-btn gps-btn--ghost gps-btn--sm"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
      >
        <Users size={14} aria-hidden="true" />
        Share with team
      </button>

      {open && (
        <div
          data-testid="board-share-team-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
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
            aria-labelledby="board-share-team-title"
            data-testid="board-share-team-dialog"
            style={{
              background: 'var(--colour-surface-raised)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--colour-border-subtle)',
              padding: 'var(--space-4)',
              maxWidth: 480,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <h2
                id="board-share-team-title"
                style={{
                  margin: 0,
                  flex: 1,
                  fontSize: 'var(--text-lg)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Share with team
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                data-testid="board-share-team-close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 'var(--space-1)',
                  color: 'var(--colour-text-secondary)',
                }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--colour-text-secondary)',
              }}
            >
              Pick a team to share this ticket with. They'll see it on their board with their own
              per-team state.
            </p>

            <ul
              data-testid="board-share-team-target-list"
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              {availableTargets.map((t) => (
                <li key={t.groupId}>
                  <button
                    type="button"
                    onClick={() => pick(t.groupId)}
                    disabled={isPending}
                    data-testid="board-share-team-target"
                    data-target-group-id={t.groupId}
                    className="gps-btn gps-btn--secondary"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                    }}
                  >
                    {t.displayName}
                  </button>
                </li>
              ))}
            </ul>

            {error && (
              <p
                role="alert"
                data-testid="board-share-team-error"
                style={{
                  margin: 0,
                  color: 'var(--colour-danger)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
