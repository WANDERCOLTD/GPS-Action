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

  it('allows kanbanEventConfig.enabled', () => {
    expect(isInlineToggleAllowed('kanbanEventConfig', 'enabled')).toBe(true);
  });

  it('rejects an unknown field on a known entity', () => {
    expect(isInlineToggleAllowed('featureFlag', 'rolloutPercentage')).toBe(false);
    expect(isInlineToggleAllowed('featureFlag', 'deletedAt')).toBe(false);
    expect(isInlineToggleAllowed('kanbanEventConfig', 'eventKind')).toBe(false);
  });

  it('rejects every field on an unknown entity', () => {
    expect(isInlineToggleAllowed('user', 'enabledGlobally')).toBe(false);
    expect(isInlineToggleAllowed('post', 'visibility')).toBe(false);
  });

  it('keeps the allowlist tightly scoped to known reference-data toggles', () => {
    expect(INLINE_TOGGLE_ALLOWLIST).toEqual({
      featureFlag: ['enabledGlobally'],
      kanbanEventConfig: ['enabled'],
    });
  });
});
