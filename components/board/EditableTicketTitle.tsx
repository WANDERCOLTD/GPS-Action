'use client';

/**
 * @build-unit bu-coordination-board (build seq #5 — Surface 2, PR #5c)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Click-to-edit title row for the ticket-detail page. Idle state
 * renders the title with an "Edit" affordance; clicking enters edit
 * mode (input + Save / Cancel). The save path calls the
 * `editTitleAction` server action which writes via `board.editTitle`,
 * audit-logs the change, and revalidates the ticket route — the
 * server then re-renders with the new title.
 *
 * Permission ("any group member can edit") is enforced server-side;
 * the component renders the edit button unconditionally. If a
 * non-member somehow lands here, the mutation throws and the inline
 * error surfaces.
 */

import { useState, useTransition } from 'react';
import { editTitleAction } from '@/app/board/[groupSlug]/[ticketId]/actions';

const TITLE_MAX_LENGTH = 200;

export interface EditableTicketTitleProps {
  requestId: string;
  groupSlug: string;
  groupId: string;
  initial: string;
  /** Render the urgent dot adjacent to the title. */
  urgent: boolean;
}

export function EditableTicketTitle({
  requestId,
  groupSlug,
  groupId,
  initial,
  urgent,
}: EditableTicketTitleProps) {
  const [mode, setMode] = useState<'idle' | 'editing'>('idle');
  const [draft, setDraft] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(initial);
    setError(null);
    setMode('editing');
  }

  function cancel() {
    setDraft(initial);
    setError(null);
    setMode('idle');
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError('Title cannot be empty.');
      return;
    }
    if (trimmed.length > TITLE_MAX_LENGTH) {
      setError(`Title is too long (max ${TITLE_MAX_LENGTH}).`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await editTitleAction({
        requestId,
        groupSlug,
        groupId,
        title: trimmed,
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
      <div
        data-testid="board-ticket-title-row"
        data-mode="idle"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
        }}
      >
        <h1
          data-testid="board-ticket-title"
          style={{
            margin: 0,
            fontSize: 'var(--text-xl)',
            fontFamily: 'var(--font-ui)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {urgent && (
            <span
              data-testid="board-ticket-urgent-dot"
              aria-label="Urgent"
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--colour-danger-strong)',
                flexShrink: 0,
              }}
            />
          )}
          {initial}
        </h1>
        <button
          type="button"
          data-testid="board-ticket-title-edit-btn"
          onClick={startEdit}
          className="gps-btn gps-btn--ghost gps-btn--sm"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="board-ticket-title-row"
      data-mode="editing"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <input
        type="text"
        data-testid="board-ticket-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={TITLE_MAX_LENGTH}
        autoFocus
        disabled={isPending}
        className="gps-input"
        style={{
          fontSize: 'var(--text-xl)',
          fontFamily: 'var(--font-ui)',
          width: '100%',
        }}
      />
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <button
          type="button"
          data-testid="board-ticket-title-save-btn"
          onClick={save}
          disabled={isPending}
          className="gps-btn gps-btn--primary gps-btn--sm"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          data-testid="board-ticket-title-cancel-btn"
          onClick={cancel}
          disabled={isPending}
          className="gps-btn gps-btn--ghost gps-btn--sm"
        >
          Cancel
        </button>
        {error && (
          <span
            role="alert"
            data-testid="board-ticket-title-error"
            style={{ color: 'var(--colour-danger)', fontSize: 'var(--text-xs)' }}
          >
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
