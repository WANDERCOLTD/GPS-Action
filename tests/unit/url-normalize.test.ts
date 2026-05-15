/**
 * Unit tests for url-normalize (the spread-gallery dedup key).
 *
 * @build-unit BU-link-preview-store
 */

import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '@/server/lib/url-normalize';

describe('normalizeUrl', () => {
  it('lowercases host and drops www', () => {
    expect(normalizeUrl('https://WWW.Example.com/path')).toBe('https://example.com/path');
  });

  it('strips fragments', () => {
    expect(normalizeUrl('https://example.com/x#section')).toBe('https://example.com/x');
  });

  it('strips utm_* params', () => {
    expect(normalizeUrl('https://example.com/x?utm_source=fb&utm_campaign=spring')).toBe(
      'https://example.com/x',
    );
  });

  it('strips named tracking params (fbclid, gclid, etc.)', () => {
    expect(
      normalizeUrl(
        'https://example.com/x?fbclid=abc&gclid=def&mc_cid=1&mc_eid=2&igshid=q&si=r&ref=z',
      ),
    ).toBe('https://example.com/x');
  });

  it('preserves non-tracking query params', () => {
    expect(normalizeUrl('https://example.com/x?id=42&utm_source=fb')).toBe(
      'https://example.com/x?id=42',
    );
  });

  it('alphabetises remaining query params', () => {
    expect(normalizeUrl('https://example.com/x?b=2&a=1')).toBe('https://example.com/x?a=1&b=2');
  });

  it('strips trailing slash on a non-root path', () => {
    expect(normalizeUrl('https://example.com/article/')).toBe('https://example.com/article');
  });

  it('preserves the root slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('upgrades http to https', () => {
    expect(normalizeUrl('http://example.com/x')).toBe('https://example.com/x');
  });

  it('collides on canonical form for two utm variants of the same article', () => {
    const a = normalizeUrl('https://example.com/article?utm_source=x');
    const b = normalizeUrl('https://example.com/article?utm_source=y');
    expect(a).toBe(b);
  });

  it('returns the raw lowercased string on invalid input', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });

  it('returns the raw lowercased string on unsupported protocol', () => {
    expect(normalizeUrl('ftp://example.com/x')).toBe('ftp://example.com/x');
  });
});
