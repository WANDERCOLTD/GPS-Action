/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Unit tests for the inline-toggle allowlist helper. The allowlist
 * is the only thing standing between admin role + the
 * `caller.admin.update` path; ensure unknown entities and unknown
 * fields are both rejected.
 */

import { describe, it, expect } from 'vitest';
import { isInlineToggleAllowed, INLINE_TOGGLE_ALLOWLIST } from '@/shared/validation/admin';

describe('isInlineToggleAllowed', () => {
  it('allows featureFlag.enabledGlobally', () => {
    expect(isInlineToggleAllowed('featureFlag', 'enabledGlobally')).toBe(true);
  });

  it('rejects an unknown field on a known entity', () => {
    expect(isInlineToggleAllowed('featureFlag', 'rolloutPercentage')).toBe(false);
    expect(isInlineToggleAllowed('featureFlag', 'deletedAt')).toBe(false);
  });

  it('rejects every field on an unknown entity', () => {
    expect(isInlineToggleAllowed('user', 'enabledGlobally')).toBe(false);
    expect(isInlineToggleAllowed('post', 'visibility')).toBe(false);
  });

  it('keeps the allowlist tightly scoped — exactly one entity, one field today', () => {
    const entries = Object.entries(INLINE_TOGGLE_ALLOWLIST);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(['featureFlag', ['enabledGlobally']]);
  });
});
