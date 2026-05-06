'use client';

/**
 * @build-unit bu-coordination-board (Surface 1 — Backlog ghost-card add)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Per-list ghost-card add affordance for the Backlog tab. Same idle/
 * active visual pattern as `QuickAddCard` (the per-column primitive
 * on the Active grid), but routes through `proposeTicketAction` so
 * the new ticket lands in `status: backlog` (off-board, columnId=null)
 * — matching the existing `+ Propose to backlog` header button.
 *
 * Header button stays for screen-reader/keyboard discoverability;
 * this ghost card is the visually-discoverable "add another" at the
 * end of the list.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { proposeTicketAction } from '@/app/board/[groupSlug]/actions';

const TITLE_MAX = 200;

export interface BacklogQuickAddProps {
  groupId: string;
  groupSlug: string;
}

export function BacklogQuickAdd({ groupId, groupSlug }: BacklogQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function reset() {
    setTitle('');
    setError(null);
    setOpen(false);
  }

  function submit() {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setError('Give the card a title.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await proposeTicketAction({
        groupId,
        groupSlug,
        title: trimmed,
        body: null,
      });
      if (result.ok) {
        reset();
      } else {
        setError(result.error ?? 'Could not add card — try again.');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="board-backlog-quick-add-trigger"
        aria-label="Add card to backlog"
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--colour-border-strong)',
          background: 'transparent',
          color: 'var(--colour-text-secondary)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <Plus size={14} aria-hidden="true" />
        <span>Add to backlog</span>
      </button>
    );
  }

  return (
    <div
      data-testid="board-backlog-quick-add-form"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--colour-surface-raised)',
        border: '1px solid var(--colour-border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        data-testid="board-backlog-quick-add-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            reset();
          }
        }}
        maxLength={TITLE_MAX}
        disabled={isPending}
        placeholder="What needs doing?"
        className="gps-input"
        style={{ fontSize: 'var(--text-sm)' }}
      />
      {error && (
        <span
          role="alert"
          data-testid="board-backlog-quick-add-error"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--colour-danger)' }}
        >
          {error}
        </span>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <button
          type="button"
          data-testid="board-backlog-quick-add-cancel"
          onClick={reset}
          disabled={isPending}
          className="gps-btn gps-btn--ghost gps-btn--sm"
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="board-backlog-quick-add-submit"
          onClick={submit}
          disabled={isPending}
          className="gps-btn gps-btn--primary gps-btn--sm"
        >
          {isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  );
}
