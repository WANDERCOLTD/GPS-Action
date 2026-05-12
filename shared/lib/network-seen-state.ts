/**
 * @build-unit bu-network-seen-state
 * @spec build/session-briefs/bu-network-seen-state.md
 *
 * Per-browser seen-state for /network cards. Stores two things in
 * localStorage:
 *
 *   1. `gps.network.lastVisitedAt` — ISO timestamp of the previous
 *      mount of /network. Used by the feed to compute `isNew` per
 *      card (card.sentAt > lastVisitedAt). Null on first visit, and
 *      the caller suppresses NEW pills until a value has been
 *      written (see Design principles in the brief — "first visit
 *      is a clean slate").
 *   2. `gps.network.dismissed` — JSON-encoded string[] of messageIds
 *      the user has dismissed on this browser. Dismissed cards
 *      render dimmed; toggling the icon adds/removes the id.
 *
 * v1 is deliberately browser-local rather than server-backed so
 * shared-login testers don't clobber each other's state. The
 * future server-side promotion lives in a separate BU.
 *
 * SSR safety: every function guards `typeof window === 'undefined'`
 * and returns sensible defaults. Importing this file from a server
 * component must not crash.
 *
 * Pruning: the dismissed-ids array is bounded by trimming on read
 * when it exceeds PRUNE_THRESHOLD. The 90-day window in Grant's
 * view means older ids are unreachable anyway; this is belt-and-
 * braces against runaway growth.
 */

const KEY_LAST_VISITED_AT = 'gps.network.lastVisitedAt';
const KEY_DISMISSED = 'gps.network.dismissed';
const PRUNE_THRESHOLD = 1000;

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getLastVisitedAt(): Date | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(KEY_LAST_VISITED_AT);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

export function setLastVisitedAt(when: Date): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(KEY_LAST_VISITED_AT, when.toISOString());
  } catch {
    // Quota / privacy mode — fail silently. Seen-state is best-effort
    // by design (the user just won't get the NEW signal).
  }
}

export function getDismissedIds(): Set<string> {
  if (!hasWindow()) return new Set();
  try {
    const raw = window.localStorage.getItem(KEY_DISMISSED);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed.filter((v): v is string => typeof v === 'string');
    if (ids.length > PRUNE_THRESHOLD) {
      // Trim to the most recent half on every read past the bound. Order
      // is insertion-order (toggles append); slicing from the tail
      // keeps the most-recently-dismissed ids, which are the most
      // likely to still be visible in the 90-day window.
      const trimmed = ids.slice(-Math.floor(PRUNE_THRESHOLD / 2));
      try {
        window.localStorage.setItem(KEY_DISMISSED, JSON.stringify(trimmed));
      } catch {
        // Same quota tolerance as above.
      }
      return new Set(trimmed);
    }
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export function isDismissed(messageId: string): boolean {
  return getDismissedIds().has(messageId);
}

/**
 * Toggle dismissal for a single messageId. Returns the new state
 * (`true` = now dismissed, `false` = now un-dismissed). No-op
 * (returns `false`) when called server-side.
 */
export function toggleDismissed(messageId: string): boolean {
  if (!hasWindow()) return false;
  const current = getDismissedIds();
  if (current.has(messageId)) {
    current.delete(messageId);
  } else {
    current.add(messageId);
  }
  try {
    window.localStorage.setItem(KEY_DISMISSED, JSON.stringify([...current]));
  } catch {
    // Quota / privacy mode — caller still sees the optimistic flip
    // via the returned boolean; the next reload will reset it.
  }
  return current.has(messageId);
}

/**
 * Test-only: wipe both keys. Not exported via the build; callers in
 * production should use the toggles + setters directly.
 */
export function __resetForTests(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(KEY_LAST_VISITED_AT);
    window.localStorage.removeItem(KEY_DISMISSED);
  } catch {
    // ignore
  }
}
