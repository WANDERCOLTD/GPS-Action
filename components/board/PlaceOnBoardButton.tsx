'use client';

/**
 * @build-unit bu-coordination-board (Surface 1 — backlog → active picker)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * "Place on board ↗" trigger for cards on the Backlog list. Opens
 * the shared `MoveCardSheet` with active-column destinations; picking
 * one moves the card from backlog → active in that column. Closes the
 * "how do I get a backlog card onto the board?" gap that lived in
 * the brief without an implementation.
 *
 * Lives next to the card on the backlog list — no drag, no extra
 * page hop. The sheet's column palette matches the mobile tag-pill
 * (yellow → blue → brand → green → neutral) so member colour memory
 * is consistent across surfaces.
 */

import { ArrowUpRight } from 'lucide-react';
import {
  MoveCardSheet,
  paletteForActiveIndex,
  type MoveDestinationOption,
} from '@/components/board/MoveCardSheet';

export interface PlaceOnBoardButtonProps {
  requestId: string;
  groupId: string;
  groupSlug: string;
  columns: Array<{ id: string; displayName: string }>;
}

export function PlaceOnBoardButton({
  requestId,
  groupId,
  groupSlug,
  columns,
}: PlaceOnBoardButtonProps) {
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
      currentKey="backlog"
      destinations={destinations}
      heading="Place on board"
      renderTrigger={({ open, isPending }) => (
        <button
          type="button"
          data-testid="board-place-on-board-trigger"
          data-request-id={requestId}
          aria-label="Place this card on the active board"
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
          <span>Place on board</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      )}
    />
  );
}
