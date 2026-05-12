'use client';

/**
 * @build-unit bu-page-header-system
 * @spec docs/build/session-briefs/bu-page-header-system.md
 *
 * Per-page help drawer. Single instance mounted in the root layout.
 * Opens when `openHelpSheet()` fires (from the UserMenu "Help with
 * this page" entry, or any future trigger). Reads `usePathname()`
 * and looks the route up in `HELP_REGISTRY`; renders nothing when
 * there's no entry — honest copy, no "help unavailable" state.
 *
 * Layout is breakpoint-adaptive without media-query CSS: a small
 * `matchMedia('(max-width: 640px)')` hook flips between a right-side
 * panel (desktop) and a bottom sheet (phone). Same Radix Dialog
 * primitives for both — focus trap, ESC-to-close, ARIA wired by Radix.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { matchHelpEntry, type HelpEntry } from '@/shared/help/registry';
import { subscribeHelpSheet } from '@/shared/help/emitter';

const MOBILE_QUERY = '(max-width: 640px)';

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    function onChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches);
    }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'color-mix(in oklab, black 32%, transparent)',
  zIndex: 500,
};

const desktopContentStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 'min(420px, 100vw)',
  background: 'var(--colour-surface-raised)',
  borderLeft: '1px solid var(--colour-border-subtle)',
  padding: 'var(--space-5) var(--space-5) var(--space-6)',
  overflowY: 'auto',
  zIndex: 501,
  fontFamily: 'var(--font-ui)',
  color: 'var(--colour-text-primary)',
};

const mobileContentStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  maxHeight: '78vh',
  background: 'var(--colour-surface-raised)',
  borderTop: '1px solid var(--colour-border-subtle)',
  borderTopLeftRadius: 'var(--radius-lg)',
  borderTopRightRadius: 'var(--radius-lg)',
  padding: 'var(--space-5) var(--space-4) var(--space-6)',
  overflowY: 'auto',
  zIndex: 501,
  fontFamily: 'var(--font-ui)',
  color: 'var(--colour-text-primary)',
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  marginBottom: 'var(--space-3)',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-xl)',
  fontWeight: 'var(--weight-bold)',
  lineHeight: 'var(--line-tight)',
};

const closeButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--colour-text-secondary)',
  cursor: 'pointer',
  flexShrink: 0,
};

const summaryStyle: CSSProperties = {
  margin: '0 0 var(--space-4)',
  color: 'var(--colour-text-secondary)',
  fontSize: 'var(--text-base)',
  lineHeight: 'var(--line-relaxed)',
};

const sectionHeadingStyle: CSSProperties = {
  margin: 'var(--space-4) 0 var(--space-2)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--colour-text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  paddingLeft: 'var(--space-5)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--line-relaxed)',
  color: 'var(--colour-text-primary)',
};

const shortcutRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-3)',
  fontSize: 'var(--text-sm)',
  marginBottom: 'var(--space-2)',
};

const shortcutKeyStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  padding: 'var(--space-1) var(--space-2)',
  background: 'var(--colour-surface-sunken)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--colour-text-primary)',
  minWidth: 56,
  textAlign: 'center',
};

interface HelpSheetBodyProps {
  entry: HelpEntry;
  isMobile: boolean;
}

function HelpSheetBody({ entry, isMobile }: HelpSheetBodyProps) {
  return (
    <Dialog.Content
      data-testid="help-sheet"
      data-variant={isMobile ? 'mobile' : 'desktop'}
      style={isMobile ? mobileContentStyle : desktopContentStyle}
    >
      <div style={headerRowStyle}>
        <Dialog.Title data-testid="help-sheet-title" style={titleStyle}>
          {entry.title}
        </Dialog.Title>
        <Dialog.Close asChild>
          <button
            type="button"
            data-testid="help-sheet-close"
            aria-label="Close help"
            style={closeButtonStyle}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </Dialog.Close>
      </div>

      <Dialog.Description data-testid="help-sheet-summary" style={summaryStyle}>
        {entry.summary}
      </Dialog.Description>

      {entry.actions.length > 0 && (
        <>
          <h3 style={sectionHeadingStyle}>What you can do</h3>
          <ul data-testid="help-sheet-actions" style={listStyle}>
            {entry.actions.map((action, index) => (
              <li key={index} style={{ marginBottom: 'var(--space-1)' }}>
                {action}
              </li>
            ))}
          </ul>
        </>
      )}

      {entry.shortcuts && entry.shortcuts.length > 0 && !isMobile && (
        <>
          <h3 style={sectionHeadingStyle}>Keyboard shortcuts</h3>
          <div data-testid="help-sheet-shortcuts">
            {entry.shortcuts.map((shortcut, index) => (
              <div key={index} style={shortcutRowStyle}>
                <span style={shortcutKeyStyle}>{shortcut.key}</span>
                <span style={{ color: 'var(--colour-text-secondary)' }}>{shortcut.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Dialog.Content>
  );
}

export function HelpSheet() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const entry = pathname ? matchHelpEntry(pathname) : null;

  useEffect(() => {
    return subscribeHelpSheet(() => setOpen(true));
  }, []);

  if (!entry) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <HelpSheetBody entry={entry} isMobile={isMobile} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}
