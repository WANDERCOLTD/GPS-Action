'use client';

/**
 * @build-unit bu-coordination-board (build seq #6 — Surface 3, PR #6)
 * @spec build/session-briefs/bu-coordination-board.md
 * @spec product/scenarios.md (SCN-34)
 *
 * Single row in the Notifications pane. Tinted background when the
 * row is unacknowledged (`lifecycle = new`); plain surface-raised
 * otherwise. Clicking the row fires the acknowledge action and
 * navigates to the source ticket. The acknowledge runs fire-and-
 * forget — page revalidation refreshes the row state on return.
 *
 * No separate "mark read" gesture; opening = acknowledging
 * (per the brief and SCN-34).
 */

import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { NotificationReasonKind, NotificationType } from '@prisma/client';
import { UserAvatar } from '@/components/UserAvatar';
import { acknowledgeNotificationAction } from '@/app/notifications/actions';

export interface NotificationRowData {
  readonly id: string;
  readonly reasonKind: NotificationReasonKind | null;
  readonly type: NotificationType;
  readonly lifecycle: 'new' | 'acknowledged' | 'dismissed';
  readonly fromUserId: string | null;
  readonly fromDisplayName: string | null;
  readonly requestId: string | null;
  readonly requestTitle: string | null;
  readonly message: string | null;
  readonly createdAt: string;
  readonly targetHref: string | null;
}

interface NotificationRowProps {
  readonly notification: NotificationRowData;
}

/**
 * Build a one-line sentence describing what the notification is about.
 * Prefers `reasonKind` (kanban-era) and falls back to `type` (legacy).
 * The actor name is rendered separately as the leading bold span; this
 * function returns the verb half. Quoted ticket title appended when
 * available.
 */
function describe(n: NotificationRowData): string {
  const verb = verbFor(n);
  const title = n.requestTitle;
  return title ? `${verb} "${title}"` : verb;
}

function verbFor(n: NotificationRowData): string {
  switch (n.reasonKind) {
    case 'comment':
      return 'commented on';
    case 'mention':
      return 'mentioned you on';
    case 'assignment':
      return 'was assigned to';
    case 'status_change':
      return 'moved';
    case 'urgent_flip':
      return 'flagged as urgent';
    case 'team_blast':
      return 'sent a team-wide notice about';
    case null:
      return verbForLegacyType(n.type);
  }
}

function verbForLegacyType(type: NotificationType): string {
  switch (type) {
    case 'request_mention':
      return 'mentioned you on';
    case 'request_status_changed':
      return 'updated';
    case 'request_resolved':
      return 'resolved';
    case 'request_published':
      return 'published';
    case 'request_archived':
      return 'archived';
  }
}

const rowBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--colour-border-subtle)',
  textDecoration: 'none',
  color: 'inherit',
  fontFamily: 'var(--font-ui)',
};

export function NotificationRow({ notification }: NotificationRowProps) {
  const isNew = notification.lifecycle === 'new';
  const href = notification.targetHref ?? '/notifications';

  function handleClick(_event: ReactMouseEvent<HTMLAnchorElement>) {
    if (!isNew) return;
    // Fire and forget — let the link navigate; revalidation on return
    // will repaint this row as plain (lifecycle = acknowledged).
    void acknowledgeNotificationAction(notification.id);
  }

  const actorName = notification.fromDisplayName ?? 'Someone';
  const sentence = describe(notification);
  const stamp = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <Link
      href={href}
      onClick={handleClick}
      data-testid="notification-row"
      data-notification-id={notification.id}
      data-lifecycle={notification.lifecycle}
      aria-label={`${actorName} ${sentence}`}
      style={{
        ...rowBaseStyle,
        background: isNew ? 'var(--colour-primary-subtle)' : 'var(--colour-surface-raised)',
      }}
    >
      {notification.fromUserId && notification.fromDisplayName ? (
        <UserAvatar
          userId={notification.fromUserId}
          displayName={notification.fromDisplayName}
          size={36}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--colour-surface-sunken)',
            flexShrink: 0,
          }}
        />
      )}

      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--colour-text-primary)',
          lineHeight: 'var(--line-normal)',
        }}
      >
        <strong>{actorName}</strong> {sentence}
      </span>

      <span
        data-testid="notification-row-timestamp"
        style={{
          flexShrink: 0,
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-secondary)',
        }}
      >
        {stamp}
      </span>
    </Link>
  );
}
