/**
 * @build-unit BU-admin-bulk-ops
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-bulk-ops.md
 *
 * Unit tests for the small helper exports of BulkSelector. The
 * stateful provider behaviour (selection toggle, URL hash sync,
 * action dispatch) is exercised end-to-end by the integration
 * tests in `admin-bulk.test.ts`; what's left here is the static
 * surface area that can be tested without a DOM (vitest env is
 * `node` per the existing pattern in `link-preview-card.test.tsx`).
 *
 * Hook-driven assertions (toggle, selectMany, run) would need a
 * React Testing Library setup that doesn't ship today; those land
 * with manual click-through during DoD.
 */

import { describe, it, expect } from 'vitest';
import { labelFor, type BulkVerb } from '@/components/admin/BulkSelector';

describe('labelFor — verb display strings', () => {
  it('returns "Soft-delete" for softDelete', () => {
    expect(labelFor('softDelete')).toBe('Soft-delete');
  });

  it('returns "Restore" for restore', () => {
    expect(labelFor('restore')).toBe('Restore');
  });

  it('returns "Hard-delete" for hardDelete', () => {
    expect(labelFor('hardDelete')).toBe('Hard-delete');
  });

  it('returns "Force-release" for forceRelease', () => {
    expect(labelFor('forceRelease')).toBe('Force-release');
  });

  it('handles every verb in the union (exhaustiveness check)', () => {
    const verbs: ReadonlyArray<BulkVerb> = ['softDelete', 'restore', 'hardDelete', 'forceRelease'];
    for (const v of verbs) {
      expect(labelFor(v)).toMatch(/^[A-Z][a-z-]+$/);
    }
  });
});
