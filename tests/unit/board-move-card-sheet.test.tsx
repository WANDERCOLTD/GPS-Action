/**
 * Unit tests for the generalized MoveCardSheet helpers.
 *
 * The sheet itself is a client component (useState, useTransition);
 * the hooks would fail in `expand()`-style traversal, so we test the
 * deterministic surface — palette helpers + destination-shape contract.
 *
 * End-to-end behaviour (open, pick, server action call) is covered by
 * Playwright when we have it; until then, the existing MobileTagSwitcher
 * tests + `paletteForActiveIndex` cover the active-column path,
 * and the helper exports here cover the off-board palettes.
 */

import { describe, it, expect } from 'vitest';
import {
  paletteForActiveIndex,
  BACKLOG_PALETTE,
  DONE_PALETTE,
  ABANDONED_PALETTE,
  MoveCardSheet,
} from '@/components/board/MoveCardSheet';

describe('paletteForActiveIndex', () => {
  // Post-BU-board-palette: the palette delegates to the centralised
  // card-tint tokens in `shared/styles/pastel-palette`. The CSS still
  // resolves to amber → lavender → sky → mint at runtime — the
  // indirection just moves into the token layer so /network can reuse
  // the same source.
  it('returns the position-keyed accent vars (1 → 2 → 3 → 4)', () => {
    expect(paletteForActiveIndex(0).tint).toBe('var(--colour-card-accent-1)');
    expect(paletteForActiveIndex(1).tint).toBe('var(--colour-card-accent-2)');
    expect(paletteForActiveIndex(2).tint).toBe('var(--colour-card-accent-3)');
    expect(paletteForActiveIndex(3).tint).toBe('var(--colour-card-accent-4)');
  });

  it('falls back to the neutral default beyond index 3', () => {
    expect(paletteForActiveIndex(4).tint).toBe('var(--colour-card-accent-default)');
    expect(paletteForActiveIndex(99).tint).toBe('var(--colour-card-accent-default)');
  });

  it('uses the matching tint var for bg', () => {
    expect(paletteForActiveIndex(0).bg).toBe('var(--colour-card-tint-1)');
    expect(paletteForActiveIndex(3).bg).toBe('var(--colour-card-tint-4)');
    expect(paletteForActiveIndex(4).bg).toBe('var(--colour-card-tint-default)');
  });
});

describe('off-board palettes', () => {
  it('exposes a backlog palette (neutral)', () => {
    expect(BACKLOG_PALETTE.tint).toBe('var(--colour-text-secondary)');
  });

  it('exposes a done palette tinted with success', () => {
    expect(DONE_PALETTE.tint).toBe('var(--colour-success)');
    expect(DONE_PALETTE.bg).toBe('color-mix(in srgb, var(--colour-success) 14%, transparent)');
  });

  it('exposes an abandoned palette (neutral / muted)', () => {
    expect(ABANDONED_PALETTE.tint).toBe('var(--colour-text-tertiary)');
  });
});

describe('MoveCardSheet export', () => {
  it('is a function component', () => {
    expect(typeof MoveCardSheet).toBe('function');
  });
});
