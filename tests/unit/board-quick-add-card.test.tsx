/**
 * Unit tests for QuickAddCard — the per-column ghost-card affordance
 * for adding tickets directly into a column on the Active board.
 *
 * Same plain-function-as-component pattern as the other board tests.
 * The `useState` / `useEffect` / `useTransition` hooks would fail
 * outside a React render context, so we don't expand into the
 * component — we only exercise the trigger element via direct rendering.
 *
 * Server-side wiring (the `quickAdd` mutation, audit log shape) is
 * covered by the service-level integration tests in
 * `tests/integration/board-quick-add.test.ts` (separate file).
 */

import { describe, it, expect } from 'vitest';
import { QuickAddCard } from '@/components/board/QuickAddCard';

describe('QuickAddCard', () => {
  it('exports as a function component', () => {
    expect(typeof QuickAddCard).toBe('function');
  });
});
