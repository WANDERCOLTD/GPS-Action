'use client';

/**
 * @build-unit BU-share-rail-on-detail BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec architecture/decision-log.md (D067)
 *
 * One-tap WhatsApp share affordance. Larger and visually distinct from
 * the X / Instagram / Facebook icons in `<SecondaryCtaRail>` because
 * WhatsApp is the primary share channel for the network — the
 * "WhatsApp-replacement loop" is the core product motion.
 *
 * Two visual variants:
 *   - `compact`  — circular green button matching the social rail size.
 *                  Used in the PostCard right rail.
 *   - `pill`     — wider green pill with glyph + "WhatsApp" label.
 *                  Used as the lead affordance on the post detail page.
 *
 * On click:
 *   1. event.stopPropagation() so the PostCard's body-tap does not fire
 *      (D061 tap precedence).
 *   2. Fires the catalogued `post_shared_out` analytics event with
 *      `destination: 'whatsapp'` via sendBeacon (fetch fallback with
 *      keepalive: true). The ping survives the navigation away to
 *      WhatsApp. Fire-and-forget — never blocks the share UX. See D067.
 *   3. Opens `wa.me/?text=...` in a new tab. Mobile OSes route the
 *      universal link to the installed WhatsApp app; desktop falls
 *      through to WhatsApp Web.
 */

import type { FC, MouseEvent as ReactMouseEvent } from 'react';
import * as React from 'react';
import { Phone } from 'lucide-react';
import { whatsAppShareUrl } from '@/shared/share/whatsapp-url';
import { getSiteOrigin } from '@/shared/site-origin';

interface WhatsAppShareButtonProps {
  postId: string;
  postTitle: string;
  postBody: string;
  variant?: 'compact' | 'pill';
}

export const WhatsAppShareButton: FC<WhatsAppShareButtonProps> = ({
  postId,
  postTitle,
  postBody,
  variant = 'compact',
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

  const isPill = variant === 'pill';
  const size = isPill ? 40 : 32;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Share on WhatsApp"
      title="Share on WhatsApp"
      onClick={handleClick}
      data-testid="post-share-whatsapp"
      data-post-id={postId}
      data-variant={variant}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isPill ? 'var(--space-2)' : 0,
        height: size,
        minWidth: size,
        padding: isPill ? '0 var(--space-3)' : 0,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--colour-brand-whatsapp)',
        color: 'var(--colour-brand-whatsapp-contrast)',
        textDecoration: 'none',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        lineHeight: 1,
        boxShadow: 'var(--shadow-sm)',
        flexShrink: 0,
      }}
    >
      <Phone size={isPill ? 20 : 18} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      {isPill && <span>WhatsApp</span>}
    </a>
  );
};

// ── Icon ─────────────────────────────────────────────────────────────────
//
// We use lucide's `Phone` (a phone receiver glyph) rather than a chat
// bubble. The chat-bubble icon was visually identical to the comments
// icon used elsewhere in the rail, which made the column read as two
// instances of the same concept. The phone receiver is universally
// "call/voice" — distinct from the comments bubble and still consistent
// with the WhatsApp affordance (the green bubble + phone is what every
// platform's WhatsApp share button looks like).
//
// Not using the trademarked WhatsApp logomark, which has brand-use
// restrictions; the phone-on-green is the universal substitute and
// still reads as "WhatsApp share" in context.

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
