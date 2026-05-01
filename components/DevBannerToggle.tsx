'use client';

/**
 * @build-unit BU-one-click-polish
 * @spec build/session-briefs/bu-one-click-polish.md
 *
 * Eye / EyeOff button that toggles the dev "Logged in as / Switch user"
 * strip. Default = hidden. State lives in `localStorage` under
 * `gps:dev-banner-visible` so the choice survives page reloads.
 *
 * Keyboard shortcut: ⌘⇧U (Mac) / Ctrl+Shift+U (Win/Linux). Listener
 * lives on `window` so the shortcut works regardless of focus, but
 * only when the toggle is mounted (which is itself dev-only).
 *
 * The toggle is dev/demo only — the parent (`<LoggedInAs />`) is
 * already gated by `NODE_ENV !== 'production' || isDemoMode()`. We
 * mirror the gate inside this component so it can be safely imported
 * elsewhere without leaking into prod builds.
 */

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, FC } from 'react';
import { Eye, EyeOff } from 'lucide-react';

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

/**
 * `Cmd+Shift+U` on Mac, `Ctrl+Shift+U` elsewhere. Match either modifier
 * — keyboard layout permitting, both work everywhere.
 */
function isToggleShortcut(event: KeyboardEvent): boolean {
  if (!(event.metaKey || event.ctrlKey)) return false;
  if (!event.shiftKey) return false;
  return event.key === 'U' || event.key === 'u';
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
    setVisible((prev) => {
      const next = !prev;
      writeDevBannerVisible(next);
      emitDevBannerVisibilityChange();
      return next;
    });
  }, []);

  // Keyboard shortcut listener.
  useEffect(() => {
    if (!isDevSurface) return undefined;
    const handler = (event: KeyboardEvent): void => {
      if (!isToggleShortcut(event)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDevSurface, toggle]);

  if (!isDevSurface) return null;

  // Avoid showing a hydration-mismatched icon for one frame.
  const iconLabel = visible ? 'Hide dev banner (⌘⇧U)' : 'Show dev banner (⌘⇧U)';

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
