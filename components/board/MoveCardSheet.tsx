'use client';

/**
 * @build-unit bu-coordination-board (Surface 1 — generalized move primitive)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Generalized "pick a destination, move the card" sheet. Replaces the
 * narrow active-only logic that lived in `MobileTagSwitcher` with a
 * destination-agnostic component used by:
 *
 *   - The mobile tag-pill on Active cards (active → other active column).
 *   - "Place on board ↗" on Backlog cards (backlog → active column).
 *   - "Mark done" / "Reopen" on Active / Done cards (active ↔ done).
 *
 * The caller builds a list of `MoveDestinationOption`s, supplies a
 * `renderTrigger` function for the visual entry-point, and the sheet
 * handles open/close + the `moveCardAction` call. A `currentKey` lets
 * the sheet mark the active row with a check + skip the move on
 * re-pick (no-op).
 *
 * Trigger is fully caller-owned — different surfaces want different
 * shapes (tinted pill on Active, link-text on Backlog, ghost button
 * on Done). No UI assumed beyond the sheet itself.
 */

import { useState, useTransition, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { moveCardAction, type MoveCardActionDestination } from '@/app/board/[groupSlug]/actions';

export interface MoveDestinationOption {
  /** Stable id for keying + the "current" check. */
  key: string;
  /** Label shown in the sheet row + available to the trigger. */
  label: string;
  /** Foreground tint (CSS var or color-mix expression). */
  tint: string;
  /** Background fill for the sheet row. */
  bg: string;
  /** The payload passed to `moveCardAction`. */
  destination: MoveCardActionDestination;
}

export interface MoveCardSheetProps {
  requestId: string;
  groupId: string;
  groupSlug: string;
  /** Stable key of the option that is the card's current state. Marked with a check; tapping it is a no-op. */
  currentKey: string;
  destinations: MoveDestinationOption[];
  /** Caller-provided trigger. Receives an `open` callback. */
  renderTrigger: (args: { open: () => void; isOpen: boolean; isPending: boolean }) => ReactNode;
  /** Heading inside the sheet. Defaults to "Move card". */
  heading?: string;
  /**
   * Called after a successful move. Caller typically uses this to fire
   * an undo toast — they know the pre-move state and the inverse
   * payload. The sheet itself is destination-agnostic and doesn't try
   * to compute undo on its own.
   */
  onSuccess?: (option: MoveDestinationOption) => void;
  /**
   * Called synchronously on pick, before the server action fires. Used
   * by callers that want to apply an optimistic update (e.g. the
   * backlog list removing the moved row immediately — Sub-build D
   * Item 17). The sheet still awaits the server response and reports
   * via `onError` so the caller can roll the optimistic update back.
   */
  onPickStart?: (option: MoveDestinationOption) => void;
  /**
   * Called when the server action fails after `onPickStart` has fired.
   * Lets the caller roll back any optimistic update and surface an
   * error message in its own UI (the sheet's inline error is also
   * still shown).
   */
  onError?: (option: MoveDestinationOption, message: string) => void;
}

/**
 * Position-based palette for active columns (column 1 yellow, col 2 blue,
 * col 3 brand, col 4 green, col 5+ neutral). Exposed so callers building
 * destination lists for active columns can stay consistent with the
 * mobile tag-pill colours.
 */
const ACTIVE_PALETTE: Array<{ tint: string; bg: string }> = [
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

export function paletteForActiveIndex(index: number): { tint: string; bg: string } {
  return ACTIVE_PALETTE[index] ?? NEUTRAL;
}

export const BACKLOG_PALETTE: { tint: string; bg: string } = NEUTRAL;

export const DONE_PALETTE: { tint: string; bg: string } = {
  tint: 'var(--colour-success)',
  bg: 'color-mix(in srgb, var(--colour-success) 14%, transparent)',
};

export const ABANDONED_PALETTE: { tint: string; bg: string } = {
  tint: 'var(--colour-text-tertiary)',
  bg: 'var(--colour-surface-sunken)',
};

export function MoveCardSheet({
  requestId,
  groupId,
  groupSlug,
  currentKey,
  destinations,
  renderTrigger,
  heading = 'Move card',
  onSuccess,
  onPickStart,
  onError,
}: MoveCardSheetProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function pick(option: MoveDestinationOption) {
    if (option.key === currentKey) {
      setOpen(false);
      return;
    }
    setError(null);
    // Notify the caller synchronously — they can apply optimistic UI
    // (Sub-build D Item 17) before the server action round-trip.
    onPickStart?.(option);
    // Close the sheet immediately. Combined with optimistic UI in the
    // caller, the user gets instant feedback rather than watching the
    // sheet hang while the server settles. On error, onError fires and
    // the caller rolls back; the sheet stays closed so the error toast
    // is the only surfaced affordance.
    setOpen(false);
    startTransition(async () => {
      const result = await moveCardAction({
        requestId,
        groupId,
        groupSlug,
        destination: option.destination,
        beforeRequestId: null,
        afterRequestId: null,
      });
      if (result.ok) {
        onSuccess?.(option);
      } else {
        const message = result.error ?? 'Could not move the card — try again.';
        setError(message);
        onError?.(option, message);
      }
    });
  }

  return (
    <>
      {renderTrigger({ open: () => setOpen(true), isOpen: open, isPending })}
      {open && (
        <div
          data-testid="board-move-card-sheet-backdrop"
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
            aria-label={heading}
            data-testid="board-move-card-sheet"
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
              {heading}
            </h2>
            {destinations.map((option) => {
              const isCurrent = option.key === currentKey;
              return (
                <button
                  key={option.key}
                  type="button"
                  data-testid="board-move-card-sheet-option"
                  data-option-key={option.key}
                  data-current={isCurrent ? 'true' : 'false'}
                  onClick={() => pick(option)}
                  disabled={isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${option.tint}`,
                    background: option.bg,
                    color: option.tint,
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 600,
                    cursor: isPending ? 'wait' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{option.label}</span>
                  {isCurrent && <Check size={16} aria-hidden="true" />}
                </button>
              );
            })}
            {error && (
              <p
                role="alert"
                data-testid="board-move-card-sheet-error"
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
              data-testid="board-move-card-sheet-cancel"
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
