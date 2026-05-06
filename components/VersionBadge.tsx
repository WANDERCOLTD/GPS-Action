'use client';

/**
 * @build-unit BU-versioning BU-feed-card-affordances
 * @spec docs/process/versioning.md
 *
 * App version badge — small fixed-position chip, bottom-left of every
 * page. Reads build-time env vars set by next.config.mjs:
 *   - NEXT_PUBLIC_APP_VERSION   (from package.json)
 *   - NEXT_PUBLIC_APP_SHA       (best-effort short git sha)
 *   - NEXT_PUBLIC_APP_ENV       (development | preview | production)
 *
 * Visible in every environment per the team decision (pre-launch — knowing
 * which version is deployed is useful). Colour shifts by environment so
 * "am I on staging or prod?" is unambiguous.
 *
 * Two affordances on the badge:
 *
 *   - Tap the version text → hard-reload (cache-bust). iPhone Chrome
 *     and Safari standalone PWAs cache JS aggressively; pull-to-refresh
 *     sometimes uses the cached bundle. Tapping forces a fresh
 *     navigation by appending a unique `_cb` query param.
 *
 *   - Tap the copy icon → copies "v0.2.X · dev · sha · /current/path"
 *     to the clipboard. For paste-into-bug-report. Briefly flips the
 *     icon to a check-mark on success.
 */

import { useState, type CSSProperties } from 'react';
import { Copy, Check } from 'lucide-react';

type AppEnv = 'development' | 'preview' | 'production' | (string & {});

const ENV_COLOURS: Record<string, { bg: string; fg: string; label: string }> = {
  development: {
    bg: 'color-mix(in oklab, var(--colour-info) 18%, transparent)',
    fg: 'var(--colour-info)',
    label: 'dev',
  },
  preview: {
    bg: 'color-mix(in oklab, var(--colour-warning) 18%, transparent)',
    fg: 'var(--colour-warning)',
    label: 'preview',
  },
  production: {
    bg: 'color-mix(in oklab, var(--colour-success) 18%, transparent)',
    fg: 'var(--colour-success)',
    label: 'prod',
  },
};

function paletteFor(env: AppEnv): { bg: string; fg: string; label: string } {
  return (
    ENV_COLOURS[env] ?? {
      bg: 'color-mix(in oklab, var(--colour-text-secondary) 14%, transparent)',
      fg: 'var(--colour-text-secondary)',
      label: env || 'unknown',
    }
  );
}

export function VersionBadge() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unversioned';
  const sha = process.env.NEXT_PUBLIC_APP_SHA ?? '';
  const env = (process.env.NEXT_PUBLIC_APP_ENV ?? 'development') as AppEnv;
  const palette = paletteFor(env);
  const [copied, setCopied] = useState(false);

  const containerStyle: CSSProperties = {
    position: 'fixed',
    // Bottom-LEFT — bottom-right is occupied by the FAB pill (z-index
    // 100, ~134px wide × 56px tall), and the badge previously sat
    // behind it which made the tap-to-reload affordance unusable on
    // iPhone.
    left: 'var(--space-3)',
    bottom: 'var(--space-3)',
    zIndex: 50,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-pill)',
    background: palette.bg,
    border: `1px solid ${palette.fg}`,
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
    fontSize: 'var(--text-2xs)',
    lineHeight: 1.2,
    backdropFilter: 'blur(6px)',
    overflow: 'hidden',
  };

  const reloadButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '4px 10px',
    background: 'transparent',
    border: 'none',
    color: palette.fg,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    cursor: 'pointer',
    userSelect: 'all',
  };

  const copyButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    background: 'transparent',
    border: 'none',
    borderLeft: `1px solid ${palette.fg}`,
    color: palette.fg,
    cursor: 'pointer',
  };

  function buildClipboardText(): string {
    const path =
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
    const parts = [`v${version}`, palette.label, sha, path].filter((p) => p.length > 0);
    return parts.join(' · ');
  }

  function handleCopyClick(): void {
    const text = buildClipboardText();
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Clipboard write failures are non-fatal (e.g. focus issues
        // on Safari) — silently ignore; user can long-press the badge
        // and copy text the native way.
      });
  }

  return (
    <div data-testid="nav-version-badge" data-app-env={env} style={containerStyle}>
      <button
        type="button"
        onClick={handleReloadClick}
        data-testid="nav-version-badge-reload"
        title="Tap to hard-reload (cache-bust)"
        aria-label={`v${version} ${palette.label} ${sha} — tap to hard-reload`}
        style={reloadButtonStyle}
      >
        <span data-testid="version-badge-version">v{version}</span>
        <span aria-hidden="true" style={{ opacity: 0.6 }}>
          ·
        </span>
        <span data-testid="version-badge-env">{palette.label}</span>
        {sha ? (
          <>
            <span aria-hidden="true" style={{ opacity: 0.6 }}>
              ·
            </span>
            <span data-testid="version-badge-sha">{sha}</span>
          </>
        ) : null}
        <span aria-hidden="true" style={{ opacity: 0.6, marginLeft: 2 }}>
          ↻
        </span>
      </button>
      <button
        type="button"
        onClick={handleCopyClick}
        data-testid="nav-version-badge-copy"
        data-copied={copied ? 'true' : 'false'}
        title="Copy version + path"
        aria-label="Copy version and current path to clipboard"
        style={copyButtonStyle}
      >
        {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      </button>
    </div>
  );
}

async function forceReload(): Promise<void> {
  // Maximum-strength reload for iOS Safari, which is sticky about
  // serving cached JS chunks even after a soft refresh. Steps:
  //
  //   1. Clear Cache API entries (PWA / SW caches; defensive — we
  //      don't ship a service worker today, but a future PWA setup
  //      would benefit).
  //   2. Unregister any registered service workers (defensive again).
  //   3. Append a unique `_cb` query param so the URL is novel and
  //      can't be served from disk cache.
  //   4. `location.replace()` (not `.href = ...`) so the navigation
  //      bypasses Safari's back-forward cache and forces a real
  //      network round-trip.
  if (typeof window === 'undefined') return;

  if ('caches' in window) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    } catch {
      // Cache API failures are non-fatal — keep going.
    }
  }

  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      // SW unregister failures are non-fatal — keep going.
    }
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('_cb');
  url.searchParams.set('_cb', String(Date.now()));
  window.location.replace(url.toString());
}

function handleReloadClick(): void {
  void forceReload();
}
