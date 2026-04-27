import { describe, it, expect } from 'vitest';
import { whatsAppShareUrl } from '@/shared/share/whatsapp-url';

const ORIGIN = 'https://gpsaction.org.uk';
const POST_ID = '3adcb56e-bcd0-41a0-a79c-8c3d1c458e36';

function decode(url: string): string {
  const text = new URL(url).searchParams.get('text');
  if (!text) throw new Error('missing text param');
  return text;
}

describe('whatsAppShareUrl', () => {
  it('builds a wa.me URL with title, body, and post URL on separate lines', () => {
    const url = whatsAppShareUrl({
      postId: POST_ID,
      postTitle: 'Sky News got the protest count wrong',
      postBody: "Their reporter wasn't even there. Receipts: ...",
      originUrl: ORIGIN,
    });
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decode(url);
    expect(text).toBe(
      `Sky News got the protest count wrong\n\nTheir reporter wasn't even there. Receipts: ...\n\n${ORIGIN}/post/${POST_ID}`,
    );
  });

  it('places the post URL as the final line', () => {
    const text = decode(
      whatsAppShareUrl({
        postId: POST_ID,
        postTitle: 'Title',
        postBody: 'Body',
        originUrl: ORIGIN,
      }),
    );
    const lines = text.split('\n').filter((line) => line.length > 0);
    expect(lines[lines.length - 1]).toBe(`${ORIGIN}/post/${POST_ID}`);
  });

  it('round-trips apostrophes and non-ASCII characters through encoding', () => {
    const text = decode(
      whatsAppShareUrl({
        postId: POST_ID,
        postTitle: "Sharon's update — שלום",
        postBody: 'Body with "quotes" & emoji 🕯️',
        originUrl: ORIGIN,
      }),
    );
    expect(text).toContain("Sharon's update — שלום");
    expect(text).toContain('Body with "quotes" & emoji 🕯️');
  });

  it('preserves embedded line breaks in the body', () => {
    const text = decode(
      whatsAppShareUrl({
        postId: POST_ID,
        postTitle: 'Title',
        postBody: 'Para 1\n\nPara 2',
        originUrl: ORIGIN,
      }),
    );
    expect(text).toContain('Para 1\n\nPara 2');
  });

  it('truncates the body with … when total text exceeds the cap, keeping the URL intact', () => {
    const longBody = 'x'.repeat(2000);
    const url = whatsAppShareUrl({
      postId: POST_ID,
      postTitle: 'T',
      postBody: longBody,
      originUrl: ORIGIN,
    });
    const text = decode(url);
    expect(text.length).toBeLessThanOrEqual(1500);
    expect(text.endsWith(`${ORIGIN}/post/${POST_ID}`)).toBe(true);
    expect(text).toContain('…');
  });

  it('strips a trailing slash from origin so the post URL has no double slash', () => {
    const text = decode(
      whatsAppShareUrl({
        postId: POST_ID,
        postTitle: 'T',
        postBody: 'B',
        originUrl: `${ORIGIN}/`,
      }),
    );
    expect(text).toContain(`${ORIGIN}/post/${POST_ID}`);
    expect(text).not.toContain(`${ORIGIN}//post/`);
  });

  it('handles an empty body by emitting only title + URL', () => {
    const text = decode(
      whatsAppShareUrl({
        postId: POST_ID,
        postTitle: 'Just a title',
        postBody: '',
        originUrl: ORIGIN,
      }),
    );
    expect(text).toBe(`Just a title\n\n${ORIGIN}/post/${POST_ID}`);
  });
});
