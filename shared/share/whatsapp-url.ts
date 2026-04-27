/**
 * @build-unit BU-share-rail-on-detail
 * @spec build/session-briefs/bu-whatsapp-share.md
 *
 * WhatsApp share URL composer. Pure function — no I/O, no env reads.
 *
 * Builds a `https://wa.me/?text=<encoded>` universal link that opens
 * WhatsApp on mobile (or WhatsApp Web on desktop) with a pre-filled
 * message containing the post title, body, and a deep link back to the
 * GPS Action post.
 *
 * The whole encoded text is hard-capped at MAX_TEXT_CHARS (1500) to
 * stay safely under WhatsApp's practical URL limit. The URL is always
 * preserved as the final line; if the message is over the cap, the
 * body is truncated with `…` and the URL still appears at the bottom
 * so WhatsApp's link preview latches on.
 */

const MAX_TEXT_CHARS = 1500;
const TRUNCATION_MARKER = '…';

export interface WhatsAppShareInput {
  postId: string;
  postTitle: string;
  postBody: string;
  /** Canonical origin, e.g. https://gpsaction.org.uk (no trailing slash). */
  originUrl: string;
}

export function whatsAppShareUrl(input: WhatsAppShareInput): string {
  const { postId, postTitle, postBody, originUrl } = input;
  const postUrl = `${stripTrailingSlash(originUrl)}/post/${postId}`;
  const text = composeMessage(postTitle, postBody, postUrl);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function composeMessage(title: string, body: string, url: string): string {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const naive = [trimmedTitle, trimmedBody, url].filter((s) => s.length > 0).join('\n\n');
  if (naive.length <= MAX_TEXT_CHARS) return naive;

  // Over the cap — preserve title and url, truncate body to fit.
  // Required: title + \n\n + (truncated body + …) + \n\n + url
  const fixedParts = [trimmedTitle, url].filter((s) => s.length > 0);
  const separators = '\n\n'.length * fixedParts.length; // separators around body
  const fixedLength = fixedParts.reduce((n, s) => n + s.length, 0) + separators;
  const bodyBudget = MAX_TEXT_CHARS - fixedLength - TRUNCATION_MARKER.length;
  if (bodyBudget <= 0) {
    return [trimmedTitle, url].filter((s) => s.length > 0).join('\n\n');
  }
  const truncatedBody = `${trimmedBody.slice(0, bodyBudget)}${TRUNCATION_MARKER}`;
  return [trimmedTitle, truncatedBody, url].filter((s) => s.length > 0).join('\n\n');
}

function stripTrailingSlash(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}
