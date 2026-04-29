'use client';

/**
 * @build-unit BU-versioning BU-feed-card-affordances
 * @spec docs/process/versioning.md
 *
 * App version badge — small fixed-position chip, bottom-right of every
 * page. Reads build-time env vars set by next.config.mjs:
 *   - NEXT_PUBLIC_APP_VERSION   (from package.json)
 *   - NEXT_PUBLIC_APP_SHA       (best-effort short git sha)
 *   - NEXT_PUBLIC_APP_ENV       (development | preview | production)
 *
 * Visible in every environment per the team decision (pre-launch — knowing
 * which version is deployed is useful). Colour shifts by environment so
 * "am I on staging or prod?" is unambiguous.
 *
 * BU-feed-card-affordances — tap to hard-reload. iPhone Chrome and
 * Safari standalone PWAs cache JS aggressively; pull-to-refresh
 * sometimes uses the cached bundle. Tapping the badge forces a
 * fresh navigation by appending a unique `_cb` query param, which
 * bypasses URL-based caching. The user can then read the SHA on
 * the badge itself to confirm a new build loaded.
 */

import type { CSSProperties } from 'react';

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
    gap: 'var(--space-2)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-pill)',
    background: palette.bg,
    color: palette.fg,
    border: `1px solid ${palette.fg}`,
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
    fontSize: 'var(--text-2xs)',
    lineHeight: 1.2,
    cursor: 'pointer',
    userSelect: 'all',
    backdropFilter: 'blur(6px)',
  };

  return (
    <button
      type="button"
      onClick={forceReload}
      data-testid="version-badge"
      data-app-env={env}
      title="Tap to hard-reload (cache-bust)"
      aria-label={`v${version} ${palette.label} ${sha} — tap to hard-reload`}
      style={containerStyle}
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
  );
}

function forceReload(): void {
  // Append a unique `_cb` (cache-buster) query param so the browser
  // sees a different URL and fetches HTML + chunk manifest fresh.
  // Preserves any existing query params and hash. Strips the previous
  // `_cb` if present so the URL doesn't grow indefinitely on repeat
  // taps.
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('_cb');
  url.searchParams.set('_cb', String(Date.now()));
  window.location.href = url.toString();
}
