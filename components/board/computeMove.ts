/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, drag-wiring follow-up)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Pure helper for `BoardGrid`'s drag-end handler. Lives in its own
 * file so it can be unit-tested without dragging in `next/cache` via
 * the server-action import chain.
 */

import type { CardProps } from '@/components/board/Card';

export type CardsByColumn = Record<string, CardProps['ticket'][]>;

export interface ComputeMoveResult {
  next: CardsByColumn;
  beforeRequestId: string | null;
  afterRequestId: null;
}

/**
 * Given the current card map and a (requestId, targetColumnId) drag-
 * end pair, returns the next map (with the card moved to the END of
 * the target column) plus the `beforeRequestId` to send to
 * `moveCard`. Returns `null` if the move is a no-op (same column or
 * unknown card).
 *
 * MVP: drop-at-end only. Within-column reorder + precise drop-position
 * computation are follow-up work.
 */
export function computeMove(
  cardsByColumn: CardsByColumn,
  requestId: string,
  targetColumnId: string,
): ComputeMoveResult | null {
  let sourceColumnId: string | null = null;
  let card: CardProps['ticket'] | null = null;
  for (const [colId, cards] of Object.entries(cardsByColumn)) {
    const found = cards.find((c) => c.id === requestId);
    if (found) {
      sourceColumnId = colId;
      card = found;
      break;
    }
  }
  if (!sourceColumnId || !card || sourceColumnId === targetColumnId) return null;

  const targetExisting = cardsByColumn[targetColumnId] ?? [];
  const next: CardsByColumn = { ...cardsByColumn };
  next[sourceColumnId] = (cardsByColumn[sourceColumnId] ?? []).filter(
    (c) => c.id !== requestId,
  );
  next[targetColumnId] = [...targetExisting, card];

  const lastInTarget = targetExisting[targetExisting.length - 1];
  const beforeRequestId = lastInTarget ? lastInTarget.id : null;
  return { next, beforeRequestId, afterRequestId: null };
}
