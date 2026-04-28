'use client';

/**
 * @build-unit BU-fab-intent-picker BU-link-first-composer
 * @spec architecture/decision-log.md (D044, D061, D062)
 * @spec build/session-briefs/bu-link-first-composer.md
 *
 * Split FAB — one rounded pill, two tap targets:
 *   • left "+"   → opens the IntentFabStarter card (paste-or-type)
 *   • right "📋" → reads clipboard and routes straight to /compose
 *
 * Both halves funnel through `IntentFabPasteHandler` so behaviour
 * cannot drift between the in-card paste button and this shortcut.
 * On clipboard miss (empty / denied / unsupported) the paste tap
 * falls back to opening the starter so the member can paste manually.
 *
 * The kind picker remains reachable via the starter's "Pick a kind
 * instead →" escape, preserving the BU-fab-intent-picker UX for
 * members who already know what they want to post.
 */

import * as React from 'react';
import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardPaste } from 'lucide-react';
import { KindPickerSheet } from './KindPickerSheet';
import { IntentFabStarter } from './IntentFabStarter';
import {
  buildComposeHref,
  payloadFromInput,
  readClipboardAndContinue,
} from './IntentFabPasteHandler';

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
  const [starterOpen, setStarterOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePaste = async () => {
    const outcome = await readClipboardAndContinue(router);
    if (outcome !== 'success') {
      setStarterOpen(true);
    }
  };

  const handleContinue = (payload: { kind: 'url' | 'text'; value: string }) => {
    const safe = payloadFromInput(payload.value);
    if (!safe) return;
    setStarterOpen(false);
    router.push(buildComposeHref(safe));
  };

  const handlePickKind = () => {
    setStarterOpen(false);
    setPickerOpen(true);
  };

  return (
    <>
      <div style={pillStyle} data-testid="intent-fab" role="group" aria-label="Create or paste">
        <button
          type="button"
          onClick={() => setStarterOpen(true)}
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
      <IntentFabStarter
        open={starterOpen}
        onClose={() => setStarterOpen(false)}
        onContinue={handleContinue}
        onPickKind={handlePickKind}
      />
      <KindPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}
