'use client';

/**
 * @build-unit bu-coordination-board (Surface 1 — mobile tag-pill switcher, PR #7 atom B2)
 * @spec docs/build/session-briefs/bu-coordination-board.md (lines 109-112)
 *
 * Mobile-only column-switch primitive. Each kanban card renders a
 * tinted pill showing its current column. Tapping the pill opens
 * the generic `MoveCardSheet` listing the group's active columns;
 * picking one moves the card. Mobile-only via the
 * `.gps-mobile-tag-switcher` class (display: none → inline-flex at
 * `@media (max-width: 768px)` — same breakpoint as the B1 reflow).
 *
 * Today this is a thin wrapper around `MoveCardSheet` that builds
 * the active-columns destination list with the position-based
 * palette. The shared sheet is what powers backlog/done/abandoned
 * picker variants on other surfaces.
 *
 * Colour key: position-based palette (col 1 yellow, col 2 blue,
 * col 3 brand, col 4 green, col 5+ neutral). Helper exported as
 * `paletteForIndex` for backwards-compatible test reuse — same
 * logic as `paletteForActiveIndex` in `MoveCardSheet`.
 */

import {
  MoveCardSheet,
  paletteForActiveIndex,
  type MoveDestinationOption,
} from '@/components/board/MoveCardSheet';

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

export function paletteForIndex(index: number): { tint: string; bg: string } {
  return paletteForActiveIndex(index);
}

export function MobileTagSwitcher({
  requestId,
  groupId,
  groupSlug,
  currentColumnId,
  columns,
}: MobileTagSwitcherProps) {
  const currentIndex = columns.findIndex((c) => c.id === currentColumnId);
  const current = currentIndex >= 0 ? columns[currentIndex] : null;
  if (!current) return null;
  const currentPalette = paletteForActiveIndex(currentIndex);

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
      currentKey={`active:${currentColumnId}`}
      destinations={destinations}
      heading="Move to column"
      renderTrigger={({ open, isPending }) => (
        <button
          type="button"
          className="gps-mobile-tag-switcher"
          data-testid="board-card-mobile-tag-pill"
          data-column-id={currentColumnId}
          aria-label={`Move card. Current column: ${current.displayName}`}
          aria-haspopup="dialog"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            open();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 999,
            border: `1px solid ${currentPalette.tint}`,
            background: currentPalette.bg,
            color: currentPalette.tint,
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {current.displayName}
        </button>
      )}
    />
  );
}
