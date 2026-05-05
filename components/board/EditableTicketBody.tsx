'use client';

/**
 * @build-unit bu-coordination-board (build seq #5 — Surface 2, PR #5c)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Click-to-edit description body. Idle state renders the body (or a
 * placeholder when null) with an Edit affordance; edit mode swaps in
 * a textarea + Save / Cancel. Save calls `editBodyAction`, which
 * writes via `board.editBody` (audit-logged, whitespace-only collapses
 * to null) and revalidates the route.
 */

import { useState, useTransition } from 'react';
import { editBodyAction } from '@/app/board/[groupSlug]/[ticketId]/actions';

const BODY_MAX_LENGTH = 10000;

export interface EditableTicketBodyProps {
  requestId: string;
  groupSlug: string;
  groupId: string;
  initial: string | null;
}

export function EditableTicketBody({
  requestId,
  groupSlug,
  groupId,
  initial,
}: EditableTicketBodyProps) {
  const [mode, setMode] = useState<'idle' | 'editing'>('idle');
  const [draft, setDraft] = useState(initial ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(initial ?? '');
    setError(null);
    setMode('editing');
  }

  function cancel() {
    setDraft(initial ?? '');
    setError(null);
    setMode('idle');
  }

  function save() {
    if (draft.length > BODY_MAX_LENGTH) {
      setError(`Description is too long (max ${BODY_MAX_LENGTH}).`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await editBodyAction({
        requestId,
        groupSlug,
        groupId,
        body: draft.trim() === '' ? null : draft,
      });
      if (result.ok) {
        setMode('idle');
      } else {
        setError(result.error ?? 'Could not save — try again.');
      }
    });
  }

  if (mode === 'idle') {
    return (
      <div data-testid="board-ticket-body-row" data-mode="idle">
        {initial ? (
          <p
            data-testid="board-ticket-description-body"
            style={{
              margin: '0 0 var(--space-2) 0',
              fontSize: 'var(--text-md)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {initial}
          </p>
        ) : (
          <p
            data-testid="board-ticket-description-empty"
            style={{
              margin: '0 0 var(--space-2) 0',
              fontSize: 'var(--text-sm)',
              color: 'var(--colour-text-secondary)',
              fontStyle: 'italic',
            }}
          >
            No description yet.
          </p>
        )}
        <button
          type="button"
          data-testid="board-ticket-body-edit-btn"
          onClick={startEdit}
          className="gps-btn gps-btn--ghost gps-btn--sm"
        >
          {initial ? 'Edit description' : 'Add description'}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="board-ticket-body-row"
      data-mode="editing"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <textarea
        data-testid="board-ticket-body-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={BODY_MAX_LENGTH}
        rows={6}
        autoFocus
        disabled={isPending}
        placeholder="Describe what needs to happen…"
        className="gps-input"
        style={{
          fontSize: 'var(--text-md)',
          width: '100%',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <button
          type="button"
          data-testid="board-ticket-body-save-btn"
          onClick={save}
          disabled={isPending}
          className="gps-btn gps-btn--primary gps-btn--sm"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          data-testid="board-ticket-body-cancel-btn"
          onClick={cancel}
          disabled={isPending}
          className="gps-btn gps-btn--ghost gps-btn--sm"
        >
          Cancel
        </button>
        {error && (
          <span
            role="alert"
            data-testid="board-ticket-body-error"
            style={{ color: 'var(--colour-danger)', fontSize: 'var(--text-xs)' }}
          >
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
