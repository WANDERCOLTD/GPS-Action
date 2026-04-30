/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Tests run in vitest's `node` env where `indexedDB` is undefined,
 * so these exercise the in-memory fallback path. The IDB code path
 * is covered manually in the dev smoke-test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  autosaveCacheGet,
  autosaveCacheSet,
  autosaveCacheDelete,
  __resetAutosaveCacheForTests,
} from '@/shared/autosave/indexeddb-cache';

beforeEach(() => {
  __resetAutosaveCacheForTests();
});

describe('autosave cache (in-memory fallback)', () => {
  it('returns null for an unknown key', async () => {
    expect(await autosaveCacheGet('nope')).toBeNull();
  });

  it('round-trips a value via set/get', async () => {
    await autosaveCacheSet('compose-draft-current', { title: 'hi', body: 'there' });
    expect(await autosaveCacheGet('compose-draft-current')).toEqual({
      title: 'hi',
      body: 'there',
    });
  });

  it('overwrites the previous value on a second set', async () => {
    await autosaveCacheSet('k', { v: 1 });
    await autosaveCacheSet('k', { v: 2 });
    expect(await autosaveCacheGet('k')).toEqual({ v: 2 });
  });

  it('deletes a value', async () => {
    await autosaveCacheSet('k', { v: 1 });
    await autosaveCacheDelete('k');
    expect(await autosaveCacheGet('k')).toBeNull();
  });

  it('keeps unrelated keys intact when one is deleted', async () => {
    await autosaveCacheSet('a', { v: 'A' });
    await autosaveCacheSet('b', { v: 'B' });
    await autosaveCacheDelete('a');
    expect(await autosaveCacheGet('a')).toBeNull();
    expect(await autosaveCacheGet('b')).toEqual({ v: 'B' });
  });

  it('serialises arbitrary JSON shapes', async () => {
    const value = {
      title: 'Sky News op-ed',
      body: 'Two paragraphs.',
      signal: 'promote' as const,
      currentIntent: 'tick_or_cross',
      selectedKind: 'tick_or_cross',
    };
    await autosaveCacheSet('compose', value);
    expect(await autosaveCacheGet('compose')).toEqual(value);
  });
});
