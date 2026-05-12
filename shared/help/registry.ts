/**
 * @build-unit bu-page-header-system
 * @spec docs/build/session-briefs/bu-page-header-system.md
 *
 * Per-page help-content registry. `HELP_REGISTRY` keys are pathname
 * patterns (exact match wins; otherwise the longest-prefix match
 * applies — `/post/abc` falls back to `/post` if no exact entry).
 *
 * `matchHelpEntry` is the single lookup used by `<HelpSheet>` (which
 * decides what to render) and `<UserMenu>` (which decides whether to
 * show the "Help with this page" entry at all — when this returns
 * null the menu item is hidden, honest-copy default).
 *
 * Content authoring is the `bu-page-help-content` follow-up. This BU
 * seeds the registry with a single `/network` entry so the wiring is
 * demonstrably end-to-end in the same PR; every other route's entry
 * lands in the follow-up.
 */

export interface HelpShortcut {
  key: string;
  label: string;
}

export interface HelpEntry {
  title: string;
  summary: string;
  actions: string[];
  shortcuts?: HelpShortcut[];
}

export const HELP_REGISTRY: Record<string, HelpEntry> = {
  '/network': {
    title: 'Network',
    summary:
      'Posts shared in the GPS Action WhatsApp network surface here as they arrive. Triage them — keep what matters, dismiss the rest, share onward when a wider audience needs to see it.',
    actions: [
      'Tap a source chip to filter to one (or a few) WhatsApp groups.',
      'Tap a sort pill to flip between newest and oldest first.',
      'React on a card to signal value to the rest of the network.',
      'Use the share buttons to forward a card to WhatsApp or socials.',
      'Refresh from your avatar menu to pull the latest messages.',
    ],
    shortcuts: [
      { key: 'J / K', label: 'Move between cards (when implemented)' },
      { key: 'R', label: 'Refresh the list' },
    ],
  },
};

export function matchHelpEntry(pathname: string): HelpEntry | null {
  const exact = HELP_REGISTRY[pathname];
  if (exact) return exact;
  const keys = Object.keys(HELP_REGISTRY).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pathname.startsWith(`${key}/`)) {
      const entry = HELP_REGISTRY[key];
      if (entry) return entry;
    }
  }
  return null;
}
