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
  it('returns the position-based palette (yellow → blue → brand → green)', () => {
    expect(paletteForActiveIndex(0).tint).toBe('var(--colour-warning)');
    expect(paletteForActiveIndex(1).tint).toBe('var(--colour-info)');
    expect(paletteForActiveIndex(2).tint).toBe('var(--colour-primary)');
    expect(paletteForActiveIndex(3).tint).toBe('var(--colour-success)');
  });

  it('falls back to neutral beyond index 3', () => {
    expect(paletteForActiveIndex(4).tint).toBe('var(--colour-text-secondary)');
    expect(paletteForActiveIndex(99).tint).toBe('var(--colour-text-secondary)');
  });

  it('builds bg as a 14% color-mix of the same token', () => {
    expect(paletteForActiveIndex(0).bg).toBe(
      'color-mix(in srgb, var(--colour-warning) 14%, transparent)',
    );
    expect(paletteForActiveIndex(3).bg).toBe(
      'color-mix(in srgb, var(--colour-success) 14%, transparent)',
    );
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
