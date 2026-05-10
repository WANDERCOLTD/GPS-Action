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
  // Post-BU-board-palette: the palette delegates to the centralised
  // card-tint tokens so the column, the modal, the tag-pill and the
  // future /network feed all share one source. The CSS still resolves
  // to amber → lavender → sky → mint at runtime.
  it('returns the position-keyed accent vars (1 → 2 → 3 → 4)', () => {
    expect(paletteForIndex(0).tint).toBe('var(--colour-card-accent-1)');
    expect(paletteForIndex(1).tint).toBe('var(--colour-card-accent-2)');
    expect(paletteForIndex(2).tint).toBe('var(--colour-card-accent-3)');
    expect(paletteForIndex(3).tint).toBe('var(--colour-card-accent-4)');
  });

  it('falls back to the neutral default beyond index 3', () => {
    expect(paletteForIndex(4).tint).toBe('var(--colour-card-accent-default)');
    expect(paletteForIndex(99).tint).toBe('var(--colour-card-accent-default)');
  });

  it('uses the matching tint var for bg', () => {
    expect(paletteForIndex(0).bg).toBe('var(--colour-card-tint-1)');
    expect(paletteForIndex(1).bg).toBe('var(--colour-card-tint-2)');
  });
});
