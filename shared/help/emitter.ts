/**
 * @build-unit bu-page-header-system
 * @spec docs/build/session-briefs/bu-page-header-system.md
 *
 * Module-level event emitter for the per-page HelpSheet. The
 * `<UserMenu>` "Help with this page" entry dispatches via
 * `openHelpSheet()`; the `<HelpSheet>` instance mounted in the root
 * layout subscribes and toggles its `open` state. No React context
 * plumbing — works across the AppNav / page-content boundary because
 * `window` is the carrier.
 *
 * SSR-safe: both functions no-op when `window` is undefined.
 */

const EVENT_NAME = 'gps:help-sheet-open';

export function openHelpSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function subscribeHelpSheet(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}
