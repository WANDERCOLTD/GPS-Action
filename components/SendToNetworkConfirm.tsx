'use client';

/**
 * @build-unit BU-tick-or-cross
 * @spec build/session-briefs/bu-tick-or-cross.md
 * @spec architecture/decision-log.md (D069)
 *
 * Post-publish handoff modal for the `tick_or_cross` PostKind. Shown
 * after a successful publish; the post is already saved by the time
 * this opens, so closing the modal without confirming leaves a
 * "Sent to GPS Network" pill un-rendered on the card but does NOT
 * affect the post's existence.
 *
 * Behaviour, in order:
 *
 *   1. On mount, write the formatted message to the clipboard via
 *      `navigator.clipboard.writeText`. If unavailable (insecure
 *      origin, denied permission), a fallback flag flips so the modal
 *      copy reads "Select and copy the message manually" — the
 *      message stays visible regardless.
 *   2. Show the formatted message in a read-only block + a single
 *      primary CTA "Open GPS Network channel" that launches the
 *      channel URL in a new tab.
 *   3. After the CTA tap, switch to "Did you send it?" with two
 *      buttons. "I sent it" calls
 *      `markPostSharedToNetworkAction(postId)` then closes; "Not yet"
 *      closes without marking.
 *
 * Honest copy throughout — never claim the message went anywhere it
 * didn't.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import type { Signal } from '@prisma/client';
import { networkChannelMessage } from '@/shared/share/network-channel-message';
import { markPostSharedToNetworkAction } from '@/app/post/[id]/actions';

interface SendToNetworkConfirmProps {
  postId: string;
  signal: Signal;
  title: string;
  body: string;
  /** Canonical site origin so the formatter can produce {origin}/post/{id}. */
  originUrl: string;
  /** Validated channel deep-link from `WHATSAPP_NETWORK_CHANNEL_URL`. */
  channelUrl: string;
  /** Called after the user dismisses (with or without confirming). */
  onClose: () => void;
}

type Phase = 'preflight' | 'awaiting-return';

export function SendToNetworkConfirm({
  postId,
  signal,
  title,
  body,
  originUrl,
  channelUrl,
  onClose,
}: SendToNetworkConfirmProps) {
  const message = networkChannelMessage({
    signal,
    title,
    body,
    postUrl: `${stripTrailingSlash(originUrl)}/post/${postId}`,
  });

  const [phase, setPhase] = useState<Phase>('preflight');
  const [clipboardOk, setClipboardOk] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function copy() {
      const api = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      if (!api?.writeText) {
        if (!cancelled) setClipboardOk(false);
        return;
      }
      try {
        await api.writeText(message);
        if (!cancelled) setClipboardOk(true);
      } catch {
        if (!cancelled) setClipboardOk(false);
      }
    }
    void copy();
    return () => {
      cancelled = true;
    };
  }, [message]);

  function handleOpenChannel() {
    if (typeof window !== 'undefined') {
      window.open(channelUrl, '_blank', 'noopener,noreferrer');
    }
    setPhase('awaiting-return');
  }

  async function handleConfirmSent() {
    setConfirming(true);
    try {
      await markPostSharedToNetworkAction(postId);
    } finally {
      setConfirming(false);
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-to-network-heading"
      data-testid="compose-send-to-network"
      style={overlayStyle}
    >
      <div style={sheetStyle}>
        <h2 id="send-to-network-heading" style={headingStyle}>
          {phase === 'preflight' ? 'Send to GPS Network' : 'Did you send it?'}
        </h2>

        {phase === 'preflight' && (
          <>
            <p style={bodyStyle}>
              {clipboardOk === false
                ? 'Select and copy the message below, then open the channel and paste.'
                : clipboardOk === true
                  ? "We've copied the message for you. Open the channel and paste."
                  : 'Preparing the message…'}
            </p>
            <pre data-testid="compose-send-to-network-message" style={messageBlockStyle}>
              {message}
            </pre>
            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={handleOpenChannel}
                data-testid="compose-send-to-network-open"
                className="gps-btn gps-btn--primary"
              >
                Open GPS Network channel
              </button>
              <button
                type="button"
                onClick={onClose}
                data-testid="compose-send-to-network-cancel"
                className="gps-btn gps-btn--secondary"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {phase === 'awaiting-return' && (
          <>
            <p style={bodyStyle}>
              Pasted in WhatsApp and sent the message? We&rsquo;ll mark this post as sent. If you
              haven&rsquo;t yet, you can do it later from the post.
            </p>
            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={handleConfirmSent}
                disabled={confirming}
                data-testid="compose-send-to-network-yes"
                className="gps-btn gps-btn--primary"
              >
                {confirming ? 'Marking…' : 'I sent it'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={confirming}
                data-testid="compose-send-to-network-no"
                className="gps-btn gps-btn--secondary"
              >
                Not yet
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'color-mix(in srgb, var(--colour-text-primary) 50%, transparent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-4)',
  zIndex: 'var(--z-modal)' as unknown as number,
};

const sheetStyle: CSSProperties = {
  background: 'var(--colour-surface-raised)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5) var(--space-6)',
  maxWidth: '32rem',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-ui)',
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  color: 'var(--colour-text-primary)',
};

const bodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
  lineHeight: 1.5,
};

const messageBlockStyle: CSSProperties = {
  margin: 0,
  padding: 'var(--space-3) var(--space-4)',
  background: 'var(--colour-surface-sunken)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono, monospace)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: 'var(--colour-text-primary)',
  userSelect: 'all',
};

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-2)',
};
