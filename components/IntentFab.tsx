'use client';

/**
 * @build-unit BU-fab-intent-picker
 * @spec architecture/decision-log.md (D044, D061, D062)
 *
 * Single primary FAB → KindPickerSheet (the bottom-sheet kind picker).
 * Replaces every "create something new" entry point in the app.
 *
 * Per D061 the FAB itself is one tap target; tile interaction lives
 * inside the picker sheet. The same sheet is also used inside the
 * compose form so members can change kind mid-compose without losing
 * what they have typed.
 */

import { useState, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import { KindPickerSheet } from './KindPickerSheet';

const fabStyle: CSSProperties = {
  position: 'fixed',
  bottom: 'var(--space-6)',
  right: 'var(--space-6)',
  width: 56,
  height: 56,
  borderRadius: 'var(--radius-circle)',
  background: 'var(--colour-primary)',
  color: 'var(--colour-primary-contrast)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 16px color-mix(in srgb, var(--colour-primary) 35%, transparent)',
  border: 'none',
  cursor: 'pointer',
  zIndex: 100,
};

export function IntentFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Create something new"
        data-testid="intent-fab-button"
        style={fabStyle}
      >
        <Plus size={28} aria-hidden="true" strokeWidth={2.5} />
      </button>
      <KindPickerSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
