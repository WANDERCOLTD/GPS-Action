'use client';

/**
 * @build-unit BU-sticky-nav
 * @spec architecture/decision-log.md (D065)
 *
 * In-header soft-refresh button. Calls `router.refresh()` — Next.js'
 * server-component re-render that preserves scroll and client state.
 *
 * Why this exists: iOS Safari home-screen bookmarks launch in
 * standalone-ish mode without the URL bar, so there is no native
 * reload control. This button is the primitive that fills that gap;
 * it works equally well in regular Safari, Chrome, and desktop.
 */

import * as React from 'react';
import { useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  marginLeft: 'auto',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--colour-text-link)',
  cursor: 'pointer',
};

const spinAnimation: CSSProperties = {
  animation: 'gps-refresh-spin 700ms linear infinite',
};

export function HeaderRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <style>{`@keyframes gps-refresh-spin { to { transform: rotate(360deg); } }`}</style>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        aria-label="Refresh page"
        data-testid="header-refresh-button"
        style={buttonStyle}
      >
        {isPending ? (
          <Loader2 size={18} aria-hidden="true" style={spinAnimation} />
        ) : (
          <RefreshCw size={18} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
