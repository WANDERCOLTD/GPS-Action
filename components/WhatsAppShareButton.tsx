'use client';

/**
 * @build-unit BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec architecture/decision-log.md (D065)
 *
 * Per-PostCard WhatsApp forward affordance. Tap opens WhatsApp (mobile)
 * or WhatsApp Web (desktop) via a `https://wa.me/?text=…` universal
 * link, pre-filled with the post title, body, and a deep link back to
 * the GPS Action post.
 *
 * Side-effect on click: fires the catalogued `post_shared_out` analytics
 * event with `destination: 'whatsapp'` (POST /api/analytics/share-intent).
 * The ping uses `navigator.sendBeacon` where available so it survives
 * the navigation away to WhatsApp.
 *
 * D061 tap precedence: the click handler `stopPropagation()`s so the
 * parent PostCard's body-tap (which navigates to /post/[id]) does not
 * fire. PostCard's own selector also bails on `<a>` clicks — this is
 * defence in depth.
 *
 * Brand-asset note: WhatsApp brand guidelines forbid recolouring the
 * glyph. The inline SVG uses the official brand green (#25D366) with
 * a white inner mark.
 */

import type { FC, MouseEvent as ReactMouseEvent, ReactElement } from 'react';
import * as React from 'react';
import { whatsAppShareUrl } from '@/shared/share/whatsapp-url';
import { getSiteOrigin } from '@/shared/site-origin';

// WhatsApp brand colours — explicitly outside the design-token system.
// The brand glyph cannot be re-tinted (WhatsApp brand guidelines), so
// these hex literals are intentional and must not be replaced with
// app theme tokens.
// eslint-disable-next-line local-rules/require-design-tokens -- WhatsApp brand colour
const WHATSAPP_GREEN = '#25D366';
// eslint-disable-next-line local-rules/require-design-tokens -- WhatsApp brand inner-glyph colour
const WHATSAPP_GLYPH_FG = '#FFFFFF';
const ICON_SIZE_PX = 28;
const TAP_TARGET_PX = 44;

interface WhatsAppShareButtonProps {
  postId: string;
  postTitle: string;
  postBody: string;
}

export const WhatsAppShareButton: FC<WhatsAppShareButtonProps> = ({
  postId,
  postTitle,
  postBody,
}) => {
  const href = whatsAppShareUrl({
    postId,
    postTitle,
    postBody,
    originUrl: getSiteOrigin(),
  });

  function handleClick(event: ReactMouseEvent<HTMLAnchorElement>): void {
    event.stopPropagation();
    pingShareIntent(postId);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      data-testid="post-share-whatsapp"
      data-post-id={postId}
      aria-label="Forward to WhatsApp"
      title="Forward to WhatsApp"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${TAP_TARGET_PX}px`,
        height: `${TAP_TARGET_PX}px`,
        borderRadius: 'var(--radius-pill)',
        color: WHATSAPP_GREEN,
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      <WhatsAppGlyph size={ICON_SIZE_PX} />
    </a>
  );
};

/**
 * Inline WhatsApp glyph (speech bubble with phone receiver). Brand
 * green fill, white inner mark. Do not recolour — see brand-asset
 * note in the component header.
 */
function WhatsAppGlyph({ size }: { size: number }): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill={WHATSAPP_GREEN}
        d="M16 .5C7.44.5.5 7.44.5 16c0 2.82.74 5.58 2.15 8.01L.5 31.5l7.66-2.1A15.42 15.42 0 0016 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5z"
      />
      <path
        fill={WHATSAPP_GLYPH_FG}
        d="M23.6 19.34c-.41-.21-2.43-1.2-2.81-1.34-.38-.14-.65-.21-.93.21-.27.41-1.06 1.34-1.3 1.61-.24.27-.48.31-.89.1-.41-.21-1.74-.64-3.31-2.04-1.22-1.09-2.05-2.43-2.29-2.84-.24-.41-.03-.63.18-.84.19-.19.41-.48.62-.73.21-.24.27-.41.41-.69.14-.27.07-.51-.03-.72-.1-.21-.93-2.24-1.27-3.07-.34-.81-.69-.7-.93-.71l-.79-.01c-.27 0-.72.1-1.1.51-.38.41-1.44 1.41-1.44 3.44 0 2.03 1.48 3.99 1.69 4.27.21.27 2.91 4.45 7.06 6.24.99.43 1.76.69 2.36.88.99.31 1.89.27 2.6.16.79-.12 2.43-.99 2.78-1.95.34-.96.34-1.78.24-1.95-.1-.18-.38-.28-.79-.49z"
      />
    </svg>
  );
}

function pingShareIntent(postId: string): void {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({ postId, destination: 'whatsapp' });
  const url = '/api/analytics/share-intent';
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }
  } catch {
    // sendBeacon throws in some restricted contexts — fall through to fetch.
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Analytics is fire-and-forget; never block the share UX on a ping failure.
  });
}
