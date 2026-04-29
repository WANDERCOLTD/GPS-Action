'use client';

/**
 * @build-unit BU-link-first-composer
 * @spec build/session-briefs/bu-link-first-composer.md
 * @spec product/scenarios.md (SCN-24, SCN-25)
 *
 * Starter card surfaced by the split FAB's primary "+" tap. A single
 * textarea accepts a pasted URL or typed text; `normalizeUrl()` drives
 * the live hint and the Continue payload. The "Pick a kind instead →"
 * escape hatch reveals the existing KindPickerSheet so members who
 * know what they want to post can skip the URL/text dance.
 */

import * as React from 'react';
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { X, ClipboardPaste } from 'lucide-react';
import { normalizeUrl } from '@/shared/url-detect';
import { payloadFromInput, readClipboardForFill } from './IntentFabPasteHandler';

export interface IntentFabStarterProps {
  open: boolean;
  onClose: () => void;
  onContinue: (payload: { kind: 'url' | 'text'; value: string }) => void;
  onPickKind: () => void;
}

const HINT_URL = "Looks like a link — we'll prefill the share.";
const HINT_TEXT = "We'll start a post with this as the title.";
const PASTE_DENIED_NOTE = "We couldn't read your clipboard — paste below or type.";

export function IntentFabStarter({
  open,
  onClose,
  onContinue,
  onPickKind,
}: IntentFabStarterProps): ReactElement | null {
  const [input, setInput] = useState<string>('');
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  // BU-feed-card-affordances — iOS ghost-click guard. The same touch
  // that opens this panel synthesises a click whose coordinates land
  // on the just-rendered backdrop. Without this guard the panel
  // "flashes" on iPhone Chrome and Safari — opens, then immediately
  // closes from the ghost click. 250ms gap covers the synth-click
  // delay window.
  //
  // Critical: this component is MOUNTED at page-load with `open=false`
  // (parent always renders it). So we can't capture openedAt via
  // useState lazy-init — that fires at mount, not at open. Instead,
  // a useEffect runs every time `open` flips to true and stamps the
  // ref. The handler reads the ref.
  const openedAtRef = useRef<number>(0);
  useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (): void => {
    if (Date.now() - openedAtRef.current < 250) return;
    onClose();
  };

  const trimmed = input.trim();
  const detection = trimmed ? normalizeUrl(trimmed) : null;
  const hint = detection?.kind === 'url' ? HINT_URL : detection?.kind === 'text' ? HINT_TEXT : null;
  const continueDisabled = !trimmed;

  const handleContinue = (): void => {
    const payload = payloadFromInput(input);
    if (payload) onContinue(payload);
  };

  const handlePaste = async (): Promise<void> => {
    const result = await readClipboardForFill();
    if (result.outcome === 'success') {
      setInput(result.text);
      setPasteNote(null);
    } else {
      setPasteNote(PASTE_DENIED_NOTE);
    }
  };

  return (
    <div
      style={backdropStyle}
      onClick={handleBackdropClick}
      data-testid="intent-fab-starter-backdrop"
      role="presentation"
    >
      <div
        style={sheetStyle}
        role="dialog"
        aria-label="Start a post"
        data-testid="intent-fab-starter-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={headerStyle}>
          <h2
            className="gps-subtitle"
            style={{ margin: 0, flex: 1 }}
            data-testid="intent-fab-starter-title"
          >
            Start a post
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close starter"
            data-testid="intent-fab-starter-close"
            style={iconButtonStyle}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a link or start typing…"
          rows={3}
          data-testid="intent-fab-starter-input"
          style={textareaStyle}
        />

        <div style={pasteRowStyle}>
          <button
            type="button"
            onClick={handlePaste}
            data-testid="intent-fab-starter-paste"
            aria-label="Paste from clipboard"
            style={pasteButtonStyle}
          >
            <ClipboardPaste size={16} aria-hidden="true" />
            <span>Paste</span>
          </button>
          {pasteNote ? (
            <span style={pasteNoteStyle} data-testid="intent-fab-starter-paste-note">
              {pasteNote}
            </span>
          ) : null}
        </div>

        <p
          style={hintStyle}
          data-testid="intent-fab-starter-hint"
          data-hint-kind={detection?.kind ?? 'none'}
        >
          {hint ?? ' '}
        </p>

        <button
          type="button"
          onClick={handleContinue}
          disabled={continueDisabled}
          data-testid="intent-fab-starter-continue"
          style={continueButtonStyle(continueDisabled)}
        >
          Continue
        </button>

        <button
          type="button"
          onClick={onPickKind}
          data-testid="intent-fab-starter-pick-kind"
          style={pickKindStyle}
        >
          Pick a kind instead →
        </button>
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--colour-surface-overlay)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
};

const sheetStyle: CSSProperties = {
  background: 'var(--colour-surface-canvas)',
  borderTopLeftRadius: 'var(--radius-lg)',
  borderTopRightRadius: 'var(--radius-lg)',
  padding: 'var(--space-5) var(--space-4) var(--space-6)',
  width: '100%',
  maxWidth: 720,
  maxHeight: '85vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 'var(--space-2)',
};

const iconButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 'var(--space-2)',
  color: 'var(--colour-text-secondary)',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: 'var(--space-3)',
  border: '1px solid var(--colour-border-strong)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--colour-surface-sunken)',
  color: 'var(--colour-text-primary)',
  fontSize: 'var(--text-md)',
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: 88,
};

const pasteRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
};

const pasteButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--colour-border-strong)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-surface-raised)',
  color: 'var(--colour-text-primary)',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
  minHeight: 44,
};

const pasteNoteStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
  minHeight: '1em',
};

function continueButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    padding: 'var(--space-3) var(--space-4)',
    background: disabled ? 'var(--colour-text-disabled)' : 'var(--colour-primary)',
    color: 'var(--colour-primary-contrast)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 'var(--text-md)',
    fontWeight: 600,
    minHeight: 44,
  };
}

const pickKindStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--colour-text-link)',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
  padding: 'var(--space-2)',
  alignSelf: 'center',
  textDecoration: 'underline',
};
