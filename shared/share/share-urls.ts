/**
 * @build-unit bu-network-shares
 * @spec build/session-briefs/bu-network-shares.md
 *
 * Pure URL composers for the polymorphic share rail. Unlike the post-
 * specific helpers, these take a generic `{ url, title }` pair and a
 * destination — they're used by `<ShareGroup>` to power the X / IG /
 * FB / WhatsApp share targets on /network cards (and any future
 * surface that adopts the rail).
 *
 * The URL passed in is the **upstream URL** (e.g. the Telegraph
 * article), NOT a GPS-app page. Sharon's followers want to read the
 * article, not bounce through our app first. See bu-network-shares
 * brief §"Open questions" — UTMs intentionally omitted to keep
 * shared URLs clean.
 */

import type { ShareDestination } from '@prisma/client';

export interface ShareTargetInfo {
  /** The canonical URL the share will point at — upstream, not a GPS page. */
  url: string;
  /** Human-readable title the share text leads with. */
  title: string;
}

/**
 * Resolve the destination-specific share URL. Returns `null` for
 * `copy_link` and `other` — those destinations have no URL to open;
 * the caller handles them separately (clipboard write / silent
 * intent-only).
 *
 * Note: Instagram has no public web-share URL — its mobile app
 * supports a custom URL scheme but it's flaky cross-OS. We return
 * `https://www.instagram.com/` as the platform-home fallback (matches
 * SecondaryCtaRail's existing posture). The intent record still
 * fires; verified is captured if the member opens IG and posts.
 */
export function buildShareUrl(destination: ShareDestination, info: ShareTargetInfo): string | null {
  const { url, title } = info;
  switch (destination) {
    case 'whatsapp': {
      const text = composeText(title, url, 1500);
      return `https://wa.me/?text=${encodeURIComponent(text)}`;
    }
    case 'x': {
      // X (Twitter) Web Intent — supports `text` + `url` params. The
      // platform handles the layout (text first, link auto-card).
      const params = new URLSearchParams({ text: title, url });
      return `https://twitter.com/intent/tweet?${params.toString()}`;
    }
    case 'facebook': {
      // Facebook Sharer takes `u` for the URL. Title comes from the
      // OpenGraph metadata on the linked page; we don't push it
      // separately to avoid double-titling.
      const params = new URLSearchParams({ u: url });
      return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
    }
    case 'instagram':
      // No reliable web-share URL — open the platform home so a
      // logged-in member can post manually. Intent still fires.
      return 'https://www.instagram.com/';
    case 'email': {
      const params = new URLSearchParams({ subject: title, body: `${title}\n\n${url}` });
      return `mailto:?${params.toString()}`;
    }
    case 'copy_link':
    case 'other':
      return null;
  }
}

/**
 * Compose a single text blob (title + url separated by two newlines)
 * for destinations like WhatsApp that take a freeform text param.
 * Truncates the title (NOT the URL) if the encoded blob would exceed
 * `maxChars`. The URL is always preserved so the platform's link
 * preview latches on.
 */
function composeText(title: string, url: string, maxChars: number): string {
  const trimmedTitle = title.trim();
  const naive = [trimmedTitle, url].filter((s) => s.length > 0).join('\n\n');
  if (naive.length <= maxChars) return naive;

  const separator = '\n\n';
  const truncationMarker = '…';
  const budget = maxChars - url.length - separator.length - truncationMarker.length;
  if (budget <= 0) return url;
  const truncatedTitle = `${trimmedTitle.slice(0, budget)}${truncationMarker}`;
  return [truncatedTitle, url].join(separator);
}

/**
 * Fallback title for the share rail. Used by callers (`<ShareGroup>`,
 * `<WhatsAppShareButton>`) when no real preview/title is available —
 * the hostname is a sensible "what is this link" stand-in. Per the
 * brief's open question: "lean: hostname of url".
 */
export function fallbackTitleFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
