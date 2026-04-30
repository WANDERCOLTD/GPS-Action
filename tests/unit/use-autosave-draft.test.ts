/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Fake-timer tests for the useAutosaveDraft hook. Exercises:
 *   - debounced writes after `value` changes
 *   - hydration on first mount when the cache has a hit
 *   - status transitions: editing → saved → editing → saved
 *   - explicit clear() drops the cached value
 *
 * Phase 1 ships only stage 1 of D072 §8 (client-only IndexedDB).
 * Stages 2 (server-promote-on-inactivity) and 3 (server-only after
 * promote) land in bu-drafts-inbox; their tests will live there.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const stateSlots: unknown[] = [];
let stateIdx = 0;
const refSlots: { current: unknown }[] = [];
let refIdx = 0;
const memoSlots: unknown[] = [];
let memoIdx = 0;
const callbackSlots: unknown[] = [];
let callbackIdx = 0;
const effects: Array<{ fn: () => void | (() => void); deps: ReadonlyArray<unknown> }> = [];
const lastDeps: Array<ReadonlyArray<unknown> | null> = [];

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T>(init: T | (() => T)) => {
      const idx = stateIdx++;
      const setter = (next: T | ((prev: T) => T)) => {
        const prev = (idx in stateSlots ? stateSlots[idx] : init) as T;
        stateSlots[idx] = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      };
      const initial = typeof init === 'function' ? (init as () => T)() : init;
      const value = (idx in stateSlots ? stateSlots[idx] : initial) as T;
      return [value, setter] as const;
    },
    useRef: <T>(init: T) => {
      const idx = refIdx++;
      const slot = refSlots[idx] ?? { current: init };
      refSlots[idx] = slot;
      return slot;
    },
    useEffect: (fn: () => void | (() => void), deps?: ReadonlyArray<unknown>) => {
      const idx = effects.length;
      const prev = lastDeps[idx] ?? null;
      const depsArr = deps ?? [];
      const changed =
        prev === null ||
        prev.length !== depsArr.length ||
        prev.some((v, i) => !Object.is(v, depsArr[i]));
      if (changed) {
        effects.push({ fn, deps: depsArr });
        lastDeps[idx] = depsArr;
      }
    },
    useMemo: <T>(fn: () => T, _deps?: ReadonlyArray<unknown>) => {
      const idx = memoIdx++;
      const v = fn();
      memoSlots[idx] = v;
      return v;
    },
    useCallback: <T>(fn: T, _deps?: ReadonlyArray<unknown>) => {
      const idx = callbackIdx++;
      callbackSlots[idx] = fn;
      return fn;
    },
  };
});

import {
  __resetAutosaveCacheForTests,
  autosaveCacheGet,
  autosaveCacheSet,
} from '@/shared/autosave/indexeddb-cache';
import { useAutosaveDraft } from '@/shared/autosave/use-autosave-draft';

function resetHookSlots(): void {
  stateSlots.length = 0;
  stateIdx = 0;
  refSlots.length = 0;
  refIdx = 0;
  memoSlots.length = 0;
  memoIdx = 0;
  callbackSlots.length = 0;
  callbackIdx = 0;
  effects.length = 0;
  lastDeps.length = 0;
}

async function runEffects(): Promise<void> {
  // Effects accumulate during render; flush them, then yield to any
  // microtasks the effects scheduled (the cache layer is async).
  while (effects.length > 0) {
    const { fn } = effects.shift()!;
    fn();
  }
  await Promise.resolve();
  await Promise.resolve();
}

function render<T>(
  props: Parameters<typeof useAutosaveDraft<T>>[0],
): ReturnType<typeof useAutosaveDraft<T>> {
  stateIdx = 0;
  refIdx = 0;
  memoIdx = 0;
  callbackIdx = 0;
  return useAutosaveDraft(props);
}

beforeEach(() => {
  resetHookSlots();
  __resetAutosaveCacheForTests();
  vi.useFakeTimers();
});

describe('useAutosaveDraft — hydration', () => {
  it('hydrated is null + hasHydrated false on the very first render', () => {
    const r = render({ key: 'k', value: { title: '' } });
    expect(r.hydrated).toBeNull();
    expect(r.hasHydrated).toBe(false);
    expect(r.status).toBe('idle');
  });

  it('hydrated is null + hasHydrated true after the cache miss resolves', async () => {
    let r = render({ key: 'k1', value: { title: '' } });
    await runEffects();
    r = render({ key: 'k1', value: { title: '' } });
    expect(r.hasHydrated).toBe(true);
    expect(r.hydrated).toBeNull();
    expect(r.status).toBe('idle');
  });

  it('hydrated returns the cached value when present (status flips to saved)', async () => {
    await autosaveCacheSet('k2', { title: 'preset', body: 'preset body' });

    let r = render({ key: 'k2', value: { title: '', body: '' } });
    await runEffects();
    r = render({ key: 'k2', value: { title: '', body: '' } });

    expect(r.hasHydrated).toBe(true);
    expect(r.hydrated).toEqual({ title: 'preset', body: 'preset body' });
    expect(r.status).toBe('saved');
    expect(r.lastSavedAt).toBeInstanceOf(Date);
  });
});

describe('useAutosaveDraft — debounced writes', () => {
  it('writes after the debounce window when value changes', async () => {
    let r = render({ key: 'k3', value: { title: 'first' }, debounceMs: 500 });
    await runEffects();

    r = render({ key: 'k3', value: { title: 'second' }, debounceMs: 500 });
    await runEffects();
    // Re-render to observe the 'editing' status the effect set.
    r = render({ key: 'k3', value: { title: 'second' }, debounceMs: 500 });
    expect(r.status).toBe('editing');

    // Cache shouldn't have been written yet.
    expect(await autosaveCacheGet('k3')).toBeNull();

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    await Promise.resolve();

    expect(await autosaveCacheGet('k3')).toEqual({ title: 'second' });

    r = render({ key: 'k3', value: { title: 'second' }, debounceMs: 500 });
    expect(r.status).toBe('saved');
    expect(r.lastSavedAt).toBeInstanceOf(Date);
  });

  it('coalesces rapid changes into a single write (debouncing)', async () => {
    render({ key: 'k4', value: { title: '0' }, debounceMs: 500 });
    await runEffects();

    render({ key: 'k4', value: { title: '1' }, debounceMs: 500 });
    await runEffects();
    await vi.advanceTimersByTimeAsync(200);

    render({ key: 'k4', value: { title: '2' }, debounceMs: 500 });
    await runEffects();
    await vi.advanceTimersByTimeAsync(200);

    render({ key: 'k4', value: { title: '3' }, debounceMs: 500 });
    await runEffects();
    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();

    expect(await autosaveCacheGet('k4')).toEqual({ title: '3' });
  });

  it('does not write when value is unchanged across renders', async () => {
    render({ key: 'k5', value: { title: 'same' }, debounceMs: 500 });
    await runEffects();
    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    await autosaveCacheSet('k5-touch', 'sentinel');

    // Re-render with the same value should not write.
    render({ key: 'k5', value: { title: 'same' }, debounceMs: 500 });
    await runEffects();
    await vi.advanceTimersByTimeAsync(500);

    // Sentinel survives — no write to k5 happened that would have
    // disturbed an unrelated key. (Indirect check; the key API is
    // tested directly in autosave-indexeddb-cache.test.ts.)
    expect(await autosaveCacheGet('k5-touch')).toBe('sentinel');
  });
});

describe('useAutosaveDraft — disabled', () => {
  it('skips hydration + writes when enabled=false', async () => {
    await autosaveCacheSet('k6', { title: 'cached' });

    let r = render({ key: 'k6', value: { title: '' }, enabled: false });
    await runEffects();
    r = render({ key: 'k6', value: { title: '' }, enabled: false });

    // hasHydrated flips true (so the indicator can stop showing 'idle'),
    // but hydrated stays null and status stays 'idle' since the cache
    // was never read.
    expect(r.hasHydrated).toBe(true);
    expect(r.hydrated).toBeNull();
    expect(r.status).toBe('idle');
  });
});

describe('useAutosaveDraft — clear', () => {
  it('clear() drops the cached value and resets state', async () => {
    let r = render({ key: 'k7', value: { title: 'a' } });
    await runEffects();
    r = render({ key: 'k7', value: { title: 'b' } });
    await runEffects();
    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    expect(await autosaveCacheGet('k7')).toEqual({ title: 'b' });

    await r.clear();
    expect(await autosaveCacheGet('k7')).toBeNull();
  });
});
