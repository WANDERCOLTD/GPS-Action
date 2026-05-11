'use client';

/**
 * @build-unit bu-network-shares
 * @spec build/session-briefs/bu-network-shares.md
 * @spec adrs/0018-share-event-polymorphic.md
 * @spec product/analytics-events.md
 *
 * Polymorphic share rail — the X / Instagram / Facebook social
 * affordances for any shareable target. Sits adjacent to (NOT inside)
 * a separate `<WhatsAppShareButton>` per the share-taxonomy rule:
 * share = socials rail + WhatsApp adjacent, NOT email; AM "Send email"
 * is a primary CTA, not a share.
 *
 * Behaviour on each social-rail tap:
 *   1. event.stopPropagation() — keep the parent card's body-tap
 *      handler from firing (matches WhatsAppShareButton's pattern).
 *   2. Fire-and-forget POST to /api/analytics/share-intent with
 *      `{ targetType, targetId, destination }`. sendBeacon-first,
 *      fetch + keepalive fallback. The ping survives the new-tab
 *      navigation. Failure is silent — analytics is decorative.
 *   3. The destination URL opens in a new tab. The component
 *      surfaces the verify-prompt via the `onShareInitiated` callback
 *      so the parent (NetworkCard) can open `<ShareConfirmDialog>`
 *      when focus returns to GPS Action.
 *
 * The Verified-share count pill renders to the left of the rail when
 * `counts` is provided. Greyed when count=0; highlights briefly on
 * tick-up (managed by the caller via `data-fresh="true"` pulse).
 */

import type { CSSProperties, FC, MouseEvent, ReactNode } from 'react';
import type { ShareDestination, ShareTargetType } from '@prisma/client';
import { buildShareUrl } from '@/shared/share/share-urls';
import { ShareCountPill, type ShareCountsView } from '@/components/ShareCountPill';

// Re-export so existing callers that import ShareCountsView from
// ShareGroup keep working.
export type { ShareCountsView };

export interface ShareGroupProps {
  /** Upstream URL the share will point at. */
  url: string;
  /** Title text the share will lead with (falls back to URL hostname). */
  title: string;
  targetType: ShareTargetType;
  targetId: string;
  /**
   * Verified share counts to render in the counter pill. Pass
   * `undefined` to suppress the pill; pass zero counts to render
   * a greyed "0" pill (per brief: "always show").
   */
  counts?: ShareCountsView;
  /**
   * Fired after the share intent ping (and before the new-tab
   * navigation completes). Caller uses this to open the verify-prompt
   * dialog. Receives the destination so the dialog copy can specialise.
   */
  onShareInitiated?: (destination: ShareDestination) => void;
  /**
   * Layout direction. Default 'horizontal' (the /feed pattern).
   * 'vertical' stacks counter on top, icons below — used by
   * `<NetworkCard>`'s RHS share column.
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * When true, the internal counter pill is suppressed so the caller
   * can render its own (`<ShareCountPill>`) and intersperse other
   * elements (e.g., a WhatsApp button between counter and icons).
   * Default false to preserve the existing inline counter.
   */
  hideCounter?: boolean;
}

interface SocialDestination {
  destination: ShareDestination;
  label: string;
  icon: ReactNode;
}

const SOCIAL_DESTINATIONS: ReadonlyArray<SocialDestination> = [
  {
    destination: 'x',
    label: 'Share on X',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    destination: 'instagram',
    label: 'Share on Instagram',
    icon: (
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    destination: 'facebook',
    label: 'Share on Facebook',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M13.5 22v-8.5h2.86l.43-3.32H13.5V8.06c0-.96.27-1.62 1.66-1.62h1.77V3.47A23.7 23.7 0 0 0 14.34 3.3c-2.56 0-4.31 1.56-4.31 4.43v2.45H7.16v3.32h2.87V22z" />
      </svg>
    ),
  },
];

export const ShareGroup: FC<ShareGroupProps> = ({
  url,
  title,
  targetType,
  targetId,
  counts,
  onShareInitiated,
  orientation = 'horizontal',
  hideCounter = false,
}) => {
  function makeClickHandler(destination: ShareDestination) {
    return function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
      event.stopPropagation();
      pingShareIntent({ targetType, targetId, destination });
      if (onShareInitiated) onShareInitiated(destination);
    };
  }

  const isVertical = orientation === 'vertical';

  return (
    <div
      data-testid="share-group"
      data-target-type={targetType}
      data-target-id={targetId}
      data-orientation={orientation}
      style={isVertical ? containerStyleVertical : containerStyle}
    >
      {counts !== undefined && !hideCounter && (
        <span
          data-testid="share-group-counter"
          data-count={counts.total}
          data-zero={counts.total === 0 ? 'true' : 'false'}
          title={`${counts.total} verified shares — whatsapp: ${counts.perDestination.whatsapp ?? 0}, x: ${counts.perDestination.x ?? 0}, instagram: ${counts.perDestination.instagram ?? 0}, facebook: ${counts.perDestination.facebook ?? 0}`}
          style={{ display: 'inline-flex' }}
        >
          <ShareCountPill counts={counts} targetId={targetId} />
        </span>
      )}
      <nav
        aria-label="Share on social media"
        data-testid="share-group-rail"
        style={isVertical ? railStyleVertical : railStyle}
      >
        {SOCIAL_DESTINATIONS.map(({ destination, label, icon }) => {
          const href = buildShareUrl(destination, { url, title }) ?? url;
          return (
            <a
              key={destination}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              onClick={makeClickHandler(destination)}
              data-testid="share-group-icon"
              data-destination={destination}
              style={iconStyle}
            >
              {icon}
            </a>
          );
        })}
      </nav>
    </div>
  );
};

// ── Analytics ping ───────────────────────────────────────────────────────

interface PingArgs {
  targetType: ShareTargetType;
  targetId: string;
  destination: ShareDestination;
  verified?: boolean;
}

/**
 * Fire-and-forget POST to the polymorphic share-intent endpoint.
 * sendBeacon-first so the request survives the new-tab navigation;
 * fetch+keepalive fallback for browsers without beacon. Errors are
 * swallowed — analytics is decorative, never blocks the share UX.
 * Exported for direct unit testing.
 */
export function pingShareIntent(args: PingArgs): void {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(args);
  const url = '/api/analytics/share-intent';
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }
  } catch {
    // Fall through to fetch.
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Analytics is fire-and-forget; never block the UX on a ping failure.
  });
}

// ── Styling ──────────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexShrink: 0,
};

const containerStyleVertical: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexShrink: 0,
};

const railStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexShrink: 0,
};

const railStyleVertical: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexShrink: 0,
};

const iconStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  color: 'var(--colour-text-secondary)',
  textDecoration: 'none',
  flexShrink: 0,
};
