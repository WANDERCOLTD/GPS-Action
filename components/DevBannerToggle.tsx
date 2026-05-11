'use client';

/**
 * @build-unit BU-one-click-polish
 * @spec build/session-briefs/bu-one-click-polish.md
 *
 * Eye / EyeOff button that toggles the dev "Logged in as / Switch user"
 * strip. Default = hidden. State lives in `localStorage` under
 * `gps:dev-banner-visible` so the choice survives page reloads.
 *
 * Keyboard shortcut: `g u` (g-system). The global `KeyboardShortcuts`
 * listener dispatches `TOGGLE_DEV_BANNER_EVENT` on `window`; this
 * component subscribes. Migrated from `⌘⇧U` (2026-05-11) so the
 * shortcut sits in the same g-prefix register as `g n`, `g f`, etc.
 * Help-overlay row is rendered from the registry directly.
 *
 * The toggle is dev/demo only — the parent (`<LoggedInAs />`) is
 * already gated by `NODE_ENV !== 'production' || isDemoMode()`. We
 * mirror the gate inside this component so it can be safely imported
 * elsewhere without leaking into prod builds.
 */

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, FC } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { TOGGLE_DEV_BANNER_EVENT } from '@/shared/shortcuts';

const STORAGE_KEY = 'gps:dev-banner-visible';

/** Read the persisted flag. Default = hidden when missing/invalid. */
export function readDevBannerVisible(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Persist the flag. Swallows quota / disabled-storage errors. */
export function writeDevBannerVisible(next: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
  } catch {
    // ignore — non-essential UI affordance
  }
}

/**
 * Custom event broadcast so peer components (`<DevBannerWrapper />`)
 * can re-read the flag without a state library. Prefixed to keep
 * the global event namespace tidy.
 */
const VISIBILITY_EVENT = 'gps:dev-banner-visibility-change';

export function emitDevBannerVisibilityChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(VISIBILITY_EVENT));
}

export function subscribeDevBannerVisibility(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(VISIBILITY_EVENT, handler);
  return () => window.removeEventListener(VISIBILITY_EVENT, handler);
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--colour-text-link)',
  cursor: 'pointer',
};

interface DevBannerToggleProps {
  /**
   * Whether this surface should render the toggle. Decided server-side
   * (NODE_ENV !== 'production' || isDemoMode()) and passed in — this
   * client component can't read isDemoMode() because it relies on a
   * non-public env var that isn't bundled into the client.
   */
  enabled: boolean;
}

export const DevBannerToggle: FC<DevBannerToggleProps> = ({ enabled }) => {
  const isDevSurface = enabled;
  const [visible, setVisible] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Hydration: read the flag once on mount. Avoids SSR/CSR mismatches
  // by rendering the default (hidden) state on first paint and then
  // reconciling with localStorage on the client.
  useEffect(() => {
    setVisible(readDevBannerVisible());
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    // Compute the next value from the persisted source so we never
    // call side-effecting code (writeDevBannerVisible, dispatchEvent)
    // from inside React's setState updater. React 19 may invoke the
    // updater during render; a synchronous CustomEvent dispatch from
    // there cascades into peer components' setState (e.g.
    // DevBannerWrapper subscribing to the visibility-change event),
    // which trips the "setState during render of another component"
    // warning.
    //
    // localStorage is the canonical source — reading it before the
    // toggle keeps the two state copies (this component's `visible`
    // ref + the persisted flag) in lock-step without relying on
    // stale React state.
    const next = !readDevBannerVisible();
    writeDevBannerVisible(next);
    setVisible(next);
    emitDevBannerVisibilityChange();
  }, []);

  // CustomEvent subscriber. The global `KeyboardShortcuts` listener
  // resolves `g u` against the registry and dispatches
  // `TOGGLE_DEV_BANNER_EVENT` on `window`. Subscribing (rather than
  // owning a keydown listener here) means the dev banner toggle
  // benefits from the global listener's inertness checks (typing
  // target / modifier keys / defaultPrevented) for free.
  useEffect(() => {
    if (!isDevSurface) return undefined;
    const handler = (): void => {
      toggle();
    };
    window.addEventListener(TOGGLE_DEV_BANNER_EVENT, handler);
    return () => window.removeEventListener(TOGGLE_DEV_BANNER_EVENT, handler);
  }, [isDevSurface, toggle]);

  if (!isDevSurface) return null;

  // Avoid showing a hydration-mismatched icon for one frame.
  const iconLabel = visible ? 'Hide dev banner (g, then u)' : 'Show dev banner (g, then u)';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={iconLabel}
      title={iconLabel}
      data-testid="dev-banner-toggle"
      data-visible={hydrated ? (visible ? 'true' : 'false') : 'false'}
      style={buttonStyle}
    >
      {visible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
    </button>
  );
};
