'use client';

/**
 * @build-unit BU-keyboard-shortcuts
 * @spec build/session-briefs/bu-keyboard-shortcuts.md
 *
 * Modal overlay listing every keyboard shortcut. Opened by the
 * global `?` binding; closed by Esc, backdrop click, or another `?`
 * (the listener toggles the open state).
 *
 * Reads from `SHORTCUT_BINDINGS` so the rendered list cannot drift
 * from the actual listener behaviour.
 */

import type { CSSProperties, ReactElement } from 'react';
import { SHORTCUT_BINDINGS, type ShortcutBinding } from '@/shared/shortcuts';

interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Detect Apple platforms so the contextual row renders the right
 * keyboard glyph (⌘ on Mac, Ctrl elsewhere). SSR fallback is non-
 * Mac; the help overlay is client-side only (opened by `?`), so
 * the userAgent is always available when this runs.
 */
function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function bindingKeys(binding: ShortcutBinding): ReactElement {
  if (binding.kind === 'sequence') {
    return (
      <span style={keysWrapStyle}>
        <kbd style={kbdStyle}>{binding.prefix}</kbd>
        <span aria-hidden="true" style={thenStyle}>
          then
        </span>
        <kbd style={kbdStyle}>{binding.key}</kbd>
      </span>
    );
  }
  if (binding.kind === 'contextual') {
    const tokens = (isApplePlatform() ? binding.macKeys : binding.pcKeys).split(/\s+/);
    return (
      <span style={keysWrapStyle}>
        {tokens.map((tok, idx) => (
          <kbd key={`${tok}-${idx}`} style={kbdStyle}>
            {tok}
          </kbd>
        ))}
      </span>
    );
  }
  return (
    <span style={keysWrapStyle}>
      <kbd style={kbdStyle}>{binding.key}</kbd>
    </span>
  );
}

/**
 * Pure render — no hooks. Esc-to-close is handled by the parent
 * `KeyboardShortcuts` component's global keydown listener so this
 * component is testable as a plain function.
 */
export function ShortcutHelp({ open, onClose }: ShortcutHelpProps): ReactElement | null {
  if (!open) return null;

  return (
    <div
      data-testid="shortcut-help-backdrop"
      onClick={onClose}
      style={backdropStyle}
      role="presentation"
    >
      <div
        data-testid="shortcut-help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <header style={headerStyle}>
          <h2 id="shortcut-help-title" style={titleStyle}>
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="shortcut-help-close"
            aria-label="Close shortcut help"
            style={closeStyle}
          >
            ×
          </button>
        </header>
        <ul style={listStyle}>
          {SHORTCUT_BINDINGS.map((binding) => {
            const id =
              binding.kind === 'sequence'
                ? `${binding.prefix}-${binding.key}`
                : binding.kind === 'contextual'
                  ? `ctx-${binding.macKeys.replace(/\s+/g, '-')}`
                  : binding.key;
            return (
              <li key={id} data-testid="shortcut-help-row" data-binding-id={id} style={rowStyle}>
                {bindingKeys(binding)}
                <span style={labelStyle}>
                  {binding.label}
                  {binding.note && <span style={noteStyle}> — {binding.note}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <footer style={footerStyle}>
          Press <kbd style={kbdStyle}>Esc</kbd> to close.
        </footer>
      </div>
    </div>
  );
}

// ── Styling (inline, tokens-only) ────────────────────────────────────────

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'color-mix(in srgb, var(--colour-text-primary) 40%, transparent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 'var(--z-modal)' as unknown as number,
  padding: 'var(--space-4)',
};

const modalStyle: CSSProperties = {
  background: 'var(--colour-surface-raised)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--colour-border-subtle)',
  padding: 'var(--space-4) var(--space-5)',
  maxWidth: 480,
  width: '100%',
  maxHeight: '80vh',
  overflowY: 'auto',
  fontFamily: 'var(--font-ui)',
  color: 'var(--colour-text-primary)',
  boxShadow: '0 10px 40px color-mix(in srgb, var(--colour-text-primary) 25%, transparent)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-3)',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-md)',
  fontWeight: 'var(--weight-semibold)',
};

const closeStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: 'var(--text-lg)',
  lineHeight: 1,
  cursor: 'pointer',
  color: 'var(--colour-text-secondary)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontSize: 'var(--text-sm)',
};

const keysWrapStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  minWidth: 88,
  flexShrink: 0,
};

const thenStyle: CSSProperties = {
  fontSize: 'var(--text-2xs)',
  color: 'var(--colour-text-tertiary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
};

const kbdStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--colour-surface-sunken)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-primary)',
  minWidth: 16,
  textAlign: 'center' as const,
};

const labelStyle: CSSProperties = {
  flex: 1,
  color: 'var(--colour-text-primary)',
};

const noteStyle: CSSProperties = {
  color: 'var(--colour-text-tertiary)',
  fontSize: 'var(--text-xs)',
};

const footerStyle: CSSProperties = {
  marginTop: 'var(--space-4)',
  paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--colour-border-subtle)',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-tertiary)',
};
