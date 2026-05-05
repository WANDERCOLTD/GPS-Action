'use client';

/**
 * @build-unit bu-coordination-board (Surface 1 — header `+ Propose` button)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Outline button + simple modal-form for proposing a new ticket into the
 * backlog. The brief calls this "+ Propose to backlog" — the resulting
 * Request lands in `status: 'backlog'`, off-board, ready to drag onto
 * the Active grid via the existing kanban move primitive.
 *
 * Idle state: outline button. Open state: lightweight modal with a
 * title input (required) + body textarea (optional). Submit calls
 * `proposeTicketAction`; on `{ ok: true }` we close the modal and the
 * Server Action's revalidatePath refreshes the board route.
 */

import { useRef, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { proposeTicketAction } from '@/app/board/[groupSlug]/actions';

const TITLE_MAX = 200;
const BODY_MAX = 10000;

export interface ProposeTicketButtonProps {
  groupId: string;
  groupSlug: string;
}

export function ProposeTicketButton({ groupId, groupSlug }: ProposeTicketButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  function reset() {
    setTitle('');
    setBody('');
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function submit() {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setError('Give your ticket a title.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await proposeTicketAction({
        groupId,
        groupSlug,
        title: trimmed,
        body: body.trim() === '' ? null : body,
      });
      if (result.ok) {
        close();
      } else {
        setError(result.error ?? 'Could not propose ticket — try again.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        data-testid="board-propose-btn"
        onClick={() => setOpen(true)}
        className="gps-btn gps-btn--ghost gps-btn--sm"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
      >
        <Plus size={14} aria-hidden="true" />
        Propose to backlog
      </button>

      {open && (
        <div
          data-testid="board-propose-dialog-backdrop"
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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="board-propose-title"
            data-testid="board-propose-dialog"
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
            <h2
              id="board-propose-title"
              style={{
                margin: 0,
                fontSize: 'var(--text-lg)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Propose a ticket
            </h2>

            <label
              data-testid="board-propose-title-label"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span style={{ color: 'var(--colour-text-secondary)' }}>Title</span>
              <input
                type="text"
                data-testid="board-propose-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                disabled={isPending}
                autoFocus
                placeholder="What needs doing?"
                className="gps-input"
                style={{ fontSize: 'var(--text-md)' }}
              />
            </label>

            <label
              data-testid="board-propose-body-label"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span style={{ color: 'var(--colour-text-secondary)' }}>
                Description <em style={{ fontStyle: 'normal' }}>(optional)</em>
              </span>
              <textarea
                data-testid="board-propose-body-input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={BODY_MAX}
                rows={4}
                disabled={isPending}
                placeholder="Add context — links, deadline, anything useful…"
                className="gps-input"
                style={{
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {error && (
                <span
                  role="alert"
                  data-testid="board-propose-error"
                  style={{
                    color: 'var(--colour-danger)',
                    fontSize: 'var(--text-xs)',
                    marginRight: 'auto',
                  }}
                >
                  {error}
                </span>
              )}
              <button
                type="button"
                data-testid="board-propose-cancel-btn"
                onClick={close}
                disabled={isPending}
                className="gps-btn gps-btn--ghost gps-btn--sm"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="board-propose-submit-btn"
                onClick={submit}
                disabled={isPending}
                className="gps-btn gps-btn--primary gps-btn--sm"
              >
                {isPending ? 'Proposing…' : 'Add to backlog'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
