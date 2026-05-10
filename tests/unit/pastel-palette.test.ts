/**
 * Unit tests for the centralised pastel palette helper
 * (`shared/styles/pastel-palette`).
 *
 * The palette is the single source of truth for board column tints,
 * the move-to-active modal, and the future /network feed cards
 * (BU-network-feed). Index-based lookup; out-of-range falls back to
 * a neutral default.
 */

import { describe, it, expect } from 'vitest';
import {
  PASTEL_TINT_VARS,
  PASTEL_ACCENT_VARS,
  pastelTintByIndex,
  pastelAccentByIndex,
  pastelPaletteByIndex,
} from '@/shared/styles/pastel-palette';

describe('PASTEL_TINT_VARS / PASTEL_ACCENT_VARS', () => {
  it('expose four positional tints + accents in lock-step', () => {
    expect(PASTEL_TINT_VARS).toHaveLength(4);
    expect(PASTEL_ACCENT_VARS).toHaveLength(4);
  });

  it('reference the canonical card-tint / card-accent tokens', () => {
    expect(PASTEL_TINT_VARS[0]).toBe('var(--colour-card-tint-1)');
    expect(PASTEL_TINT_VARS[3]).toBe('var(--colour-card-tint-4)');
    expect(PASTEL_ACCENT_VARS[0]).toBe('var(--colour-card-accent-1)');
    expect(PASTEL_ACCENT_VARS[3]).toBe('var(--colour-card-accent-4)');
  });
});

describe('pastelTintByIndex', () => {
  it('returns the tint var for indices 0..3', () => {
    expect(pastelTintByIndex(0)).toBe('var(--colour-card-tint-1)');
    expect(pastelTintByIndex(1)).toBe('var(--colour-card-tint-2)');
    expect(pastelTintByIndex(2)).toBe('var(--colour-card-tint-3)');
    expect(pastelTintByIndex(3)).toBe('var(--colour-card-tint-4)');
  });

  it('falls back to the default tint at index 4 and beyond', () => {
    expect(pastelTintByIndex(4)).toBe('var(--colour-card-tint-default)');
    expect(pastelTintByIndex(99)).toBe('var(--colour-card-tint-default)');
  });

  it('falls back to the default tint for negative indices', () => {
    expect(pastelTintByIndex(-1)).toBe('var(--colour-card-tint-default)');
    expect(pastelTintByIndex(-99)).toBe('var(--colour-card-tint-default)');
  });
});

describe('pastelAccentByIndex', () => {
  it('returns the accent var for indices 0..3', () => {
    expect(pastelAccentByIndex(0)).toBe('var(--colour-card-accent-1)');
    expect(pastelAccentByIndex(1)).toBe('var(--colour-card-accent-2)');
    expect(pastelAccentByIndex(2)).toBe('var(--colour-card-accent-3)');
    expect(pastelAccentByIndex(3)).toBe('var(--colour-card-accent-4)');
  });

  it('falls back to the default accent at index 4 and beyond', () => {
    expect(pastelAccentByIndex(4)).toBe('var(--colour-card-accent-default)');
    expect(pastelAccentByIndex(99)).toBe('var(--colour-card-accent-default)');
  });

  it('falls back to the default accent for negative indices', () => {
    expect(pastelAccentByIndex(-1)).toBe('var(--colour-card-accent-default)');
  });
});

describe('pastelPaletteByIndex', () => {
  it('bundles tint + accent for the given index', () => {
    expect(pastelPaletteByIndex(0)).toEqual({
      tint: 'var(--colour-card-accent-1)',
      bg: 'var(--colour-card-tint-1)',
    });
    expect(pastelPaletteByIndex(3)).toEqual({
      tint: 'var(--colour-card-accent-4)',
      bg: 'var(--colour-card-tint-4)',
    });
  });

  it('returns the default pair for out-of-range indices', () => {
    expect(pastelPaletteByIndex(4)).toEqual({
      tint: 'var(--colour-card-accent-default)',
      bg: 'var(--colour-card-tint-default)',
    });
    expect(pastelPaletteByIndex(-1)).toEqual({
      tint: 'var(--colour-card-accent-default)',
      bg: 'var(--colour-card-tint-default)',
    });
  });
});
