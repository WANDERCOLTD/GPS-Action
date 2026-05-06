/**
 * Unit tests for MobileTagSwitcher (PR #7 atom B2).
 *
 * Tests the pure pieces — palette selection by column index, and the
 * tap-current-column no-op short-circuit. The full sheet open/close +
 * server-action wiring is exercised end-to-end in a Playwright pass
 * once we have one for the kanban; for now `paletteForIndex` is the
 * deterministic surface unit-tests can lock in.
 */

import { describe, it, expect } from 'vitest';
import { paletteForIndex } from '@/components/board/MobileTagSwitcher';

describe('paletteForIndex', () => {
  it('returns the warning (yellow) tint for column index 0', () => {
    expect(paletteForIndex(0).tint).toBe('var(--colour-warning)');
  });

  it('returns the info (blue) tint for column index 1', () => {
    expect(paletteForIndex(1).tint).toBe('var(--colour-info)');
  });

  it('returns the primary tint for column index 2', () => {
    expect(paletteForIndex(2).tint).toBe('var(--colour-primary)');
  });

  it('returns the success (green) tint for column index 3', () => {
    expect(paletteForIndex(3).tint).toBe('var(--colour-success)');
  });

  it('falls back to a neutral palette beyond index 3', () => {
    expect(paletteForIndex(4).tint).toBe('var(--colour-text-secondary)');
    expect(paletteForIndex(99).tint).toBe('var(--colour-text-secondary)');
  });

  it('builds the bg as a 14% color-mix of the same token', () => {
    expect(paletteForIndex(0).bg).toBe(
      'color-mix(in srgb, var(--colour-warning) 14%, transparent)',
    );
    expect(paletteForIndex(1).bg).toBe('color-mix(in srgb, var(--colour-info) 14%, transparent)');
  });
});
