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
 * Content scope for this BU: `/network` is the canonical surface and
 * carries a real entry; `/feed`, `/board`, `/calendar`, and
 * `/notifications` are test/demo surfaces today and carry honest
 * "test feature" entries that explain what the page is for and that
 * it will retire once `/network` covers all post types. Authoring for
 * the remaining routes (`/requests`, `/search`, `/settings`,
 * `/compose`, `/capabilities`, `/post/[id]`) lands in the follow-up
 * `bu-page-help-content`.
 *
 * Honest-copy rule: don't list shortcuts that don't exist. Global
 * keyboard bindings (`?` to open the shortcut overlay, `g`-sequences
 * to navigate) live in `shared/shortcuts.ts` and have their own help
 * surface — don't duplicate them here unless a binding is genuinely
 * page-specific.
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
  },
  '/feed': {
    title: 'Feed',
    summary:
      'Test feature — a seeded demo feed of structured posts. The live coordination view is /network, and this page will retire once /network covers all post types.',
    actions: [
      'Tap a post to open its detail view.',
      'React with the inline pill at the bottom of each card.',
      'Use the filter chips at the top to narrow by post kind.',
    ],
  },
  '/board': {
    title: 'Coordination',
    summary:
      'Test feature — kanban for working-group coordination. Will retire once /network exposes coordination cards directly.',
    actions: [
      'Tap a group card to open its board.',
      'Inside a board, tickets are read-only today; drag-to-move lands in a later build seq.',
    ],
  },
  '/calendar': {
    title: 'Calendar',
    summary:
      'Test feature — surface for events and time-bearing posts. Will retire once /network exposes calendar filters on the main feed.',
    actions: [
      'Switch between Agenda, Month, and Near views using the toggle below.',
      'In Month view, tap a date to see its events.',
      'In Near view, allow location to sort events by distance from you.',
    ],
  },
  '/notifications': {
    title: 'Notifications',
    summary:
      'Test feature — notifications from the coordination-board demo path. Will retire once /network notifications land.',
    actions: [
      'Tap a row to open the source ticket; reading it acknowledges the notification.',
      'Tinted rows are unacknowledged; dim rows are already read.',
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
