/**
 * Unit tests for the shared visibility filter helper.
 *
 * @build-unit BU-search-surface (precursor refactor)
 * @spec D078 §5
 *
 * Behaviour-locking tests so that listPosts / listUpcoming / listNearby /
 * search.query (future) stay aligned. If the visibility model evolves
 * (e.g. partner-org-only posts under §3.30, private threads), this is
 * the single point of change.
 */

import { describe, it, expect } from 'vitest';

import { getPostVisibilityFilter } from '@/server/services/visibility';

describe('getPostVisibilityFilter', () => {
  it('returns only public for unauthenticated callers', () => {
    expect(getPostVisibilityFilter(undefined)).toEqual(['public']);
  });

  it('returns public + authenticated_only for authenticated callers', () => {
    expect(getPostVisibilityFilter('user-123')).toEqual(['public', 'authenticated_only']);
  });

  it('treats any non-empty string as authenticated', () => {
    expect(getPostVisibilityFilter('a')).toEqual(['public', 'authenticated_only']);
  });

  it('treats empty string as unauthenticated (falsy)', () => {
    // Defensive: callers should pass undefined, not '', but the empty
    // string is falsy so the helper degrades safely to the public-only
    // set rather than leaking authenticated_only posts.
    expect(getPostVisibilityFilter('')).toEqual(['public']);
  });
});
