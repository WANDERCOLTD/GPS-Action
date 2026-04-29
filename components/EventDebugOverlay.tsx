'use client';

/* eslint-disable local-rules/require-testid, local-rules/require-design-tokens -- temporary debug overlay; reverted before merge per BU-feed-card-affordances brief. Hard-coded colours used deliberately (must be unmistakable on iPhone). */

/**
 * @build-unit BU-feed-card-affordances
 * @spec build/session-briefs/bu-feed-card-affordances.md
 *
 * Temporary on-screen debug trace. Opt-in via `?debug=1` query param.
 * Listens to document-level `click` and `pointerdown` and renders the
 * last N events with target tag + testid. Lets us see the true event
 * sequence on iPhone without needing Mac+Safari Web Inspector.
 *
 * Remove this component before the PR merges.
 */

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

interface DebugEntry {
  readonly t: number;
  readonly type: string;
  readonly tag: string;
  readonly testid: string;
}

const MAX_ENTRIES = 10;

export function EventDebugOverlay(): ReactElement | null {
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<DebugEntry[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const debugParam = new URL(window.location.href).searchParams.get('debug') === '1';
    // eslint-disable-next-line no-console
    console.log(
      '[EventDebugOverlay] debug param =',
      debugParam,
      'APP_ENV =',
      process.env.NEXT_PUBLIC_APP_ENV,
    );
    setEnabled(debugParam);
  }, []);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const start = Date.now();
    function handler(type: string) {
      return (event: Event) => {
        const target = event.target as Element | null;
        const tag = target?.tagName?.toLowerCase() ?? '?';
        const testid = target?.closest('[data-testid]')?.getAttribute('data-testid') ?? '—';
        setEntries((prev) =>
          [{ t: Date.now() - start, type, tag, testid }, ...prev].slice(0, MAX_ENTRIES),
        );
      };
    }
    const click = handler('click');
    const pointer = handler('pointerdown');
    document.addEventListener('click', click, true);
    document.addEventListener('pointerdown', pointer, true);
    return () => {
      document.removeEventListener('click', click, true);
      document.removeEventListener('pointerdown', pointer, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div data-testid="event-debug-overlay" style={overlayStyle}>
      <div style={headingStyle}>
        events ({entries.length})
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEntries([]);
          }}
          style={clearStyle}
        >
          clear
        </button>
      </div>
      {entries.length === 0 ? (
        <div style={{ opacity: 0.6 }}>tap something…</div>
      ) : (
        entries.map((e, i) => (
          <div key={i} style={rowStyle(e.type)}>
            <span style={{ minWidth: 60, opacity: 0.6 }}>{e.t}ms</span>
            <span style={{ minWidth: 90, fontWeight: 600 }}>{e.type}</span>
            <span style={{ minWidth: 36, opacity: 0.7 }}>{e.tag}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {e.testid}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 'var(--space-2)',
  left: 'var(--space-2)',
  right: 'var(--space-2)',
  zIndex: 9999,
  padding: 'var(--space-2)',
  background: 'rgba(28, 28, 26, 0.94)',
  color: '#e9e7df',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '11px',
  lineHeight: 1.35,
  borderRadius: 'var(--radius-sm)',
  border: '2px solid #ff4f4f',
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  pointerEvents: 'auto',
  maxHeight: '40vh',
  overflowY: 'auto',
};

const headingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  paddingBottom: 4,
  borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
  marginBottom: 4,
  fontWeight: 700,
};

const clearStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.12)',
  color: 'inherit',
  border: 0,
  borderRadius: 4,
  padding: '2px 8px',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  cursor: 'pointer',
};

function rowStyle(type: string): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: type === 'click' ? '#9ad3ff' : '#ffd47e',
  };
}
