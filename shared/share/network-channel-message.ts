/**
 * @build-unit BU-tick-or-cross
 * @spec build/session-briefs/bu-tick-or-cross.md
 * @spec architecture/decision-log.md (D069)
 *
 * Pure formatter for the GPS Network channel handoff message.
 *
 * Output shape:
 *
 *   ✅ {title}
 *   {body}
 *   {postUrl}
 *
 * (or `❌` if the signal is `remove`). The body is preserved verbatim;
 * blank lines collapse so the WhatsApp paste reads cleanly.
 *
 * The channel URL itself comes from `shared/env/whatsapp-network-channel.ts`
 * — WhatsApp Channels do not accept `?text=` prefill, so this formatter
 * exists only to populate the clipboard. The user pastes once the
 * channel tab opens.
 */

import type { Signal } from '@prisma/client';

const GLYPH: Record<Signal, string> = {
  promote: '✅',
  remove: '❌',
};

export interface NetworkChannelMessageInput {
  signal: Signal;
  title: string;
  body: string;
  postUrl: string;
}

export function networkChannelMessage(input: NetworkChannelMessageInput): string {
  const glyph = GLYPH[input.signal];
  const title = input.title.trim();
  const body = input.body.trim();
  const url = input.postUrl.trim();

  const lines = [`${glyph} ${title}`, body, url].filter((line) => line.length > 0);
  return lines.join('\n');
}
