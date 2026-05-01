/**
 * Unit tests for the dev-banner toggle helpers + component.
 *
 * @build-unit BU-one-click-polish
 *
 * Vitest env is `node`, no RTL. Same plain-function-as-component
 * pattern used by intent-fab-sheet.test.tsx — we mock React's
 * stateful hooks so the component can be invoked directly and the
 * resulting JSX tree walked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';

type AnyElement = ReactElement<Record<string, unknown>>;

// ── localStorage stub ────────────────────────────────────────────────

class FakeStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return key in this.store ? (this.store[key] ?? null) : null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

interface FakeWindow {
  localStorage: FakeStorage;
  addEventListener: (type: string, handler: EventListener) => void;
  removeEventListener: (type: string, handler: EventListener) => void;
  dispatchEvent: (event: Event) => boolean;
  __listeners: Map<string, Set<EventListener>>;
}

function installFakeWindow(): FakeWindow {
  const listeners = new Map<string, Set<EventListener>>();
  const fake: FakeWindow = {
    localStorage: new FakeStorage(),
    addEventListener: (type, handler) => {
      const set = listeners.get(type) ?? new Set();
      set.add(handler);
      listeners.set(type, set);
    },
    removeEventListener: (type, handler) => {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent: (event) => {
      listeners.get(event.type)?.forEach((h) => h(event));
      return true;
    },
    __listeners: listeners,
  };
  // @ts-expect-error — assigning a partial Window for the helpers
  globalThis.window = fake;
  return fake;
}

// ── Helpers under test ───────────────────────────────────────────────

let fakeWindow: FakeWindow;

beforeEach(() => {
  fakeWindow = installFakeWindow();
  vi.resetModules();
});

afterEach(() => {
  // @ts-expect-error — undo
  delete globalThis.window;
});

describe('DevBannerToggle helpers', () => {
  it('readDevBannerVisible returns false when no entry exists', async () => {
    const mod = await import('@/components/DevBannerToggle');
    expect(mod.readDevBannerVisible()).toBe(false);
  });

  it('readDevBannerVisible returns true only for the literal "true"', async () => {
    const mod = await import('@/components/DevBannerToggle');
    fakeWindow.localStorage.setItem('gps:dev-banner-visible', 'true');
    expect(mod.readDevBannerVisible()).toBe(true);
    fakeWindow.localStorage.setItem('gps:dev-banner-visible', 'false');
    expect(mod.readDevBannerVisible()).toBe(false);
    fakeWindow.localStorage.setItem('gps:dev-banner-visible', 'YES');
    expect(mod.readDevBannerVisible()).toBe(false);
  });

  it('writeDevBannerVisible persists "true"/"false"', async () => {
    const mod = await import('@/components/DevBannerToggle');
    mod.writeDevBannerVisible(true);
    expect(fakeWindow.localStorage.getItem('gps:dev-banner-visible')).toBe('true');
    mod.writeDevBannerVisible(false);
    expect(fakeWindow.localStorage.getItem('gps:dev-banner-visible')).toBe('false');
  });

  it('subscribe → emit fires the handler', async () => {
    const mod = await import('@/components/DevBannerToggle');
    const spy = vi.fn();
    const unsub = mod.subscribeDevBannerVisibility(spy);
    mod.emitDevBannerVisibilityChange();
    mod.emitDevBannerVisibilityChange();
    expect(spy).toHaveBeenCalledTimes(2);
    unsub();
    mod.emitDevBannerVisibilityChange();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── Component render tests ───────────────────────────────────────────

describe('DevBannerToggle component', () => {
  it('renders an EyeOff (collapsed) state by default', async () => {
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react');
      const stubUseState = function stubUseState(init: unknown) {
        return [init, () => undefined] as const;
      };
      return {
        ...actual,
        useState: stubUseState,
        useEffect: () => undefined,
        useCallback: (fn: unknown) => fn,
      };
    });

    const { DevBannerToggle } = await import('@/components/DevBannerToggle');
    const tree = (DevBannerToggle as unknown as () => AnyElement | null)();
    expect(tree).not.toBeNull();
    expect(tree?.props['data-testid']).toBe('dev-banner-toggle');
    expect(tree?.props['data-visible']).toBe('false');
    expect(tree?.props['aria-label']).toContain('Show dev banner');
  });

  it('renders an Eye (visible) state when localStorage flag is on', async () => {
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react');
      // First useState = `visible`, second = `hydrated`. Force both true.
      const stubUseState = function stubUseState(_init: unknown) {
        return [true, () => undefined] as const;
      };
      return {
        ...actual,
        useState: stubUseState,
        useEffect: () => undefined,
        useCallback: (fn: unknown) => fn,
      };
    });

    const { DevBannerToggle } = await import('@/components/DevBannerToggle');
    const tree = (DevBannerToggle as unknown as () => AnyElement | null)();
    expect(tree).not.toBeNull();
    expect(tree?.props['data-visible']).toBe('true');
    expect(tree?.props['aria-label']).toContain('Hide dev banner');
  });
});
