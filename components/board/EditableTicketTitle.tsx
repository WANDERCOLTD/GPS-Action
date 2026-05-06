'use client';

/**
 * @build-unit bu-coordination-board (Surface 2 — click-to-edit title)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Click-to-edit title for the ticket-detail page.
 *
 *   - Idle: title text is itself the click target. A faint pencil
 *     icon sits to the right as a discoverability hint.
 *   - Click (or focus + Enter for keyboard): swap to an inline input.
 *   - Enter or blur: save. Escape: cancel.
 *
 * No separate "Edit" button — the title text *is* the affordance.
 * Permission ("any group member can edit") is enforced server-side
 * via `editTitleAction`; the click trigger renders unconditionally,
 * and a non-member's mutation surfaces an inline error.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'editing') inputRef.current?.focus();
  }, [mode]);

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
    if (trimmed.length === initial.trim().length && trimmed === initial.trim()) {
      // No change — quietly leave edit mode.
      setError(null);
      setMode('idle');
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
        <button
          type="button"
          data-testid="board-ticket-title-trigger"
          aria-label="Edit title"
          onClick={startEdit}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-2)',
            margin: 'calc(-1 * var(--space-1)) calc(-1 * var(--space-2))',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'text',
            textAlign: 'left',
            font: 'inherit',
            borderRadius: 'var(--radius-sm)',
          }}
          className="gps-editable-trigger"
        >
          <h1
            data-testid="board-ticket-title"
            style={{
              margin: 0,
              fontSize: 'var(--text-xl)',
              fontFamily: 'var(--font-ui)',
              display: 'inline-flex',
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
                  background: 'var(--colour-danger)',
                  flexShrink: 0,
                }}
              />
            )}
            {initial}
          </h1>
          <Pencil
            size={14}
            aria-hidden="true"
            data-testid="board-ticket-title-pencil"
            style={{
              color: 'var(--colour-text-tertiary)',
              flexShrink: 0,
            }}
          />
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
        ref={inputRef}
        type="text"
        data-testid="board-ticket-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={save}
        maxLength={TITLE_MAX_LENGTH}
        disabled={isPending}
        className="gps-input"
        style={{
          fontSize: 'var(--text-xl)',
          fontFamily: 'var(--font-ui)',
          width: '100%',
        }}
      />
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
  );
}
