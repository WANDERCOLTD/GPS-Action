/**
 * Unit tests for the pure keyboard-shortcut resolver.
 *
 * @build-unit BU-keyboard-shortcuts
 *
 * The DOM listener (`KeyboardShortcuts` component) is a thin wrapper
 * around `resolveKey`. Test the resolver directly — env is `node`,
 * no jsdom, no fake DOM. Inertness checks (typing target / modifier
 * keys) live in the component and are out of scope here.
 */

import { describe, it, expect } from 'vitest';
import { resolveKey, SEQUENCE_TIMEOUT_MS, SHORTCUT_BINDINGS } from '@/shared/shortcuts';

const NOW = 1_000_000;

describe('resolveKey — single-key bindings', () => {
  it('navigates to /search on bare /', () => {
    const out = resolveKey({ key: '/', sequence: null, now: NOW });
    expect(out).toEqual({ kind: 'navigate', href: '/search' });
  });

  it('navigates to /compose on bare c', () => {
    const out = resolveKey({ key: 'c', sequence: null, now: NOW });
    expect(out).toEqual({ kind: 'navigate', href: '/compose' });
  });

  it('opens the help overlay on bare ?', () => {
    const out = resolveKey({ key: '?', sequence: null, now: NOW });
    expect(out).toEqual({ kind: 'help' });
  });

  it('returns noop for keys with no binding', () => {
    const out = resolveKey({ key: 'z', sequence: null, now: NOW });
    expect(out).toEqual({ kind: 'noop' });
  });
});

describe('resolveKey — sequence bindings', () => {
  it('arms a sequence when a known prefix is typed alone', () => {
    const out = resolveKey({ key: 'g', sequence: null, now: NOW });
    expect(out).toEqual({
      kind: 'arm-sequence',
      prefix: 'g',
      expiresAt: NOW + SEQUENCE_TIMEOUT_MS,
    });
  });

  it('navigates on g then n → /network', () => {
    const armed = { prefix: 'g', expiresAt: NOW + 500 };
    const out = resolveKey({ key: 'n', sequence: armed, now: NOW });
    expect(out).toEqual({ kind: 'navigate', href: '/network' });
  });

  it('navigates on g then f → /feed', () => {
    const armed = { prefix: 'g', expiresAt: NOW + 500 };
    const out = resolveKey({ key: 'f', sequence: armed, now: NOW });
    expect(out).toEqual({ kind: 'navigate', href: '/feed' });
  });

  it('handles uppercase second key (g then N → /network)', () => {
    const armed = { prefix: 'g', expiresAt: NOW + 500 };
    const out = resolveKey({ key: 'N', sequence: armed, now: NOW });
    expect(out).toEqual({ kind: 'navigate', href: '/network' });
  });

  it('returns noop when the second key has no binding under the prefix', () => {
    const armed = { prefix: 'g', expiresAt: NOW + 500 };
    const out = resolveKey({ key: 'z', sequence: armed, now: NOW });
    expect(out).toEqual({ kind: 'noop' });
  });

  it('treats an expired sequence as no sequence', () => {
    const expired = { prefix: 'g', expiresAt: NOW - 1 };
    // Bare `c` should fire as the single binding (compose), NOT as
    // the expired-sequence `g c` → /calendar.
    const out = resolveKey({ key: 'c', sequence: expired, now: NOW });
    expect(out).toEqual({ kind: 'navigate', href: '/compose' });
  });

  it('suppresses single-key bindings while a sequence is live', () => {
    // User typed `g`, then `c` within the window → resolves as
    // `g c` → /calendar, not the single `c` for /compose.
    const armed = { prefix: 'g', expiresAt: NOW + 500 };
    const out = resolveKey({ key: 'c', sequence: armed, now: NOW });
    expect(out).toEqual({ kind: 'navigate', href: '/calendar' });
  });
});

describe('resolveKey — registry coverage', () => {
  it('every registered sequence binding resolves to its href', () => {
    for (const b of SHORTCUT_BINDINGS) {
      if (b.kind !== 'sequence') continue;
      const armed = { prefix: b.prefix, expiresAt: NOW + 500 };
      const out = resolveKey({ key: b.key, sequence: armed, now: NOW });
      expect(out).toEqual({ kind: 'navigate', href: b.href });
    }
  });

  it('every registered single binding resolves to its action', () => {
    for (const b of SHORTCUT_BINDINGS) {
      if (b.kind !== 'single') continue;
      const out = resolveKey({ key: b.key, sequence: null, now: NOW });
      if (b.action === 'help') {
        expect(out).toEqual({ kind: 'help' });
      } else {
        expect(out).toEqual({ kind: 'navigate', href: b.action });
      }
    }
  });
});
