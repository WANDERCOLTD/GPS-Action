'use client';

/**
 * @build-unit bu-coordination-board (Surface 1+2 — card lifecycle row)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * The "move this card to another lane" affordance, embedded inside the
 * card itself (or in the Surface 2 action row). Replaces the per-card
 * sibling buttons (`PlaceOnBoardButton`, `ReopenButton`, `MarkDoneButton`)
 * — those each occupied a full row beneath every card and got
 * visually noisy on long lists. This is a small icon row using the
 * shared `BOARD_LANE_META` icons (Inbox / LayoutGrid / CheckCircle2)
 * so the same glyph means the same lane on tabs and on cards.
 *
 * The set of destinations is derived from the source state — a card
 * never offers itself as a destination:
 *
 *   active   → Backlog · Done
 *   backlog  → Active (column picker) · Done
 *   done     → Active (column picker) · Backlog
 *
 * Active destinations open the shared `MoveCardSheet` (because Active
 * has multiple columns to pick); off-board destinations are one-tap
 * with a 5-second undo toast that reverts to the source state.
 *
 * `variant` switches the visual treatment:
 *
 *   - `card` (default) — small icons, embedded in the card body
 *   - `surface-2` — full-text buttons matching the other Surface 2
 *     action affordances (BoardActionPair, UrgentToggle)
 */

import { useTransition, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { moveCardAction, type MoveCardActionDestination } from '@/app/board/[groupSlug]/actions';
import { BOARD_LANE_META, type BoardLane } from '@/components/board/lane-icons';
import {
  MoveCardSheet,
  paletteForActiveIndex,
  type MoveDestinationOption,
} from '@/components/board/MoveCardSheet';
import { useUndoToast } from '@/components/board/UndoToastContext';

export type CardLifecycleStatus = Extract<BoardLane, 'active' | 'backlog' | 'done'>;

export interface CardLifecycleActionsProps {
  requestId: string;
  groupId: string;
  groupSlug: string;
  status: CardLifecycleStatus;
  /** Current column when status='active'. Captured pre-move for undo. */
  currentColumnId: string | null;
  /** Active columns for this group (used when reopening / placing into Active). */
  activeColumns: Array<{ id: string; displayName: string }>;
  variant?: 'card' | 'surface-2';
}

/**
 * Pre-move state encoded as a destination payload — used as the "undo"
 * target after a successful move.
 */
function snapshotInverse(
  status: CardLifecycleStatus,
  currentColumnId: string | null,
): MoveCardActionDestination | null {
  if (status === 'active') {
    return currentColumnId ? { lane: 'active', columnId: currentColumnId } : null;
  }
  return { lane: status };
}

const TRANSITIONS: Record<CardLifecycleStatus, ReadonlyArray<CardLifecycleStatus>> = {
  active: ['backlog', 'done'],
  backlog: ['active', 'done'],
  done: ['active', 'backlog'],
};

export function CardLifecycleActions(props: CardLifecycleActionsProps) {
  const variant = props.variant ?? 'card';
  const targets = TRANSITIONS[props.status];
  const isCard = variant === 'card';

  return (
    <div
      data-testid="board-card-lifecycle-actions"
      data-status={props.status}
      data-variant={variant}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        gap: isCard ? 'var(--space-1)' : 'var(--space-2)',
        alignItems: 'center',
      }}
    >
      {targets.map((target) =>
        target === 'active' ? (
          <ActiveDestinationAction key={target} {...props} variant={variant} />
        ) : (
          <DirectDestinationAction key={target} target={target} variant={variant} {...props} />
        ),
      )}
    </div>
  );
}

/**
 * One-tap move to a single off-board lane (backlog or done). No sheet
 * needed — destination is unambiguous. Fires `moveCardAction` and
 * registers an undo toast on success.
 */
function DirectDestinationAction(
  props: CardLifecycleActionsProps & { target: 'backlog' | 'done'; variant: 'card' | 'surface-2' },
) {
  const { target, variant, requestId, groupId, groupSlug, status, currentColumnId } = props;
  const [isPending, startTransition] = useTransition();
  const undo = useUndoToast();
  const meta = BOARD_LANE_META[target];

  function go() {
    const inverse = snapshotInverse(status, currentColumnId);
    startTransition(async () => {
      const result = await moveCardAction({
        requestId,
        groupId,
        groupSlug,
        destination: { lane: target },
        beforeRequestId: null,
        afterRequestId: null,
      });
      if (!result.ok) return;
      if (undo && inverse) {
        undo.show({
          message: `Moved to ${meta.label}.`,
          actionLabel: 'Undo',
          onUndo: async () => {
            await moveCardAction({
              requestId,
              groupId,
              groupSlug,
              destination: inverse,
              beforeRequestId: null,
              afterRequestId: null,
            });
          },
        });
      }
    });
  }

  return (
    <ActionButton
      target={target}
      ariaLabel={`Move to ${meta.label}`}
      icon={<meta.icon size={14} aria-hidden="true" />}
      label={meta.label}
      variant={variant}
      onClick={go}
      isPending={isPending}
    />
  );
}

/**
 * Move to Active opens the shared MoveCardSheet because Active has N
 * columns and the user has to pick. Undo restores the pre-move state
 * (whatever the card was before — backlog or done).
 */
function ActiveDestinationAction(
  props: CardLifecycleActionsProps & { variant: 'card' | 'surface-2' },
) {
  const { variant, requestId, groupId, groupSlug, status, currentColumnId, activeColumns } = props;
  const undo = useUndoToast();
  const meta = BOARD_LANE_META.active;

  if (activeColumns.length === 0) return null;

  const destinations: MoveDestinationOption[] = activeColumns.map((col, i) => {
    const palette = paletteForActiveIndex(i);
    return {
      key: `active:${col.id}`,
      label: col.displayName,
      tint: palette.tint,
      bg: palette.bg,
      destination: { lane: 'active', columnId: col.id },
    };
  });

  function fireUndo(option: MoveDestinationOption) {
    const inverse = snapshotInverse(status, currentColumnId);
    if (!undo || !inverse) return;
    undo.show({
      message: `Moved to ${option.label}.`,
      actionLabel: 'Undo',
      onUndo: async () => {
        await moveCardAction({
          requestId,
          groupId,
          groupSlug,
          destination: inverse,
          beforeRequestId: null,
          afterRequestId: null,
        });
      },
    });
  }

  return (
    <MoveCardSheet
      requestId={requestId}
      groupId={groupId}
      groupSlug={groupSlug}
      currentKey={status === 'active' && currentColumnId ? `active:${currentColumnId}` : status}
      destinations={destinations}
      heading="Move to active"
      onSuccess={fireUndo}
      renderTrigger={({ open, isPending }) => (
        <ActionButton
          target="active"
          ariaLabel="Move to Active board"
          icon={<meta.icon size={14} aria-hidden="true" />}
          label={meta.label}
          variant={variant}
          onClick={open}
          isPending={isPending}
        />
      )}
    />
  );
}

interface ActionButtonProps {
  target: 'active' | 'backlog' | 'done';
  ariaLabel: string;
  icon: ReactNode;
  label: string;
  variant: 'card' | 'surface-2';
  onClick: () => void;
  isPending: boolean;
}

function ActionButton({
  target,
  ariaLabel,
  icon,
  label,
  variant,
  onClick,
  isPending,
}: ActionButtonProps) {
  if (variant === 'surface-2') {
    return (
      <button
        type="button"
        data-testid="board-card-lifecycle-action"
        data-target={target}
        data-variant="surface-2"
        aria-label={ariaLabel}
        onClick={onClick}
        disabled={isPending}
        className="gps-btn gps-btn--ghost gps-btn--sm"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        <ArrowRight size={14} aria-hidden="true" />
        {icon}
        <span>{label}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      data-testid="board-card-lifecycle-action"
      data-target={target}
      data-variant="card"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      disabled={isPending}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--colour-border-subtle)',
        background: 'var(--colour-surface-raised)',
        color: 'var(--colour-text-secondary)',
        cursor: isPending ? 'wait' : 'pointer',
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <ArrowRight size={11} aria-hidden="true" />
      {icon}
    </button>
  );
}
