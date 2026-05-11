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
 * DIAGNOSTIC OVERLAY (temporary). The "+" half also increments four
 * visible counters — click / touchstart / touchend / pointerdown —
 * rendered in a black badge above the FAB. On iPhone we're seeing
 * the press flash but no dialog open; the counters tell us whether
 * the click is firing at all, which fork the bug is on. Revert this
 * overlay once the cause is known.
 *
 * Open/close state is owned by `Dialog.Root` here. The "+" button is
 * a `Dialog.Trigger` (Radix handles the open click natively to dodge
 * the iOS ghost-click race that a manual setOpen handler triggers).
 */

import * as React from 'react';
import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, ClipboardPaste } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { IntentFabSheet } from './IntentFabSheet';
import { readClipboardAndContinue } from './IntentFabPasteHandler';

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

const primaryHalfStyle: CSSProperties = { ...halfBase, flex: '0 0 84px' };
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

const debugBadgeStyle: CSSProperties = {
  position: 'fixed',
  bottom: 'calc(var(--space-6) + 72px)',
  right: 'var(--space-6)',
  background: 'var(--colour-text-primary)',
  color: 'var(--colour-surface-canvas)',
  fontFamily: 'monospace',
  fontSize: 12,
  padding: '6px 10px',
  borderRadius: 8,
  zIndex: 101,
  pointerEvents: 'none',
  whiteSpace: 'pre',
};

export function IntentFab() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Diagnostic counters for the "+" half. Temporary — see header.
  const [clickCount, setClickCount] = useState(0);
  const [touchStartCount, setTouchStartCount] = useState(0);
  const [touchEndCount, setTouchEndCount] = useState(0);
  const [pointerDownCount, setPointerDownCount] = useState(0);
  // Hydration probe — flips to true after first client-side effect.
  // If "h N" stays N on the iPhone, React isn't running the bundle
  // (hydration failed / bundle error), which is why no events fire.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div
        style={debugBadgeStyle}
        data-testid="intent-fab-debug-badge"
        aria-hidden="true"
      >{`hydrate ${hydrated ? 'Y' : 'N'}\nclick   ${clickCount}\nts      ${touchStartCount}\nte      ${touchEndCount}\npd      ${pointerDownCount}\nopen    ${open ? 'Y' : 'N'}`}</div>
      <div style={pillStyle} data-testid="intent-fab" role="group" aria-label="Create or paste">
        <Dialog.Trigger asChild>
          <button
            type="button"
            onClick={() => setClickCount((n) => n + 1)}
            onTouchStart={() => setTouchStartCount((n) => n + 1)}
            onTouchEnd={() => setTouchEndCount((n) => n + 1)}
            onPointerDown={() => setPointerDownCount((n) => n + 1)}
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
        </Dialog.Trigger>
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
      <IntentFabSheet onClose={() => setOpen(false)} />
    </Dialog.Root>
  );
}
