'use client';

/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Generic undo snackbar — bottom-of-screen, configurable duration,
 * fires `onUndo` if the user taps Undo, otherwise fires `onTimeout`
 * once the timer elapses. Used by the publish modal's Discard verb
 * (10s window per `discard_undo_window_seconds`), but kept generic so
 * other "destructive with undo" flows can reuse it.
 *
 * Honest copy: "Discarded · Undo" — the action has happened, undo is
 * the reversal, not a confirm-before. The default timeout is 10s but
 * the caller passes `durationMs` so the system-setting can override.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';

interface UndoSnackbarProps {
  readonly message: string;
  readonly durationMs: number;
  readonly onUndo: () => void | Promise<void>;
  readonly onTimeout: () => void | Promise<void>;
  /** Surface marker — distinguishes which flow surfaced this snackbar. */
  readonly purpose?: string;
}

export function UndoSnackbar({
  message,
  durationMs,
  onUndo,
  onTimeout,
  purpose,
}: UndoSnackbarProps): ReactElement {
  const [resolving, setResolving] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      void Promise.resolve(onTimeout());
    }, durationMs);
    return () => clearTimeout(handle);
  }, [durationMs, onTimeout]);

  async function handleUndo(): Promise<void> {
    if (firedRef.current) return;
    firedRef.current = true;
    setResolving(true);
    try {
      await Promise.resolve(onUndo());
    } finally {
      setResolving(false);
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="compose-undo-snackbar"
      data-purpose={purpose ?? ''}
      style={overlayStyle}
    >
      <span style={messageStyle}>{message}</span>
      <button
        type="button"
        onClick={handleUndo}
        disabled={resolving}
        data-testid="compose-undo-snackbar-undo"
        className="gps-btn gps-btn--ghost"
        style={buttonStyle}
      >
        {resolving ? 'Restoring…' : 'Undo'}
      </button>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'var(--space-4)',
  transform: 'translateX(-50%)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-surface-raised)',
  color: 'var(--colour-text-primary)',
  border: '1px solid var(--colour-border-subtle)',
  boxShadow: '0 4px 12px color-mix(in srgb, var(--colour-text-primary) 18%, transparent)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  zIndex: 'var(--z-snackbar)' as unknown as number,
};

const messageStyle: CSSProperties = {
  whiteSpace: 'nowrap',
};

const buttonStyle: CSSProperties = {
  color: 'var(--colour-primary)',
  fontWeight: 600,
  background: 'transparent',
  padding: '4px var(--space-2)',
};
