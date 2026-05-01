/**
 * Unit tests for `suggestTitleFromBody`.
 *
 * @build-unit BU-one-click-polish
 */

import { describe, it, expect } from 'vitest';
import { suggestTitleFromBody } from '@/shared/suggest-title-from-body';

describe('suggestTitleFromBody', () => {
  it('returns empty string for whitespace-only input', () => {
    expect(suggestTitleFromBody('')).toBe('');
    expect(suggestTitleFromBody('   ')).toBe('');
    expect(suggestTitleFromBody('\n\n\t')).toBe('');
  });

  it('returns the first sentence up to a "."', () => {
    expect(suggestTitleFromBody('Council motion next Thursday. Write to your MP.')).toBe(
      'Council motion next Thursday',
    );
  });

  it('breaks on "!" and "?" too', () => {
    expect(suggestTitleFromBody('We did it! Sent 200 emails.')).toBe('We did it');
    expect(suggestTitleFromBody('Has anyone seen this? Worth a look.')).toBe(
      'Has anyone seen this',
    );
  });

  it('breaks on a newline', () => {
    expect(suggestTitleFromBody('Vigil this Saturday\nMeet at 18:00')).toBe('Vigil this Saturday');
  });

  it('returns the whole body when there is no terminator', () => {
    expect(suggestTitleFromBody('A short note with no terminator')).toBe(
      'A short note with no terminator',
    );
  });

  it('caps to 80 characters and breaks at whitespace', () => {
    const long =
      'This is a very long opening that runs on without any terminator and keeps describing the situation';
    const out = suggestTitleFromBody(long);
    expect(out.length).toBeLessThanOrEqual(80);
    // Should not end mid-word: last char must be a letter, not a half token.
    expect(out).toMatch(/\w$/);
    expect(long.startsWith(out)).toBe(true);
  });

  it('hard-caps when there is no whitespace inside the limit', () => {
    const long = 'A'.repeat(120);
    expect(suggestTitleFromBody(long).length).toBe(80);
  });

  it('trims leading and trailing whitespace', () => {
    expect(suggestTitleFromBody('   Leading spaces are stripped.   ')).toBe(
      'Leading spaces are stripped',
    );
  });

  it('returns empty string when the prefix before the terminator is empty', () => {
    expect(suggestTitleFromBody('. Nothing before the period.')).toBe('');
    expect(suggestTitleFromBody('?')).toBe('');
  });
});
