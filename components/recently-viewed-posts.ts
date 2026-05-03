/**
 * @build-unit BU-search-surface
 * @spec architecture/decision-log.md (D078 §8)
 *
 * Client-only `localStorage` helpers for "Recently viewed" — the last
 * post ids the member opened. D078 §8 puts this on the client (no
 * schema change, doesn't sync across devices) and caps at 5.
 *
 * Surface: written by `<RecentlyViewedTracker>` on `/post/[id]` mount,
 * read by `<SearchShell>` in its zero-query empty state.
 *
 * SSR safety: every helper checks for `window` so it's safe to call
 * during a render that runs both on the server and the client. Reads
 * should still be wrapped in `useEffect` to avoid hydration mismatch
 * with server-rendered empty state.
 */

const STORAGE_KEY = 'gps:recently-viewed-posts';
export const RECENTLY_VIEWED_CAP = 5;

export interface RecentlyViewedItem {
  id: string;
  label: string;
  viewedAt: string;
}

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function parse(raw: string | null): RecentlyViewedItem[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (entry): entry is RecentlyViewedItem =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as RecentlyViewedItem).id === 'string' &&
          typeof (entry as RecentlyViewedItem).label === 'string' &&
          typeof (entry as RecentlyViewedItem).viewedAt === 'string',
      )
      .slice(0, RECENTLY_VIEWED_CAP);
  } catch {
    return [];
  }
}

export function readRecentlyViewed(): RecentlyViewedItem[] {
  if (!isClient()) return [];
  return parse(window.localStorage.getItem(STORAGE_KEY));
}

export function recordRecentlyViewed(item: { id: string; label: string }): void {
  if (!isClient()) return;
  const existing = readRecentlyViewed().filter((entry) => entry.id !== item.id);
  const next: RecentlyViewedItem[] = [
    { id: item.id, label: item.label, viewedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, RECENTLY_VIEWED_CAP);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage can throw under quota or in privacy modes — drop
    // silently; recently-viewed is a convenience, not load-bearing.
  }
}
