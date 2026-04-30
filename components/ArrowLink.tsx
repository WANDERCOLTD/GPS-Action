'use client';

/**
 * @build-unit BU-feed-card-affordances
 * @spec build/session-briefs/bu-feed-card-affordances.md
 *
 * Shared inline-link component for the "← Back to X" / "X →" /
 * "Read post →" patterns scattered across the app. Industry-
 * standard hover treatment: text-link colour, no underline at rest,
 * underline on hover, arrow shifts 2px in the direction it points.
 * Focus-visible ring for keyboard users.
 *
 * Renders a real `<Link>` so iOS tap dispatch is native (the bug
 * this BU exists to fix on `<PostCard>`).
 *
 * Direction:
 *   - 'forward' — arrow on the right, shifts right on hover
 *   - 'back'    — arrow on the left, shifts left on hover
 *   - 'none'    — no arrow (plain text link)
 */

import Link from 'next/link';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export type ArrowLinkDirection = 'forward' | 'back' | 'none';
export type ArrowLinkSize = 'sm' | 'md';

interface ArrowLinkProps {
  readonly href: string;
  readonly direction?: ArrowLinkDirection;
  readonly size?: ArrowLinkSize;
  readonly children: ReactNode;
  /** Optional explicit testid suffix; defaults to `arrow-link`. */
  readonly testIdSuffix?: string;
  /** Optional explicit area prefix; defaults to whatever the parent context implies. */
  readonly testIdArea?: 'feed' | 'post' | 'requests' | 'data' | 'compose' | 'admin' | 'settings';
}

const ARROW_FORWARD = '→';
const ARROW_BACK = '←';

export function ArrowLink({
  href,
  direction = 'forward',
  size = 'sm',
  children,
  testIdSuffix,
  testIdArea,
}: ArrowLinkProps): ReactElement {
  const fontSize = size === 'sm' ? 'var(--text-sm)' : 'var(--text-md)';
  const testId = testIdArea
    ? `${testIdArea}-arrow-link${testIdSuffix ? `-${testIdSuffix}` : ''}`
    : `arrow-link${testIdSuffix ? `-${testIdSuffix}` : ''}`;

  return (
    <Link
      href={href}
      className="gps-arrow-link"
      data-testid={testId}
      data-direction={direction}
      style={{
        ...linkStyle,
        fontSize,
      }}
    >
      {direction === 'back' && (
        <span className="gps-arrow-link__arrow" aria-hidden="true" data-arrow="back">
          {ARROW_BACK}
        </span>
      )}
      <span>{children}</span>
      {direction === 'forward' && (
        <span className="gps-arrow-link__arrow" aria-hidden="true" data-arrow="forward">
          {ARROW_FORWARD}
        </span>
      )}
    </Link>
  );
}

const linkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  color: 'var(--colour-text-link)',
  textDecoration: 'none',
  fontWeight: 500,
  padding: 'var(--space-1) 0',
  minHeight: '32px', // tap-target floor; combined with the parent line-height the touch surface meets the 44px guideline most of the time
};
