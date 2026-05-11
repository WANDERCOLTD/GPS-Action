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
import { useRouter, usePathname } from 'next/navigation';
import { Plus, ClipboardPaste } from 'lucide-react';
import { IntentFabSheet } from './IntentFabSheet';
import { readClipboardAndContinue } from './IntentFabPasteHandler';

// Routes where the FAB suppresses itself. /network is a read-only
// inbound surface — composing a post from there is off-flow.
const HIDDEN_FAB_PATHS = ['/network'];

const pillStyle: CSSProperties = {
  position: 'fixed',
  bottom: 'var(--space-6)',
  right: 'var(--space-6)',
  display: 'flex',
  alignItems: 'stretch',
  height: 64,
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-primary)',
  color: 'var(--colour-primary-contrast)',
  boxShadow: '0 4px 16px color-mix(in srgb, var(--colour-primary) 35%, transparent)',
  overflow: 'hidden',
  zIndex: 100,
  // Removes the iOS 300ms tap delay and double-tap-to-zoom on the
  // pill so the press registers a real click instead of decaying
  // into a "highlight then nothing" gesture.
  touchAction: 'manipulation',
};

const halfBase: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
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
  flex: '0 0 84px',
};

const pasteHalfStyle: CSSProperties = {
  ...halfBase,
  flex: '0 0 64px',
  borderLeft: '1px solid color-mix(in oklch, currentColor 50%, transparent)',
};

const captionStyle: CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-ui)',
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: '0.02em',
  color: 'color-mix(in oklch, currentColor 85%, transparent)',
};

export function IntentFab() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname && HIDDEN_FAB_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

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
          title="Create a post"
          data-testid="intent-fab-button-primary"
          style={primaryHalfStyle}
        >
          <Plus size={24} aria-hidden="true" strokeWidth={2.5} />
          <span data-testid="intent-fab-caption-primary" style={captionStyle}>
            Post
          </span>
        </button>
        <button
          type="button"
          onClick={handlePaste}
          aria-label="Paste from clipboard"
          title="Paste a link"
          data-testid="intent-fab-button-paste"
          style={pasteHalfStyle}
        >
          <ClipboardPaste size={20} aria-hidden="true" />
          <span data-testid="intent-fab-caption-paste" style={captionStyle}>
            Paste
          </span>
        </button>
      </div>
      <IntentFabSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
