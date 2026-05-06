'use client';

/**
 * @build-unit bu-coordination-board (Surface 1 — done → active picker)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * "Reopen ↩" trigger for cards on the Done list. Same pattern as
 * `PlaceOnBoardButton` (backlog → active) — opens the shared
 * `MoveCardSheet` with active-column destinations and lets the user
 * pick which column the reopened card goes back into.
 *
 * Reopens are real but rare — kept off Active cards (drag is the
 * primary verb there) and only surfaced on the Done list where it's
 * genuinely useful.
 */

import { Undo2 } from 'lucide-react';
import {
  MoveCardSheet,
  paletteForActiveIndex,
  type MoveDestinationOption,
} from '@/components/board/MoveCardSheet';

export interface ReopenButtonProps {
  requestId: string;
  groupId: string;
  groupSlug: string;
  columns: Array<{ id: string; displayName: string }>;
}

export function ReopenButton({ requestId, groupId, groupSlug, columns }: ReopenButtonProps) {
  if (columns.length === 0) return null;

  const destinations: MoveDestinationOption[] = columns.map((col, i) => {
    const palette = paletteForActiveIndex(i);
    return {
      key: `active:${col.id}`,
      label: col.displayName,
      tint: palette.tint,
      bg: palette.bg,
      destination: { lane: 'active', columnId: col.id },
    };
  });

  return (
    <MoveCardSheet
      requestId={requestId}
      groupId={groupId}
      groupSlug={groupSlug}
      currentKey="done"
      destinations={destinations}
      heading="Reopen into column"
      renderTrigger={({ open, isPending }) => (
        <button
          type="button"
          data-testid="board-reopen-trigger"
          data-request-id={requestId}
          aria-label="Reopen this card into a column on the active board"
          aria-haspopup="dialog"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            open();
          }}
          className="gps-btn gps-btn--ghost gps-btn--sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          <Undo2 size={14} aria-hidden="true" />
          <span>Reopen</span>
        </button>
      )}
    />
  );
}
