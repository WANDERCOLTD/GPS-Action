/**
 * @build-unit bu-coordination-board (build seq #6 — Surface 3, PR #6)
 * @spec build/session-briefs/bu-coordination-board.md
 * @spec product/scenarios.md (SCN-34)
 *
 * `/notifications` — Surface 3 of the coordination-board work. Lists
 * the viewer's kanban-era notifications newest-first. Tinted rows are
 * unacknowledged; plain rows are acknowledged. Clicking a row opens
 * the source ticket and auto-acknowledges in the background. Capped
 * at 50 visible rows; a `View all` link points at the (stubbed) full
 * history surface.
 *
 * Gated by the `coord_board_v1` flag — flag-off members never reach
 * this surface (the inbox glyph still routes them to `/requests`).
 */

import { redirect } from 'next/navigation';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import {
  NotificationRow,
  type NotificationRowData,
} from '@/components/notifications/NotificationRow';
import { NotificationCapacityCallout } from '@/components/notifications/NotificationCapacityCallout';
import { PageHeader } from '@/components/PageHeader';

export const metadata = {
  title: 'Notifications — GPS Action',
};

const PANE_LIMIT = 50;

export default async function NotificationsPage() {
  const flagEnabled = await isFeatureEnabled('coord_board_v1');
  if (!flagEnabled) {
    redirect('/feed');
  }

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect('/dev/login?returnTo=/notifications');
  }

  const caller = createCaller(ctx);
  const inbox = await caller.notificationKanban.inbox({
    scope: 'active',
    limit: PANE_LIMIT,
  });

  const rows: NotificationRowData[] = inbox.map((n) => ({
    id: n.id,
    reasonKind: n.reasonKind,
    type: n.type,
    lifecycle: n.lifecycle,
    fromUserId: n.fromUserId,
    fromDisplayName: n.fromDisplayName,
    requestId: n.requestId,
    requestTitle: n.requestTitle,
    message: n.message,
    createdAt: n.createdAt.toISOString(),
    targetHref: n.targetHref,
  }));

  const atCap = rows.length >= PANE_LIMIT;

  return (
    <>
      <PageHeader title="Notifications" description="Recent activity on your requests" />
      <main
        data-testid="notifications-page"
        style={{
          padding: 'var(--space-5) var(--space-4) var(--space-6)',
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {rows.length === 0 ? (
          <p
            data-testid="notifications-empty"
            style={{
              margin: 0,
              padding: 'var(--space-4) 0',
              color: 'var(--colour-text-secondary)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
            }}
          >
            No notifications yet.
          </p>
        ) : (
          <div
            data-testid="notifications-list"
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--colour-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            {rows.map((row) => (
              <NotificationRow key={row.id} notification={row} />
            ))}
          </div>
        )}

        {atCap && <NotificationCapacityCallout shown={rows.length} />}
      </main>
    </>
  );
}
