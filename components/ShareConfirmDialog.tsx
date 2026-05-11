'use client';

/**
 * @build-unit bu-network-shares
 * @spec build/session-briefs/bu-network-shares.md
 * @spec adrs/0018-share-event-polymorphic.md
 * @spec architecture/decision-log.md (D047)
 *
 * Polymorphic "Did you send it?" follow-up dialog. Fires after a member
 * taps a share button — the share window opens in a new tab, and when
 * focus returns to GPS Action we surface this prompt so the member can
 * mark the share verified.
 *
 * Three options:
 *   - Yes → fires `onConfirm()` which posts to /api/analytics/share-intent
 *     with `verified: true` so the ShareEvent row is stamped.
 *   - Not yet / Skip → fires `onSkip()` — the intent row already exists
 *     (created by the share-button tap), no further write needed.
 *
 * Honest-tracking copy (per D047 / CLAUDE.md voice notes): "Did you
 * send it?" not "Confirm your share." The verified count is built
 * from honest member confirmation, not OAuth or guess work.
 */

import type { FC, MouseEvent } from 'react';
import type { ShareDestination, ShareTargetType } from '@prisma/client';

export interface ShareConfirmDialogProps {
  targetType: ShareTargetType;
  targetId: string;
  destination: ShareDestination;
  /** Open/closed flag — caller owns visibility. */
  open: boolean;
  /** Member confirmed the share went through. */
  onConfirm: () => void | Promise<void>;
  /** Member skipped / hasn't sent yet. No DB write. */
  onSkip: () => void;
}

const DESTINATION_LABEL: Record<ShareDestination, string> = {
  whatsapp: 'WhatsApp',
  x: 'X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  email: 'email',
  copy_link: 'clipboard',
  other: 'share',
};

export const ShareConfirmDialog: FC<ShareConfirmDialogProps> = ({
  targetType,
  targetId,
  destination,
  open,
  onConfirm,
  onSkip,
}) => {
  if (!open) return null;

  const label = DESTINATION_LABEL[destination];

  function handleConfirm(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    void onConfirm();
  }

  function handleSkip(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    onSkip();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-confirm-title"
      data-testid="share-confirm-dialog"
      data-target-type={targetType}
      data-target-id={targetId}
      data-destination={destination}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--colour-text-primary) 30%, transparent)',
        zIndex: 1000,
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          background: 'var(--colour-surface-raised)',
          border: '1px solid var(--colour-border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-5)',
          maxWidth: 360,
          width: '100%',
          fontFamily: 'var(--font-ui)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <h2
          id="share-confirm-title"
          style={{
            margin: 0,
            marginBottom: 'var(--space-2)',
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--colour-text-primary)',
          }}
        >
          Did you send it on {label}?
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
            lineHeight: 'var(--line-normal)',
          }}
        >
          Honest tracking — we only count verified shares.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            data-testid="share-confirm-skip"
            onClick={handleSkip}
            style={skipButtonStyle}
          >
            Not yet
          </button>
          <button
            type="button"
            data-testid="share-confirm-yes"
            onClick={handleConfirm}
            style={confirmButtonStyle}
          >
            Yes, I sent it
          </button>
        </div>
      </div>
    </div>
  );
};

const skipButtonStyle = {
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--colour-border-subtle)',
  background: 'transparent',
  color: 'var(--colour-text-secondary)',
  cursor: 'pointer',
  minHeight: 36,
} as const;

const confirmButtonStyle = {
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--colour-accent-primary, var(--colour-text-link))',
  background: 'var(--colour-accent-primary, var(--colour-text-link))',
  color: 'var(--colour-surface-raised)',
  cursor: 'pointer',
  fontWeight: 'var(--weight-semibold)',
  minHeight: 36,
} as const;
