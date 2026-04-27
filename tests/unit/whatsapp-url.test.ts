/**
 * @build-unit BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 *
 * Unit tests for the WhatsApp share URL composer.
 */

import { describe, it, expect } from 'vitest';
import { whatsAppShareUrl, composeShareText } from '@/shared/share/whatsapp-url';

const ORIGIN = 'https://gpsaction.org';
const POST_ID = '0123456789ab';

describe('composeShareText', () => {
  it('orders title, body, then URL with blank lines between', () => {
    const text = composeShareText({
      postId: POST_ID,
      postTitle: 'Sky News bias post',
      postBody: 'Worth pushing back on this one.',
      originUrl: ORIGIN,
    });
    expect(text).toBe(
      'Sky News bias post\n\nWorth pushing back on this one.\n\nhttps://gpsaction.org/post/0123456789ab',
    );
  });

  it('always preserves the post URL as the final line', () => {
    const text = composeShareText({
      postId: POST_ID,
      postTitle: 'T',
      postBody: 'B',
      originUrl: ORIGIN,
    });
    const lines = text.split('\n');
    expect(lines[lines.length - 1]).toBe(`${ORIGIN}/post/${POST_ID}`);
  });

  it('strips a trailing slash from the origin', () => {
    const text = composeShareText({
      postId: POST_ID,
      postTitle: 'T',
      postBody: 'B',
      originUrl: 'https://gpsaction.org/',
    });
    expect(text).toContain('https://gpsaction.org/post/0123456789ab');
    expect(text).not.toContain('https://gpsaction.org//post/');
  });

  it('truncates a long body with the ellipsis character', () => {
    const longBody = 'x'.repeat(2000);
    const text = composeShareText({
      postId: POST_ID,
      postTitle: 'Title',
      postBody: longBody,
      originUrl: ORIGIN,
    });
    expect(text.length).toBeLessThanOrEqual(1500);
    expect(text).toContain('…');
    expect(text.endsWith(`${ORIGIN}/post/${POST_ID}`)).toBe(true);
  });

  it('drops the body cleanly when the title alone fills the budget', () => {
    const longTitle = 'T'.repeat(1490);
    const text = composeShareText({
      postId: POST_ID,
      postTitle: longTitle,
      postBody: 'body that should not survive',
      originUrl: ORIGIN,
    });
    expect(text).not.toContain('body that should not survive');
    expect(text.endsWith(`${ORIGIN}/post/${POST_ID}`)).toBe(true);
    expect(text.length).toBeLessThanOrEqual(1500);
  });

  it('omits the body separator when the body is empty after trim', () => {
    const text = composeShareText({
      postId: POST_ID,
      postTitle: 'Title',
      postBody: '   ',
      originUrl: ORIGIN,
    });
    expect(text).toBe(`Title\n\n${ORIGIN}/post/${POST_ID}`);
  });

  it('preserves apostrophes, emoji, and non-ASCII in the raw text', () => {
    const text = composeShareText({
      postId: POST_ID,
      postTitle: "Sharon's take 💕 — café",
      postBody: 'résumé',
      originUrl: ORIGIN,
    });
    expect(text).toContain("Sharon's take 💕 — café");
    expect(text).toContain('résumé');
  });
});

describe('whatsAppShareUrl', () => {
  it('returns a wa.me universal link', () => {
    const url = whatsAppShareUrl({
      postId: POST_ID,
      postTitle: 'T',
      postBody: 'B',
      originUrl: ORIGIN,
    });
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
  });

  it('encodes line breaks as %0A', () => {
    const url = whatsAppShareUrl({
      postId: POST_ID,
      postTitle: 'T',
      postBody: 'B',
      originUrl: ORIGIN,
    });
    expect(url).toContain('%0A%0A');
  });

  it('encodes spaces and special characters', () => {
    const url = whatsAppShareUrl({
      postId: POST_ID,
      postTitle: 'a b',
      postBody: 'c & d',
      originUrl: ORIGIN,
    });
    expect(url).toContain('a%20b');
    expect(url).toContain('c%20%26%20d');
  });

  it('round-trips: decoding the text param recovers the original message', () => {
    const url = whatsAppShareUrl({
      postId: POST_ID,
      postTitle: "Sharon's take",
      postBody: 'Worth sharing.',
      originUrl: ORIGIN,
    });
    const params = new URL(url).searchParams;
    const text = params.get('text');
    expect(text).toBe("Sharon's take\n\nWorth sharing.\n\nhttps://gpsaction.org/post/0123456789ab");
  });
});
