'use client';

/**
 * @build-unit bu-coordination-board (Surface 2 — Mark done)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * One-tap "Mark done" button for the ticket-detail page (Surface 2).
 * Calls `moveCardAction` with destination `{ lane: 'done' }`. Lives
 * only when the ticket is currently active — backlog/done/abandoned
 * states hide the button (other affordances cover those transitions).
 *
 * Pairs with `<UndoToast>` (atom 4): on success, registers an inverse-
 * payload that restores the ticket to its previous active column. The
 * 5-second undo lets a slip-of-the-thumb mark-done be recovered
 * without a hunt through the Done list. If `useUndoToast()` returns
 * null (no provider present), the button still works — just no toast.
 */

import { useTransition } from 'react';
import { CheckCheck } from 'lucide-react';
import { moveCardAction } from '@/app/board/[groupSlug]/actions';
import { useUndoToast } from '@/components/board/UndoToastContext';

export interface MarkDoneButtonProps {
  requestId: string;
  groupId: string;
  groupSlug: string;
  /** Currently-placed column. Captured pre-move so undo can restore. */
  currentColumnId: string | null;
  /** Whether the ticket is in `active` status. Hides the button otherwise. */
  isActive: boolean;
}

export function MarkDoneButton(props: MarkDoneButtonProps) {
  // Early-return BEFORE hooks so render-as-null doesn't break the
  // rules of hooks. The body lives in a child component so hooks
  // only mount when the button is actually shown.
  if (!props.isActive) return null;
  return <MarkDoneButtonInner {...props} />;
}

function MarkDoneButtonInner({
  requestId,
  groupId,
  groupSlug,
  currentColumnId,
}: MarkDoneButtonProps) {
  const [isPending, startTransition] = useTransition();
  const undo = useUndoToast();

  function markDone() {
    const sourceColumnId = currentColumnId;
    startTransition(async () => {
      const result = await moveCardAction({
        requestId,
        groupId,
        groupSlug,
        destination: { lane: 'done' },
        beforeRequestId: null,
        afterRequestId: null,
      });
      if (!result.ok) return;
      if (undo && sourceColumnId) {
        undo.show({
          message: 'Marked done.',
          actionLabel: 'Undo',
          onUndo: async () => {
            await moveCardAction({
              requestId,
              groupId,
              groupSlug,
              destination: { lane: 'active', columnId: sourceColumnId },
              beforeRequestId: null,
              afterRequestId: null,
            });
          },
        });
      }
    });
  }

  return (
    <button
      type="button"
      data-testid="board-ticket-mark-done"
      data-request-id={requestId}
      onClick={markDone}
      disabled={isPending}
      className="gps-btn gps-btn--success gps-btn--sm"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <CheckCheck size={14} aria-hidden="true" />
      <span>{isPending ? 'Marking…' : 'Mark done'}</span>
    </button>
  );
}
