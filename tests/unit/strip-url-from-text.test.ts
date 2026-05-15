/**
 * Unit tests for `stripUrlFromText`.
 *
 * @build-unit BU-source-and-kind-icons
 * @spec adrs/0020-source-and-kind-icons.md
 *
 * Covers the strip rules surfaced in the brief: exact match, utm
 * variants, trailing punctuation, non-matching URLs preserved,
 * empty after strip → empty string.
 */

import { describe, it, expect } from 'vitest';
import { stripUrlFromText } from '@/server/lib/strip-url-from-text';

const TARGET = 'https://example.com/article';

describe('stripUrlFromText', () => {
  it('returns empty when text is null', () => {
    expect(stripUrlFromText(null, TARGET)).toBe('');
  });

  it('returns empty when text is empty', () => {
    expect(stripUrlFromText('', TARGET)).toBe('');
  });

  it('returns empty when text is just the URL', () => {
    expect(stripUrlFromText('https://example.com/article', TARGET)).toBe('');
  });

  it('strips the URL but keeps surrounding text', () => {
    expect(
      stripUrlFromText('Strong piece on this — https://example.com/article — worth a read', TARGET),
    ).toBe('Strong piece on this — — worth a read');
  });

  it('strips a utm-variant URL (normalises before compare)', () => {
    expect(
      stripUrlFromText(
        'Forwarding from the other group: https://example.com/article?utm_source=fb',
        TARGET,
      ),
    ).toBe('Forwarding from the other group:');
  });

  it('strips a www-prefixed variant', () => {
    expect(stripUrlFromText('See: https://www.example.com/article', TARGET)).toBe('See:');
  });

  it('strips an http variant when target is https', () => {
    expect(stripUrlFromText('Old link: http://example.com/article', TARGET)).toBe('Old link:');
  });

  it('keeps a non-matching URL in place', () => {
    expect(stripUrlFromText('Compare to https://other.example/x for context', TARGET)).toBe(
      'Compare to https://other.example/x for context',
    );
  });

  it('strips matching URL but leaves non-matching one when both present', () => {
    expect(
      stripUrlFromText('Main: https://example.com/article — also https://other.example/y', TARGET),
    ).toBe('Main: — also https://other.example/y');
  });

  it('handles trailing punctuation on the matched URL', () => {
    expect(stripUrlFromText('Read this (https://example.com/article).', TARGET)).toBe(
      'Read this (',
    );
  });

  it('collapses leftover whitespace runs', () => {
    expect(stripUrlFromText('Before   https://example.com/article   after', TARGET)).toBe(
      'Before after',
    );
  });

  it('strips multiple matching URLs in one message', () => {
    expect(
      stripUrlFromText(
        'See https://example.com/article and again at https://example.com/article',
        TARGET,
      ),
    ).toBe('See and again at');
  });
});
