'use client';

/**
 * @build-unit BU-share-rail-on-detail BU-whatsapp-share BU-hydration-fixes
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec build/session-briefs/bu-hydration-fixes.md
 * @spec architecture/decision-log.md (D067, D080)
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
 *
 * D080 — hydration safety. The `href` is computed in two phases:
 *   - On the server (and first client paint), `originUrl=''` so the
 *     embedded post URL is a relative `/post/<id>` — deterministic,
 *     does not depend on the request host.
 *   - After mount, `useEffect` re-renders with `getSiteOrigin()`,
 *     producing the fully-qualified `https://…/post/<id>` link that
 *     WhatsApp's link preview can latch onto.
 * This avoids the "server origin differs from `window.location.origin`"
 * SSR/CSR mismatch that surfaced when the dev server was reached over
 * mDNS (e.g. `http://mba.local:3001`). See bu-hydration-fixes brief.
 */

import type { FC, MouseEvent as ReactMouseEvent } from 'react';
import * as React from 'react';
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
  // Two-phase origin resolution (D080). Server render and first client
  // paint use originUrl='' — emits a relative /post/<id> deep link —
  // so the rendered HTML is byte-identical regardless of which host the
  // request landed on. After mount, swap to getSiteOrigin() to produce
  // the fully-qualified URL WhatsApp's preview parser expects.
  const [origin, setOrigin] = React.useState<string>('');
  React.useEffect(() => {
    setOrigin(getSiteOrigin());
  }, []);

  const href = whatsAppShareUrl({
    postId,
    postTitle,
    postBody,
    originUrl: origin,
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
      <span data-testid="whatsapp-share-icon" aria-hidden="true" style={{ display: 'inline-flex' }}>
        <WhatsAppGlyph size={isPill ? 20 : 18} />
      </span>
      {isPill && <span>WhatsApp</span>}
    </a>
  );
};

// ── Icon ─────────────────────────────────────────────────────────────────
//
// We use WhatsApp's brand glyph; whatsapp.com/brand permits this for
// share-to-WhatsApp buttons. Path data sourced from simple-icons.org.
// `currentColor` for the fill so the existing white-on-green contrast
// (set by the parent `<a>`) carries through unchanged.

interface WhatsAppGlyphProps {
  size: number;
}

const WhatsAppGlyph: FC<WhatsAppGlyphProps> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

/**
 * Exported for direct unit testing — the component now calls hooks
 * (D080) so it can no longer be invoked outside a render context, but
 * the analytics ping behaviour is independently testable here.
 */
export function pingShareIntent(postId: string): void {
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
