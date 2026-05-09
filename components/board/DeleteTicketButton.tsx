'use client';

/**
 * @build-unit bu-ticket-view-fixes (Sub-build B — Item 13)
 * @spec docs/build/session-briefs/bu-ticket-view-fixes.md
 *
 * Hard-delete affordance for the ticket lifecycle row. Visible only to
 * the originator or to system admins (gated at render time by the
 * server-rendered page; the server enforces the same gate on the
 * mutation, so a sneaky third-party still gets `forbidden`).
 *
 * Two clicks deep — primary button opens a confirmation modal,
 * confirm fires `deleteRequestAction`. On success the action returns
 * `redirectTo` (the originating group's matching lifecycle list);
 * the client `router.push`es there.
 *
 * Voice (per CLAUDE.md): calm + matter-of-fact, not panicky. "Delete
 * this ticket? This can't be undone." The destructive treatment is
 * carried by the red button colour, not by the copy.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteRequestAction } from '@/app/board/[groupSlug]/[ticketId]/actions';

export interface DeleteTicketButtonProps {
  requestId: string;
  groupSlug: string;
}

export function DeleteTicketButton({ requestId, groupSlug }: DeleteTicketButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    if (isPending) return;
    setOpen(false);
    setError(null);
  }

  function performDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRequestAction({ requestId, groupSlug });
      if (result.ok) {
        setOpen(false);
        if (result.redirectTo) {
          router.push(result.redirectTo);
        }
      } else {
        setError(result.error ?? 'Could not delete — try again.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        data-testid="board-ticket-delete-btn"
        aria-label="Delete this ticket"
        onClick={() => setOpen(true)}
        className="gps-btn gps-btn--ghost gps-btn--sm"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          color: 'var(--colour-danger)',
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
        Delete
      </button>

      {open && (
        <div
          data-testid="board-ticket-delete-backdrop"
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
            aria-labelledby="board-ticket-delete-title"
            data-testid="board-ticket-delete-dialog"
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
              id="board-ticket-delete-title"
              style={{
                margin: 0,
                fontSize: 'var(--text-lg)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Delete this ticket?
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--colour-text-secondary)',
              }}
            >
              This can't be undone. Comments, notes, assignments, follows, and shares will be
              removed too.
            </p>
            {error && (
              <p
                role="alert"
                data-testid="board-ticket-delete-error"
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
                data-testid="board-ticket-delete-cancel"
                onClick={close}
                disabled={isPending}
                className="gps-btn gps-btn--ghost gps-btn--sm"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="board-ticket-delete-confirm"
                onClick={performDelete}
                disabled={isPending}
                className="gps-btn gps-btn--danger gps-btn--sm"
              >
                {isPending ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
