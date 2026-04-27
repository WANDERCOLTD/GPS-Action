/**
 * @build-unit BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec architecture/decision-log.md (D065)
 *
 * WhatsApp share URL composer. Pure function — no I/O, no env reads.
 *
 * Builds a `https://wa.me/?text=<encoded>` universal link that opens
 * WhatsApp (mobile) or WhatsApp Web (desktop) with a pre-filled message
 * containing the post title, body, and a deep link back to the GPS
 * Action post.
 *
 * The whole encoded text is hard-capped at MAX_TEXT_CHARS (1500) to
 * stay safely under WhatsApp's practical URL limit. The URL is always
 * preserved as the final line; if the message is over the cap, the
 * body is truncated with `…` and the URL still appears at the bottom
 * so the link preview latches on.
 */

const MAX_TEXT_CHARS = 1500;
const TRUNCATION_MARKER = '…';

export interface WhatsAppShareInput {
  /** Post UUID — composed into the deep-link URL. */
  postId: string;
  /** Post title — first line of the message. */
  postTitle: string;
  /** Post body — middle of the message; may be truncated. */
  postBody: string;
  /**
   * Canonical site origin (e.g. `https://gpsaction.org`). The deep-link
   * to the post is `${originUrl}/post/${postId}`. Caller resolves this
   * via `getSiteOrigin()` (see `shared/site-origin.ts`).
   */
  originUrl: string;
}

export function whatsAppShareUrl(input: WhatsAppShareInput): string {
  const text = composeShareText(input);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Compose the plain-text message that gets URL-encoded into the
 * WhatsApp share. Exposed for tests and for callers that need the
 * raw text (e.g. clipboard fallback if WhatsApp deep-link fails on
 * an unsupported platform — out of scope for this BU but a likely
 * BU-share-out follow-up).
 */
export function composeShareText({
  postId,
  postTitle,
  postBody,
  originUrl,
}: WhatsAppShareInput): string {
  const postUrl = `${originUrl.replace(/\/+$/, '')}/post/${postId}`;
  const titleLine = postTitle.trim();
  const bodyText = postBody.trim();

  // Reserved chars: title + URL + the two `\n\n` separators (4 chars).
  const reserved = titleLine.length + postUrl.length + 4;
  const bodyBudget = MAX_TEXT_CHARS - reserved;

  if (bodyBudget <= 0) {
    // Title alone already fills the budget — drop the body. Title is
    // truncated instead so the URL still survives.
    const titleBudget = MAX_TEXT_CHARS - postUrl.length - 2; // one `\n\n`
    const truncatedTitle =
      titleLine.length > titleBudget ? truncate(titleLine, titleBudget) : titleLine;
    return `${truncatedTitle}\n\n${postUrl}`;
  }

  const truncatedBody = bodyText.length > bodyBudget ? truncate(bodyText, bodyBudget) : bodyText;
  if (!truncatedBody) {
    return `${titleLine}\n\n${postUrl}`;
  }
  return `${titleLine}\n\n${truncatedBody}\n\n${postUrl}`;
}

function truncate(value: string, max: number): string {
  if (max <= TRUNCATION_MARKER.length) return TRUNCATION_MARKER.slice(0, Math.max(0, max));
  return value.slice(0, max - TRUNCATION_MARKER.length).trimEnd() + TRUNCATION_MARKER;
}
