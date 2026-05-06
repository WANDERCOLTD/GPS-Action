'use client';

/**
 * @build-unit bu-coordination-board (Surface 1 — mobile tag-pill switcher, PR #7 atom B2)
 * @spec docs/build/session-briefs/bu-coordination-board.md (lines 109-112)
 * @handoff docs/build/session-handoffs/bu-coordination-board-mobile-2026-05-06.md
 *
 * Mobile-only column-switch primitive. Each kanban card renders a
 * tinted pill showing its current column. Tapping the pill opens a
 * sheet listing the group's columns; picking one calls
 * `moveCardAction` (the same server action `BoardGrid` uses for
 * drag-end). The pill replaces drag for column moves on touch
 * devices — drag is still wired but mobile users get this primary
 * path because horizontal drag across stacked vertical sections
 * isn't a usable gesture.
 *
 * Visibility is class-driven: `.gps-mobile-tag-switcher` is
 * `display: none` by default and flips to `inline-flex` under
 * `@media (max-width: 768px)` (matching the B1 reflow breakpoint).
 *
 * Colour key: position-based palette (col 1 yellow, col 2 blue,
 * col 3 brand, col 4 green, col 5+ neutral). Hard-coded — admin-set
 * per-column colours can be a follow-up if Sharon-warmth needs
 * more nuance.
 */

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { moveCardAction } from '@/app/board/[groupSlug]/actions';

export interface MobileTagSwitcherColumn {
  id: string;
  displayName: string;
}

export interface MobileTagSwitcherProps {
  requestId: string;
  groupId: string;
  groupSlug: string;
  currentColumnId: string;
  columns: MobileTagSwitcherColumn[];
}

const PALETTE: Array<{ tint: string; bg: string }> = [
  {
    tint: 'var(--colour-warning)',
    bg: 'color-mix(in srgb, var(--colour-warning) 14%, transparent)',
  },
  { tint: 'var(--colour-info)', bg: 'color-mix(in srgb, var(--colour-info) 14%, transparent)' },
  {
    tint: 'var(--colour-primary)',
    bg: 'color-mix(in srgb, var(--colour-primary) 14%, transparent)',
  },
  {
    tint: 'var(--colour-success)',
    bg: 'color-mix(in srgb, var(--colour-success) 14%, transparent)',
  },
];

const NEUTRAL = {
  tint: 'var(--colour-text-secondary)',
  bg: 'var(--colour-surface-sunken)',
};

export function paletteForIndex(index: number): { tint: string; bg: string } {
  return PALETTE[index] ?? NEUTRAL;
}

export function MobileTagSwitcher({
  requestId,
  groupId,
  groupSlug,
  currentColumnId,
  columns,
}: MobileTagSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentIndex = columns.findIndex((c) => c.id === currentColumnId);
  const current = currentIndex >= 0 ? columns[currentIndex] : null;
  const palette = paletteForIndex(currentIndex);

  if (!current) return null;

  function pick(targetColumnId: string) {
    if (targetColumnId === currentColumnId) {
      setOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await moveCardAction({
        requestId,
        groupId,
        groupSlug,
        destination: { lane: 'active', columnId: targetColumnId },
        beforeRequestId: null,
        afterRequestId: null,
      });
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.error ?? 'Could not move the card — try again.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="gps-mobile-tag-switcher"
        data-testid="board-card-mobile-tag-pill"
        data-column-id={currentColumnId}
        aria-label={`Move card. Current column: ${current.displayName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        style={{
          alignItems: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-1) var(--space-2)',
          borderRadius: 999,
          border: `1px solid ${palette.tint}`,
          background: palette.bg,
          color: palette.tint,
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          cursor: 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {current.displayName}
      </button>

      {open && (
        <div
          data-testid="board-card-mobile-tag-sheet-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--colour-surface-overlay)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 60,
            padding: 'var(--space-3)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Move card to column"
            data-testid="board-card-mobile-tag-sheet"
            style={{
              background: 'var(--colour-surface-raised)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--colour-border-subtle)',
              padding: 'var(--space-3)',
              width: '100%',
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: 'var(--space-1)',
                fontSize: 'var(--text-md)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Move to column
            </h2>
            {columns.map((col, i) => {
              const colPalette = paletteForIndex(i);
              const isCurrent = col.id === currentColumnId;
              return (
                <button
                  key={col.id}
                  type="button"
                  data-testid="board-card-mobile-tag-sheet-option"
                  data-column-id={col.id}
                  data-current={isCurrent ? 'true' : 'false'}
                  onClick={() => pick(col.id)}
                  disabled={isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${colPalette.tint}`,
                    background: colPalette.bg,
                    color: colPalette.tint,
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 600,
                    cursor: isPending ? 'wait' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{col.displayName}</span>
                  {isCurrent && <Check size={16} aria-hidden="true" />}
                </button>
              );
            })}
            {error && (
              <p
                role="alert"
                data-testid="board-card-mobile-tag-sheet-error"
                style={{
                  margin: 0,
                  marginTop: 'var(--space-1)',
                  color: 'var(--colour-danger)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {error}
              </p>
            )}
            <button
              type="button"
              data-testid="board-card-mobile-tag-sheet-cancel"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="gps-btn gps-btn--ghost gps-btn--sm"
              style={{ marginTop: 'var(--space-1)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
