/**
 * @build-unit bu-network-seen-state
 *
 * Browser-storage util for /network seen-state. Vitest env is `node`
 * repo-wide; we install a tiny Map-backed `window.localStorage`
 * before each test instead of pulling in jsdom for one util.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface TestWindow {
  localStorage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
  };
}

function installLocalStorageStub(): void {
  const store = new Map<string, string>();
  const stub: TestWindow = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k)! : null),
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    },
  };
  // Vitest exposes `globalThis` — assign window onto it so the util's
  // `typeof window !== 'undefined'` guard sees a real object.
  (globalThis as unknown as { window: TestWindow }).window = stub;
}

function removeLocalStorageStub(): void {
  delete (globalThis as unknown as { window?: TestWindow }).window;
}

beforeEach(() => {
  installLocalStorageStub();
});

afterEach(() => {
  removeLocalStorageStub();
});

// Imports must come after the stub is installable; vitest hoists
// import statements above the `beforeEach`, but the util only
// reads `window` lazily inside each call, so this ordering is safe.
import {
  __resetForTests,
  getDismissedIds,
  getLastVisitedAt,
  isDismissed,
  setLastVisitedAt,
  toggleDismissed,
} from '@/shared/lib/network-seen-state';

describe('lastVisitedAt', () => {
  it('returns null when nothing has been written', () => {
    expect(getLastVisitedAt()).toBeNull();
  });

  it('round-trips a Date as an ISO string', () => {
    const now = new Date('2026-05-12T10:00:00Z');
    setLastVisitedAt(now);
    const got = getLastVisitedAt();
    expect(got).not.toBeNull();
    expect(got!.toISOString()).toBe(now.toISOString());
  });

  it('returns null for a corrupted value', () => {
    (globalThis as unknown as { window: TestWindow }).window.localStorage.setItem(
      'gps.network.lastVisitedAt',
      'not-a-date',
    );
    expect(getLastVisitedAt()).toBeNull();
  });
});

describe('dismissedIds', () => {
  it('returns an empty set when nothing has been written', () => {
    expect(getDismissedIds().size).toBe(0);
  });

  it('toggles a single id on then off', () => {
    expect(toggleDismissed('123')).toBe(true);
    expect(isDismissed('123')).toBe(true);
    expect(toggleDismissed('123')).toBe(false);
    expect(isDismissed('123')).toBe(false);
  });

  it('keeps multiple toggled ids independently', () => {
    toggleDismissed('1');
    toggleDismissed('2');
    toggleDismissed('3');
    const ids = getDismissedIds();
    expect(ids.size).toBe(3);
    expect(ids.has('1')).toBe(true);
    expect(ids.has('2')).toBe(true);
    expect(ids.has('3')).toBe(true);
  });

  it('returns an empty set when the stored value is malformed JSON', () => {
    (globalThis as unknown as { window: TestWindow }).window.localStorage.setItem(
      'gps.network.dismissed',
      '{not json',
    );
    expect(getDismissedIds().size).toBe(0);
  });

  it('returns an empty set when the stored value is not an array', () => {
    (globalThis as unknown as { window: TestWindow }).window.localStorage.setItem(
      'gps.network.dismissed',
      '{"123":true}',
    );
    expect(getDismissedIds().size).toBe(0);
  });

  it('ignores non-string entries in a stored array', () => {
    (globalThis as unknown as { window: TestWindow }).window.localStorage.setItem(
      'gps.network.dismissed',
      '["valid", 42, null, "also-valid"]',
    );
    const ids = getDismissedIds();
    expect(ids.size).toBe(2);
    expect(ids.has('valid')).toBe(true);
    expect(ids.has('also-valid')).toBe(true);
  });

  it('prunes to the tail when over the threshold', () => {
    const big = Array.from({ length: 1500 }, (_, i) => String(i));
    (globalThis as unknown as { window: TestWindow }).window.localStorage.setItem(
      'gps.network.dismissed',
      JSON.stringify(big),
    );
    const ids = getDismissedIds();
    // Pruned to floor(1000/2) = 500
    expect(ids.size).toBe(500);
    // Keeps the tail
    expect(ids.has('1499')).toBe(true);
    expect(ids.has('1000')).toBe(true);
    // Drops the head
    expect(ids.has('0')).toBe(false);
    expect(ids.has('500')).toBe(false);
  });
});

describe('SSR safety (no window present)', () => {
  it('returns sensible defaults when window is undefined', () => {
    removeLocalStorageStub();
    expect(getLastVisitedAt()).toBeNull();
    expect(getDismissedIds().size).toBe(0);
    expect(isDismissed('1')).toBe(false);
    expect(toggleDismissed('1')).toBe(false);
    expect(() => setLastVisitedAt(new Date())).not.toThrow();
    expect(() => __resetForTests()).not.toThrow();
  });
});
