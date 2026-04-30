'use client';

/**
 * @build-unit BU-feed-card-affordances BU-link-first-composer
 * @spec build/session-briefs/bu-feed-card-affordances.md
 * @spec architecture/decision-log.md (D044, D061, D062)
 *
 * Unified sheet surfaced by the FAB's "+" tap. One screen does both
 * jobs the previous two sheets did (`IntentFabStarter` + the FAB-mode
 * of `KindPickerSheet`):
 *
 *   - Top: a single textarea + Paste button so a member can paste a
 *     URL or type a few words. URL detection drives the live hint.
 *   - Below: the kind-tile grid. Tapping a tile routes to /compose
 *     with the chosen intent AND the pasted/typed input as a prefill.
 *
 * The compose page is link-first (link input above title field, title
 * derived from the URL's metadata). A member who pastes a URL here and
 * picks a kind lands on a partly-filled form; one who picks a kind
 * without typing anything lands on a blank form ready to fill.
 *
 * Built on `@radix-ui/react-dialog`. Sheet positioning, focus trap,
 * ESC-to-close, ARIA: all Radix.
 */

import * as React from 'react';
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { X, ClipboardPaste } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { normalizeUrl } from '@/shared/url-detect';
import {
  buildComposeHrefWithIntent,
  payloadFromInput,
  readClipboardForFill,
} from './IntentFabPasteHandler';
import { TILES, type Tile } from './KindPickerSheet';

export interface IntentFabSheetProps {
  open: boolean;
  onClose: () => void;
}

const HINT_URL = "Looks like a link — we'll prefill the share.";
const HINT_TEXT = "We'll start a post with this as the title.";
const PASTE_DENIED_NOTE = 'Paste below with long-press, or type.';

export function IntentFabSheet({ open, onClose }: IntentFabSheetProps): ReactElement | null {
  const router = useRouter();
  const [input, setInput] = useState<string>('');
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  // The Paste button only renders when the runtime can actually read
  // the clipboard. iOS Safari requires both a secure context (HTTPS or
  // localhost) and `navigator.clipboard.readText`; over HTTP on a LAN
  // IP / .local hostname it rejects every call, which makes the
  // button perpetually broken with an alarming error message. Cleaner
  // to hide it entirely there. Computed in an effect so SSR doesn't
  // mismatch (window is undefined on the server).
  const [clipboardSupported, setClipboardSupported] = useState(false);
  useEffect(() => {
    setClipboardSupported(
      typeof window !== 'undefined' &&
        window.isSecureContext &&
        typeof navigator !== 'undefined' &&
        typeof navigator.clipboard?.readText === 'function',
    );
  }, []);

  if (!open) return null;

  const trimmed = input.trim();
  const detection = trimmed ? normalizeUrl(trimmed) : null;
  const hint = detection?.kind === 'url' ? HINT_URL : detection?.kind === 'text' ? HINT_TEXT : null;

  const handlePaste = async (): Promise<void> => {
    const result = await readClipboardForFill();
    if (result.outcome === 'success') {
      setInput(result.text);
      setPasteNote(null);
    } else {
      setPasteNote(PASTE_DENIED_NOTE);
    }
  };

  const handleTilePick = (tile: Tile): void => {
    if (tile.disabled) return;
    const payload = trimmed ? payloadFromInput(input) : null;
    router.push(buildComposeHrefWithIntent(tile.key, payload));
    onClose();
  };

  return (
    <Dialog.Root
      open={true}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <div style={backdropStyle} data-testid="intent-fab-backdrop" />
        </Dialog.Overlay>
        <Dialog.Content
          asChild
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div style={sheetStyle} data-testid="intent-fab-sheet">
            <div style={headerStyle}>
              <Dialog.Title asChild>
                <h2
                  className="gps-subtitle"
                  style={{ margin: 0, flex: 1 }}
                  data-testid="intent-fab-title"
                >
                  What would you like to share?
                </h2>
              </Dialog.Title>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                data-testid="intent-fab-close"
                style={iconButtonStyle}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                clipboardSupported
                  ? 'Paste a link or start typing…'
                  : 'Tap and hold to paste, or start typing…'
              }
              rows={3}
              data-testid="intent-fab-input"
              style={textareaStyle}
            />

            {clipboardSupported && (
              <div style={pasteRowStyle}>
                <button
                  type="button"
                  onClick={handlePaste}
                  data-testid="intent-fab-paste"
                  aria-label="Paste from clipboard"
                  style={pasteButtonStyle}
                >
                  <ClipboardPaste size={16} aria-hidden="true" />
                  <span>Paste</span>
                </button>
                {pasteNote ? (
                  <span style={pasteNoteStyle} data-testid="intent-fab-paste-note">
                    {pasteNote}
                  </span>
                ) : null}
              </div>
            )}

            <p
              style={hintStyle}
              data-testid="intent-fab-hint"
              data-hint-kind={detection?.kind ?? 'none'}
            >
              {hint ?? ' '}
            </p>

            <ul style={tileGridStyle} data-testid="intent-fab-tile-grid">
              {TILES.map((tile) => (
                <li key={tile.key}>
                  {tile.disabled ? (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title={tile.hint}
                      data-testid="intent-tile-disabled"
                      data-intent-key={tile.key}
                      style={{
                        ...tileBaseStyle(tile.accent),
                        cursor: 'not-allowed',
                        opacity: 0.55,
                      }}
                    >
                      <TileBody tile={tile} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title={tile.hint}
                      data-testid="intent-tile-pick"
                      data-intent-key={tile.key}
                      onClick={() => handleTilePick(tile)}
                      style={tileBaseStyle(tile.accent)}
                    >
                      <TileBody tile={tile} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--colour-surface-overlay)',
  zIndex: 200,
};

const sheetStyle: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'var(--colour-surface-canvas)',
  borderTopLeftRadius: 'var(--radius-lg)',
  borderTopRightRadius: 'var(--radius-lg)',
  padding: 'var(--space-5) var(--space-4) var(--space-6)',
  width: '100%',
  maxWidth: 720,
  maxHeight: '90vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  zIndex: 201,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 'var(--space-1)',
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
  minHeight: 80,
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

const tileGridStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 'var(--space-2)',
};

function tileBaseStyle(accent: string): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    padding: 'var(--space-3)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--colour-surface-raised)',
    borderTop: '1px solid var(--colour-border-subtle)',
    borderRight: '1px solid var(--colour-border-subtle)',
    borderBottom: '1px solid var(--colour-border-subtle)',
    borderLeft: `4px solid ${accent}`,
    textAlign: 'left' as const,
    width: '100%',
    color: 'inherit',
  };
}

function tileHeaderStyle(accent: string): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    color: accent,
  };
}

const tileHintStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
};

function TileBody({ tile }: { tile: Tile }) {
  return (
    <>
      <div style={tileHeaderStyle(tile.accent)}>
        {tile.icon}
        <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--colour-text-primary)' }}>
          {tile.label}
        </strong>
      </div>
      <p style={tileHintStyle}>{tile.hint}</p>
    </>
  );
}
