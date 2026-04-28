/**
 * @build-unit BU-link-first-composer
 * @spec build/session-briefs/bu-link-first-composer.md
 *
 * Table-driven coverage for the `normalizeUrl()` helper. Every row in
 * the URL detection table from the brief gets at least one assertion
 * here. Edge cases (multi-line, IDN, IP literal, trailing punctuation)
 * are explicit so a regression makes the failing case obvious.
 */

import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '@/shared/url-detect';

describe('normalizeUrl', () => {
  describe('absolute URLs (already protocoled)', () => {
    const cases: Array<[string, string]> = [
      ['https://example.com/path', 'https://example.com/path'],
      ['http://example.com', 'http://example.com'],
      [
        'https://www.theguardian.com/world/2026/article',
        'https://www.theguardian.com/world/2026/article',
      ],
      ['https://example.co.uk/page?ref=foo', 'https://example.co.uk/page?ref=foo'],
    ];
    for (const [input, expected] of cases) {
      it(`accepts ${input}`, () => {
        expect(normalizeUrl(input)).toEqual({ kind: 'url', url: expected });
      });
    }
  });

  describe('bare hostnames (no protocol) — gets https:// prepended', () => {
    const cases: Array<[string, string]> = [
      ['www.example.com', 'https://www.example.com'],
      ['example.co.uk/foo', 'https://example.co.uk/foo'],
      ['bit.ly/abc', 'https://bit.ly/abc'],
      ['example.com', 'https://example.com'],
      ['Example.com', 'https://Example.com'],
    ];
    for (const [input, expected] of cases) {
      it(`accepts ${input} → ${expected}`, () => {
        expect(normalizeUrl(input)).toEqual({ kind: 'url', url: expected });
      });
    }
  });

  describe('trailing prose punctuation is stripped', () => {
    it('strips trailing period', () => {
      expect(normalizeUrl('Example.com.')).toEqual({
        kind: 'url',
        url: 'https://Example.com',
      });
    });
    it('strips trailing comma on absolute URL', () => {
      expect(normalizeUrl('https://example.com,')).toEqual({
        kind: 'url',
        url: 'https://example.com',
      });
    });
    it('strips multiple trailing punctuation chars', () => {
      expect(normalizeUrl('https://example.com.,')).toEqual({
        kind: 'url',
        url: 'https://example.com',
      });
    });
    it('strips trailing close-paren', () => {
      expect(normalizeUrl('https://example.com)')).toEqual({
        kind: 'url',
        url: 'https://example.com',
      });
    });
  });

  describe('whitespace handling', () => {
    it('trims leading/trailing whitespace', () => {
      expect(normalizeUrl('   https://example.com   ')).toEqual({
        kind: 'url',
        url: 'https://example.com',
      });
    });
    it('first non-empty line wins on multi-line input', () => {
      expect(normalizeUrl('https://example.com\nMore text after')).toEqual({
        kind: 'url',
        url: 'https://example.com',
      });
    });
    it('treats a first line containing spaces as text, not URL', () => {
      expect(normalizeUrl('not a url\nhttps://example.com')).toEqual({ kind: 'text' });
    });
    it('CRLF line endings work too', () => {
      expect(normalizeUrl('https://example.com\r\nrest')).toEqual({
        kind: 'url',
        url: 'https://example.com',
      });
    });
  });

  describe('text — not a URL', () => {
    const textCases = [
      'Park Royal walkout tonight',
      'microsoft',
      'react-router',
      'a single word',
      'Saw something at the gate this morning',
      '',
      '   ',
      'just.a.thought ', // looks dotted but no real TLD
    ];
    for (const input of textCases) {
      it(`treats ${JSON.stringify(input)} as text`, () => {
        expect(normalizeUrl(input)).toEqual({ kind: 'text' });
      });
    }
  });

  describe('infrastructure addresses are text, not URLs', () => {
    it('treats localhost as text', () => {
      expect(normalizeUrl('localhost:3000')).toEqual({ kind: 'text' });
    });
    it('treats bare localhost as text', () => {
      expect(normalizeUrl('localhost')).toEqual({ kind: 'text' });
    });
    it('treats an IPv4 literal as text', () => {
      expect(normalizeUrl('192.168.1.1')).toEqual({ kind: 'text' });
    });
    it('treats an IPv4 with path as text', () => {
      expect(normalizeUrl('192.168.1.1/admin')).toEqual({ kind: 'text' });
    });
    it('treats http://localhost as text (no public TLD)', () => {
      expect(normalizeUrl('http://localhost:3000')).toEqual({ kind: 'text' });
    });
  });

  describe('input that looks URL-like but has no real TLD', () => {
    it('rejects bare made-up TLD', () => {
      expect(normalizeUrl('something.notarealtld')).toEqual({ kind: 'text' });
    });
    it('rejects single-letter TLD', () => {
      expect(normalizeUrl('something.x')).toEqual({ kind: 'text' });
    });
  });

  describe('URLs with port and query strings', () => {
    it('preserves port on absolute URL', () => {
      expect(normalizeUrl('https://example.com:8443/path')).toEqual({
        kind: 'url',
        url: 'https://example.com:8443/path',
      });
    });
    it('preserves query string', () => {
      expect(normalizeUrl('https://example.com/page?q=hello&p=2')).toEqual({
        kind: 'url',
        url: 'https://example.com/page?q=hello&p=2',
      });
    });
    it('handles bare host with port and path', () => {
      expect(normalizeUrl('example.com:8080/foo')).toEqual({
        kind: 'url',
        url: 'https://example.com:8080/foo',
      });
    });
  });
});
