'use client';

/**
 * @build-unit bu-coordination-board (Surface 2 — click-to-edit body)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Click-to-edit body. The body text itself (or "No description yet.")
 * is the click target — no separate Edit button.
 *
 *   - Click on body → swap to a textarea.
 *   - Cmd/Ctrl + Enter or blur → save.
 *   - Escape → cancel.
 *   - Plain Enter inserts a newline (multiline content).
 *   - A faint pencil icon sits next to the trigger as a hint.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode === 'editing') textareaRef.current?.focus();
  }, [mode]);

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
    const normalised = draft.trim() === '' ? null : draft;
    if ((normalised ?? null) === (initial ?? null)) {
      // No change — quietly leave edit mode without a server roundtrip.
      setError(null);
      setMode('idle');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await editBodyAction({
        requestId,
        groupSlug,
        groupId,
        body: normalised,
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
      <button
        type="button"
        data-testid="board-ticket-body-trigger"
        aria-label={initial ? 'Edit description' : 'Add description'}
        onClick={startEdit}
        className="gps-editable-trigger"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-2)',
          padding: 'var(--space-1) var(--space-2)',
          margin: 'calc(-1 * var(--space-1)) calc(-1 * var(--space-2))',
          width: 'calc(100% + 2 * var(--space-2))',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'text',
          textAlign: 'left',
          font: 'inherit',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <div data-testid="board-ticket-body-row" data-mode="idle" style={{ flex: 1, minWidth: 0 }}>
          {initial ? (
            <p
              data-testid="board-ticket-description-body"
              style={{
                margin: 0,
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
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--colour-text-secondary)',
                fontStyle: 'italic',
              }}
            >
              No description yet.
            </p>
          )}
        </div>
        <Pencil
          size={14}
          aria-hidden="true"
          data-testid="board-ticket-body-pencil"
          style={{
            color: 'var(--colour-text-tertiary)',
            flexShrink: 0,
            marginTop: 4,
          }}
        />
      </button>
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
        ref={textareaRef}
        data-testid="board-ticket-body-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={save}
        maxLength={BODY_MAX_LENGTH}
        rows={6}
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
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'center',
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-secondary)',
        }}
      >
        <span>⌘/Ctrl+Enter to save · Esc to cancel · click outside saves</span>
        {error && (
          <span
            role="alert"
            data-testid="board-ticket-body-error"
            style={{ color: 'var(--colour-danger)' }}
          >
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
