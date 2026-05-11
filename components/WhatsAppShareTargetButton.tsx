'use client';

/**
 * @build-unit bu-network-shares
 * @spec build/session-briefs/bu-network-shares.md
 * @spec adrs/0018-share-event-polymorphic.md
 *
 * Polymorphic WhatsApp share button. Adjacent to (NOT inside) the
 * `<ShareGroup>` social rail per the share-taxonomy rule. Takes a
 * generic `{ url, title, targetType, targetId }` shape so any
 * shareable surface plugs in without a post-shaped wrapper.
 *
 * Behaviour mirrors the existing `<WhatsAppShareButton>` (post-flavoured)
 * — same green pill, same wa.me/?text=... universal link, same fire-
 * and-forget analytics ping. The only difference is the payload:
 *   - Old (post): `{ postId, destination: 'whatsapp' }` → legacy log
 *   - New (poly): `{ targetType, targetId, destination: 'whatsapp' }`
 *                  → ShareEvent table write (auth-gated)
 *
 * `WhatsAppShareButton` (post variant) is preserved as-is for /feed
 * and post-detail; this sibling component handles every other target
 * type. They can converge once /feed adopts the polymorphic flow in a
 * later BU (bu-post-share-counter follow-up).
 */

import type { FC, MouseEvent as ReactMouseEvent } from 'react';
import type { ShareTargetType } from '@prisma/client';
import { buildShareUrl } from '@/shared/share/share-urls';
import { pingShareIntent } from '@/components/ShareGroup';

export interface WhatsAppShareTargetButtonProps {
  url: string;
  title: string;
  targetType: ShareTargetType;
  targetId: string;
  /** Visual size — defaults to `compact`. */
  variant?: 'compact' | 'pill';
  /** Fires after the analytics ping; caller uses this to open the verify dialog. */
  onShareInitiated?: () => void;
}

export const WhatsAppShareTargetButton: FC<WhatsAppShareTargetButtonProps> = ({
  url,
  title,
  targetType,
  targetId,
  variant = 'compact',
  onShareInitiated,
}) => {
  const href = buildShareUrl('whatsapp', { url, title }) ?? url;
  const isPill = variant === 'pill';
  const size = isPill ? 40 : 32;

  function handleClick(event: ReactMouseEvent<HTMLAnchorElement>): void {
    event.stopPropagation();
    pingShareIntent({ targetType, targetId, destination: 'whatsapp' });
    if (onShareInitiated) onShareInitiated();
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Share on WhatsApp"
      title="Share on WhatsApp"
      onClick={handleClick}
      data-testid="share-target-whatsapp"
      data-target-type={targetType}
      data-target-id={targetId}
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
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        <WhatsAppGlyph size={isPill ? 20 : 18} />
      </span>
      {isPill && <span>WhatsApp</span>}
    </a>
  );
};

// ── Icon ─────────────────────────────────────────────────────────────────
//
// Inlined to match the existing WhatsAppShareButton — same simple-icons
// path data so the visual is identical. Kept duplicate rather than
// extracted to avoid pulling a glyph-registry dep into this BU.

interface WhatsAppGlyphProps {
  size: number;
}

const WhatsAppGlyph: FC<WhatsAppGlyphProps> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
