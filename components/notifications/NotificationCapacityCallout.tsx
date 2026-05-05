/**
 * @build-unit bu-coordination-board (build seq #6 — Surface 3, PR #6)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * Capacity callout under the Notifications pane. Shown when the inbox
 * query hit its display cap so the member knows there's more history
 * one tap away. The history page (`/notifications/history`) is not
 * shipped in this PR — the link target is a stub for the next slice.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';

interface NotificationCapacityCalloutProps {
  readonly shown: number;
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  background: 'var(--colour-surface-sunken)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
};

export function NotificationCapacityCallout({ shown }: NotificationCapacityCalloutProps) {
  return (
    <div data-testid="notification-capacity-callout" style={wrapperStyle}>
      <span>Showing {shown} most recent.</span>
      <Link
        href="/notifications/history"
        data-testid="notification-history-link"
        style={{
          color: 'var(--colour-text-link)',
          textDecoration: 'underline',
        }}
      >
        View all →
      </Link>
    </div>
  );
}
