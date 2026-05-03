/**
 * Unit tests for the recently-viewed `localStorage` helper.
 *
 * @build-unit BU-search-surface
 * @spec architecture/decision-log.md (D078 §8)
 *
 * Vitest env is `node` and there is no DOM. We stub `window.localStorage`
 * with an in-memory `Map` so the helper's storage path runs end-to-end.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface FakeStorage {
  store: Map<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

function makeStorage(): FakeStorage {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

let fakeStorage: FakeStorage;

beforeEach(() => {
  fakeStorage = makeStorage();
  // @ts-expect-error — node env has no `window`; tests stub the minimum
  // surface the helper touches.
  globalThis.window = { localStorage: fakeStorage };
});

const { readRecentlyViewed, recordRecentlyViewed, RECENTLY_VIEWED_CAP } =
  await import('@/components/recently-viewed-posts');

describe('recently-viewed-posts', () => {
  it('returns [] when nothing has been recorded', () => {
    expect(readRecentlyViewed()).toEqual([]);
  });

  it('records a view and reads it back', () => {
    recordRecentlyViewed({ id: 'p1', label: 'Hello' });
    const items = readRecentlyViewed();
    expect(items.length).toBe(1);
    expect(items[0]?.id).toBe('p1');
    expect(items[0]?.label).toBe('Hello');
    expect(typeof items[0]?.viewedAt).toBe('string');
  });

  it('most recent record is at the front', () => {
    recordRecentlyViewed({ id: 'p1', label: 'First' });
    recordRecentlyViewed({ id: 'p2', label: 'Second' });
    const items = readRecentlyViewed();
    expect(items.map((i) => i.id)).toEqual(['p2', 'p1']);
  });

  it('caps at RECENTLY_VIEWED_CAP entries', () => {
    for (let i = 0; i < RECENTLY_VIEWED_CAP + 3; i += 1) {
      recordRecentlyViewed({ id: `p${i}`, label: `Post ${i}` });
    }
    const items = readRecentlyViewed();
    expect(items.length).toBe(RECENTLY_VIEWED_CAP);
    // Most recent first.
    expect(items[0]?.id).toBe(`p${RECENTLY_VIEWED_CAP + 2}`);
  });

  it('deduplicates — re-recording an existing id moves it to the front, no duplicates', () => {
    recordRecentlyViewed({ id: 'p1', label: 'A' });
    recordRecentlyViewed({ id: 'p2', label: 'B' });
    recordRecentlyViewed({ id: 'p1', label: 'A — updated label' });
    const items = readRecentlyViewed();
    expect(items.length).toBe(2);
    expect(items[0]?.id).toBe('p1');
    expect(items[0]?.label).toBe('A — updated label');
    expect(items[1]?.id).toBe('p2');
  });

  it('returns [] when stored payload is malformed JSON', () => {
    fakeStorage.setItem('gps:recently-viewed-posts', 'not json');
    expect(readRecentlyViewed()).toEqual([]);
  });

  it('returns [] and ignores stored payload that is not an array', () => {
    fakeStorage.setItem('gps:recently-viewed-posts', '{"some":"object"}');
    expect(readRecentlyViewed()).toEqual([]);
  });

  it('skips malformed entries while keeping valid ones', () => {
    fakeStorage.setItem(
      'gps:recently-viewed-posts',
      JSON.stringify([
        { id: 'good', label: 'Yes', viewedAt: '2026-05-03T00:00:00Z' },
        { id: 42 },
        null,
        { id: 'also-good', label: 'Yes', viewedAt: '2026-05-03T00:00:00Z' },
      ]),
    );
    const items = readRecentlyViewed();
    expect(items.map((i) => i.id)).toEqual(['good', 'also-good']);
  });

  it('returns [] when window is undefined (SSR)', () => {
    const target = globalThis as { window?: unknown };
    const originalWindow = target.window;
    delete target.window;
    expect(readRecentlyViewed()).toEqual([]);
    target.window = originalWindow;
  });

  it('swallows localStorage.setItem throws (quota / privacy mode)', () => {
    const throwingStorage: FakeStorage = {
      ...fakeStorage,
      setItem: vi.fn(() => {
        throw new Error('quota_exceeded');
      }),
    };
    // @ts-expect-error — replace with throwing storage
    globalThis.window.localStorage = throwingStorage;
    expect(() => recordRecentlyViewed({ id: 'p1', label: 'X' })).not.toThrow();
  });
});
