'use client';

/**
 * @build-unit bu-coordination-board (Surface 1+2 — undo toast)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Generic 5-second undo toast for board actions that change a card's
 * lifecycle state. Mounted at the route layout level via
 * `<UndoToastProvider>`; any component below can call
 * `useUndoToast().show({ message, onUndo })` after a successful
 * mutation.
 *
 * Today's only caller is `MarkDoneButton` — marking-done is the most
 * "permission to close" gesture a member makes; a quick undo without
 * hunting through the Done list matters there. Backlog → active and
 * Done → reopen are recoverable in two clicks via the same sheet,
 * so they don't register an undo (would be noise).
 *
 * The toast is fixed to the bottom of the viewport, above the safe-
 * area. Auto-dismisses after `TOAST_DURATION_MS`. Clicking Undo
 * fires the registered callback, then dismisses immediately.
 *
 * If multiple undo-able actions fire in succession, the latest
 * replaces the previous (single-toast model — Sharon-warmth, no
 * pile-up).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

const TOAST_DURATION_MS = 5000;

interface UndoToastPayload {
  message: string;
  /** Label on the action link. Defaults to "Undo". */
  actionLabel?: string;
  /** Async-or-sync callback that performs the inverse mutation. */
  onUndo: () => Promise<void> | void;
}

export interface UndoToastApi {
  show: (payload: UndoToastPayload) => void;
}

const UndoToastCtx = createContext<UndoToastApi | null>(null);

export function useUndoToast(): UndoToastApi | null {
  return useContext(UndoToastCtx);
}

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<UndoToastPayload | null>(null);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPayload(null);
  }, []);

  const show = useCallback((next: UndoToastPayload) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPayload(next);
    timerRef.current = setTimeout(() => {
      setPayload(null);
      timerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleUndo = useCallback(() => {
    const current = payload;
    if (!current) return;
    startTransition(async () => {
      try {
        await current.onUndo();
      } finally {
        dismiss();
      }
    });
  }, [payload, dismiss]);

  return (
    <UndoToastCtx.Provider value={{ show }}>
      {children}
      {payload && (
        <div
          role="status"
          aria-live="polite"
          data-testid="board-undo-toast"
          style={{
            position: 'fixed',
            bottom: 'calc(var(--space-4) + env(safe-area-inset-bottom, 0))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 70,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--colour-text-primary)',
            color: 'var(--colour-surface-raised)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-sm)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <span>{payload.message}</span>
          <button
            type="button"
            data-testid="board-undo-toast-action"
            onClick={handleUndo}
            disabled={isPending}
            style={{
              background: 'transparent',
              color: 'inherit',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              cursor: isPending ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              fontWeight: 600,
              textDecoration: 'underline',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {payload.actionLabel ?? 'Undo'}
          </button>
        </div>
      )}
    </UndoToastCtx.Provider>
  );
}
