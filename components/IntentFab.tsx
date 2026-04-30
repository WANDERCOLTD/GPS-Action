'use client';

/**
 * @build-unit BU-fab-intent-picker BU-link-first-composer BU-feed-card-affordances
 * @spec architecture/decision-log.md (D044, D061, D062)
 * @spec build/session-briefs/bu-link-first-composer.md
 *
 * Split FAB — one rounded pill, two tap targets:
 *   • left "+"   → opens the unified IntentFabSheet (paste/type +
 *                  kind-tile grid in one screen)
 *   • right "📋" → reads clipboard and routes straight to /compose
 *                  via `readClipboardAndContinue`
 *
 * Both halves funnel through `IntentFabPasteHandler` so behaviour
 * cannot drift between the in-sheet Paste button and this shortcut.
 * On clipboard miss (empty / denied / unsupported) the paste tap
 * falls back to opening the sheet so the member can paste manually.
 */

import * as React from 'react';
import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardPaste } from 'lucide-react';
import { IntentFabSheet } from './IntentFabSheet';
import { readClipboardAndContinue } from './IntentFabPasteHandler';

const pillStyle: CSSProperties = {
  position: 'fixed',
  bottom: 'var(--space-6)',
  right: 'var(--space-6)',
  display: 'flex',
  alignItems: 'stretch',
  height: 56,
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-primary)',
  color: 'var(--colour-primary-contrast)',
  boxShadow: '0 4px 16px color-mix(in srgb, var(--colour-primary) 35%, transparent)',
  overflow: 'hidden',
  zIndex: 100,
};

const halfBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: 0,
  minWidth: 44,
  minHeight: 44,
};

const primaryHalfStyle: CSSProperties = {
  ...halfBase,
  flex: '0 0 78px',
};

const pasteHalfStyle: CSSProperties = {
  ...halfBase,
  flex: '0 0 56px',
  borderLeft: '1px solid color-mix(in srgb, var(--colour-primary-contrast) 25%, transparent)',
};

export function IntentFab() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handlePaste = async () => {
    const outcome = await readClipboardAndContinue(router);
    if (outcome !== 'success') {
      setOpen(true);
    }
  };

  return (
    <>
      <div style={pillStyle} data-testid="intent-fab" role="group" aria-label="Create or paste">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Create a post"
          data-testid="intent-fab-button-primary"
          style={primaryHalfStyle}
        >
          <Plus size={26} aria-hidden="true" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={handlePaste}
          aria-label="Paste from clipboard"
          data-testid="intent-fab-button-paste"
          style={pasteHalfStyle}
        >
          <ClipboardPaste size={22} aria-hidden="true" />
        </button>
      </div>
      <IntentFabSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
