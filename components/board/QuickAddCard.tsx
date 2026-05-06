'use client';

/**
 * @build-unit bu-coordination-board (Surface 1 — quick-add per column)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Per-column quick-add affordance. Renders at the bottom of every
 * column on desktop as a dotted-line "ghost card" with a `+` icon
 * and "Add card" muted label — the Trello/Asana pattern that reads
 * as the natural next step after the last real card.
 *
 * Mobile (≤768px, B1 reflow): collapses to a small `+ Add card` line
 * at the bottom of each section so the stacked vertical layout
 * doesn't get noisy with full ghost cards between sections.
 *
 * Click the idle state → inline title input + Add / Cancel buttons.
 * Submit (or Enter) calls `quickAddCardAction`. Empty title → no-op.
 * On success the route revalidates and the new card appears in place
 * (server-side render).
 *
 * Coexists with `+ Propose to backlog` in the page header — that
 * path lands a card in backlog for triage; this one drops directly
 * into the named column. Two intents, one app.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { quickAddCardAction } from '@/app/board/[groupSlug]/actions';

const TITLE_MAX = 200;

export interface QuickAddCardProps {
  groupId: string;
  groupSlug: string;
  columnId: string;
  columnDisplayName: string;
}

export function QuickAddCard({
  groupId,
  groupSlug,
  columnId,
  columnDisplayName,
}: QuickAddCardProps) {
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
      const result = await quickAddCardAction({
        groupId,
        groupSlug,
        columnId,
        title: trimmed,
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
        data-testid="board-quick-add-trigger"
        data-column-id={columnId}
        aria-label={`Add card to ${columnDisplayName}`}
        onClick={() => setOpen(true)}
        onPointerDown={(e) => e.stopPropagation()}
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
        }}
      >
        <Plus size={14} aria-hidden="true" />
        <span>Add card</span>
      </button>
    );
  }

  return (
    <div
      data-testid="board-quick-add-form"
      data-column-id={columnId}
      onPointerDown={(e) => e.stopPropagation()}
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
        data-testid="board-quick-add-input"
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
        placeholder={`What needs doing in ${columnDisplayName}?`}
        className="gps-input"
        style={{ fontSize: 'var(--text-sm)' }}
      />
      {error && (
        <span
          role="alert"
          data-testid="board-quick-add-error"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--colour-danger)' }}
        >
          {error}
        </span>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <button
          type="button"
          data-testid="board-quick-add-cancel"
          onClick={reset}
          disabled={isPending}
          className="gps-btn gps-btn--ghost gps-btn--sm"
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="board-quick-add-submit"
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
