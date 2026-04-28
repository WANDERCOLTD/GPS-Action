/**
 * @build-unit BU-tick-or-cross
 * @spec build/session-briefs/bu-tick-or-cross.md
 * @spec architecture/decision-log.md (D069)
 *
 * Unit tests for the GPS Network channel message formatter. Pure
 * function — no env reads, no clipboard, no DOM. The env validator
 * has its own coverage in `whatsapp-network-channel.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { networkChannelMessage } from '@/shared/share/network-channel-message';

describe('networkChannelMessage', () => {
  const baseInput = {
    title: 'Sky News bias on Cheddar Road',
    body: 'Front-page hit piece — please amplify the response thread.',
    postUrl: 'https://gps-action.example/post/abc-123',
  } as const;

  it('prefixes the title with ✅ for promote', () => {
    const out = networkChannelMessage({ ...baseInput, signal: 'promote' });
    expect(out.startsWith('✅ ')).toBe(true);
    expect(out).toContain(baseInput.title);
  });

  it('prefixes the title with ❌ for remove', () => {
    const out = networkChannelMessage({ ...baseInput, signal: 'remove' });
    expect(out.startsWith('❌ ')).toBe(true);
    expect(out).toContain(baseInput.title);
  });

  it('includes the post URL on the final line', () => {
    const out = networkChannelMessage({ ...baseInput, signal: 'promote' });
    const lines = out.split('\n');
    expect(lines[lines.length - 1]).toBe(baseInput.postUrl);
  });

  it('includes the body verbatim between title and URL', () => {
    const out = networkChannelMessage({ ...baseInput, signal: 'promote' });
    expect(out).toBe(`✅ ${baseInput.title}\n${baseInput.body}\n${baseInput.postUrl}`);
  });

  it('trims whitespace from each component', () => {
    const out = networkChannelMessage({
      signal: 'promote',
      title: '  Padded title  ',
      body: '\n\nBody with surrounding newlines\n\n',
      postUrl: '  https://example.com/post/x  ',
    });
    expect(out).toBe('✅ Padded title\nBody with surrounding newlines\nhttps://example.com/post/x');
  });

  it('omits empty body lines without breaking the URL placement', () => {
    const out = networkChannelMessage({
      signal: 'remove',
      title: 'Just a title',
      body: '   ',
      postUrl: 'https://example.com/post/y',
    });
    expect(out).toBe('❌ Just a title\nhttps://example.com/post/y');
  });
});
