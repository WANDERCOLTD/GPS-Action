/**
 * Centralised positional pastel palette — single source of truth.
 *
 * Used by:
 *   - Board columns (`components/board/Column.tsx`)
 *   - Move-to-active modal (`components/board/MoveCardSheet.tsx`)
 *   - Mobile tag-switcher pill (`components/board/MobileTagSwitcher.tsx`)
 *   - Card-lifecycle move sheet (`components/board/CardLifecycleActions.tsx`)
 *   - /network feed cards — future consumer (BU-network-feed)
 *
 * The palette is **position-keyed**, not stage-keyed: a column's tint is
 * determined by its index in the column ordering, not by its name. So a
 * group admin renaming "Recruitment" to "Phase 1" doesn't change its
 * colour — the runtime ordering does.
 *
 * To add a 5th tint, extend `styles/tokens.css` (`--colour-card-tint-5`,
 * `--colour-card-accent-5`) and the arrays below in lock-step. Consumers
 * cycle by `index % palette.length`; index >= length falls back to the
 * neutral default.
 */

/** Soft pastel underlay tints — for column / card backgrounds. */
export const PASTEL_TINT_VARS = [
  'var(--colour-card-tint-1)',
  'var(--colour-card-tint-2)',
  'var(--colour-card-tint-3)',
  'var(--colour-card-tint-4)',
] as const;

/** Full-strength accent tints — for chips, headers, icon accents. */
export const PASTEL_ACCENT_VARS = [
  'var(--colour-card-accent-1)',
  'var(--colour-card-accent-2)',
  'var(--colour-card-accent-3)',
  'var(--colour-card-accent-4)',
] as const;

const TINT_DEFAULT = 'var(--colour-card-tint-default)';
const ACCENT_DEFAULT = 'var(--colour-card-accent-default)';

/**
 * Returns the pastel tint CSS variable for the given position index.
 * Out-of-range indices (negative or >= palette length) return the
 * neutral default tint.
 */
export function pastelTintByIndex(index: number): string {
  if (index < 0 || index >= PASTEL_TINT_VARS.length) {
    return TINT_DEFAULT;
  }
  return PASTEL_TINT_VARS[index]!;
}

/**
 * Returns the pastel accent CSS variable for the given position index.
 * Out-of-range indices (negative or >= palette length) return the
 * neutral default accent.
 */
export function pastelAccentByIndex(index: number): string {
  if (index < 0 || index >= PASTEL_ACCENT_VARS.length) {
    return ACCENT_DEFAULT;
  }
  return PASTEL_ACCENT_VARS[index]!;
}

/**
 * Bundles tint + accent for the given position index. Convenience for
 * callers (modal rows, mobile tag-pill) that need both at once. Names
 * mirror `MoveDestinationOption` for drop-in compatibility:
 *   - `bg`  — pastel underlay (use for surface fills)
 *   - `tint` — accent (use for borders, text, icons)
 */
export function pastelPaletteByIndex(index: number): { tint: string; bg: string } {
  return {
    tint: pastelAccentByIndex(index),
    bg: pastelTintByIndex(index),
  };
}
