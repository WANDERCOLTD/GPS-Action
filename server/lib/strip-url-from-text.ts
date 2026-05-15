/**
 * @build-unit BU-source-and-kind-icons
 * @spec adrs/0020-source-and-kind-icons.md
 *
 * Pure function. Given the raw `text_body` of a WhatsApp message and
 * the canonical `normalizedUrl` of the shared URL, returns the
 * message text with the matching URL stripped — so the detail
 * sheet's quote block doesn't show the URL inline a second time
 * (the tile + Open-link button already represent it).
 *
 * Strategy: extract every URL-shaped substring from the text,
 * normalise each, compare against the target `normalizedUrl`,
 * strip the matching one(s). Non-matching URLs stay as plain text
 * (clickable rendering is a future call — see ADR-0020 §"What's
 * NOT in this ADR").
 *
 * Returns an empty string when:
 *  - the input text is null/empty
 *  - the message body was just the URL (after strip → only whitespace)
 *
 * Callers should treat the empty-string return as "don't render the
 * quote block".
 */

import { normalizeUrl } from '@/server/lib/url-normalize';

// Loose URL pattern. We're matching what WhatsApp message bodies
// actually contain — http(s) prefixed strings with no whitespace.
// Trailing punctuation is trimmed back after the match.
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCT = /[.,;:!?)\]}>'"`]+$/;

export function stripUrlFromText(
  text: string | null | undefined,
  targetNormalizedUrl: string,
): string {
  if (!text) return '';
  let out = '';
  let lastEnd = 0;
  for (const match of text.matchAll(URL_RE)) {
    // Trim trailing punctuation that the regex greedily caught.
    let raw = match[0];
    const trail = TRAILING_PUNCT.exec(raw);
    let trailingPunct = '';
    if (trail) {
      trailingPunct = trail[0];
      raw = raw.slice(0, raw.length - trailingPunct.length);
    }
    const start = match.index ?? 0;
    const end = start + raw.length;
    // Normalise this URL-shaped substring; compare against target.
    const candidate = normalizeUrl(raw);
    if (candidate === targetNormalizedUrl) {
      // Drop this URL (and its trailing punctuation, since the
      // sentence-end the punctuation belonged to is the URL).
      out += text.slice(lastEnd, start);
      lastEnd = end + trailingPunct.length;
    } else {
      // Leave it in place — non-matching URL stays as plain text.
      out += text.slice(lastEnd, end);
      lastEnd = end;
    }
  }
  out += text.slice(lastEnd);
  // Collapse any whitespace runs left behind by the strip and trim.
  return out.replace(/\s+/g, ' ').trim();
}
