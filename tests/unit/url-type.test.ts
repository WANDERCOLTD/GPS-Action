/**
 * Unit tests for url-type (domain → bucket classification).
 *
 * @build-unit BU-link-preview-store
 */

import { describe, it, expect } from 'vitest';
import { classifyHost, classifyUrl } from '@/server/lib/url-type';

describe('classifyHost', () => {
  it.each([
    ['x.com', 'Social'],
    ['twitter.com', 'Social'],
    ['instagram.com', 'Social'],
    ['facebook.com', 'Social'],
    ['m.facebook.com', 'Social'],
    ['threads.net', 'Social'],
    ['bsky.app', 'Social'],
    ['reddit.com', 'Social'],
  ])('classifies %s as Social', (host, type) => {
    expect(classifyHost(host)).toBe(type);
  });

  it.each([
    ['youtube.com', 'Video'],
    ['youtu.be', 'Video'],
    ['m.youtube.com', 'Video'],
    ['vimeo.com', 'Video'],
    ['tiktok.com', 'Video'],
  ])('classifies %s as Video', (host, type) => {
    expect(classifyHost(host)).toBe(type);
  });

  it.each([
    ['bbc.co.uk', 'News'],
    ['theguardian.com', 'News'],
    ['thejc.com', 'News'],
    ['telegraph.co.uk', 'News'],
    ['apple.news', 'News'],
  ])('classifies %s as News', (host, type) => {
    expect(classifyHost(host)).toBe(type);
  });

  it('classifies *.substack.com as News (suffix rule)', () => {
    expect(classifyHost('jonsac.substack.com')).toBe('News');
    expect(classifyHost('someone.substack.com')).toBe('News');
  });

  it.each([
    ['change.org', 'Action'],
    ['petition.parliament.uk', 'Action'],
    ['38degrees.org.uk', 'Action'],
    ['app.activistmailer.com', 'Action'],
    ['gofundme.com', 'Action'],
  ])('classifies %s as Action', (host, type) => {
    expect(classifyHost(host)).toBe(type);
  });

  it.each([
    ['example.com', 'Other'],
    ['gov.uk', 'Other'],
    ['some-blog.com', 'Other'],
    ['eventbrite.co.uk', 'Other'],
  ])('classifies %s as Other', (host, type) => {
    expect(classifyHost(host)).toBe(type);
  });

  it('handles www.* prefix', () => {
    expect(classifyHost('www.youtube.com')).toBe('Video');
  });

  it('is case-insensitive', () => {
    expect(classifyHost('X.COM')).toBe('Social');
    expect(classifyHost('Apple.News')).toBe('News');
  });
});

describe('classifyUrl', () => {
  it('classifies a full URL via its hostname', () => {
    expect(classifyUrl('https://youtube.com/watch?v=abc')).toBe('Video');
    expect(classifyUrl('https://www.bbc.co.uk/news/article')).toBe('News');
  });

  it('returns Other for invalid URLs', () => {
    expect(classifyUrl('not a url')).toBe('Other');
  });
});
