'use client';

/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Two-step confirm before a destructive discard. Stateless from the
 * sheet's perspective — the parent owns whether the sheet is open and
 * which post the discard targets. On Confirm the parent typically
 * fires the actual `discardPostAction` and opens an `<UndoSnackbar />`
 * for the configured undo window.
 *
 * Pure-render component (no hooks) so unit tests don't have to mock
 * React internals; visibility is gated by the `open` prop.
 */

import type { CSSProperties, ReactElement } from 'react';

interface DiscardConfirmSheetProps {
  readonly open: boolean;
  readonly onConfirm: () => void | Promise<void>;
  readonly onCancel: () => void;
}

export function DiscardConfirmSheet({
  open,
  onConfirm,
  onCancel,
}: DiscardConfirmSheetProps): ReactElement | null {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-confirm-heading"
      data-testid="compose-discard-confirm-sheet"
      style={overlayStyle}
    >
      <div style={sheetStyle}>
        <h2 id="discard-confirm-heading" style={headingStyle}>
          Discard this draft?
        </h2>
        <p style={bodyStyle}>You can undo for a few seconds — after that the draft is gone.</p>
        <div style={actionRowStyle}>
          <button
            type="button"
            onClick={() => void Promise.resolve(onConfirm())}
            data-testid="compose-discard-confirm-sheet-confirm"
            className="gps-btn gps-btn--danger"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onCancel}
            data-testid="compose-discard-confirm-sheet-cancel"
            className="gps-btn gps-btn--secondary"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'color-mix(in srgb, var(--colour-text-primary) 50%, transparent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-4)',
  zIndex: 'var(--z-modal)' as unknown as number,
};

const sheetStyle: CSSProperties = {
  background: 'var(--colour-surface-raised)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5) var(--space-6)',
  maxWidth: '24rem',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-ui)',
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  color: 'var(--colour-text-primary)',
};

const bodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
  lineHeight: 1.5,
};

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-2)',
};
