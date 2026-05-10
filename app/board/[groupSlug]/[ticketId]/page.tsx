/**
 * @build-unit bu-coordination-board (build seq #5 — Surface 2, PR #5a, #5b, #5c, #5d.{1,2,4,5})
 *              · BU-ticket-detail-relayout (right-rail layout pass)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 * @spec docs/build/session-briefs/BU-ticket-detail-relayout.md
 * @adr 0013
 *
 * Ticket-detail page. Two-column layout per the BU-ticket-detail-relayout
 * design pass:
 *
 *   - Main column: title → editable description → discussion thread.
 *   - Right rail (304px on viewports >= 1024px): all meta-info in
 *     the locked Q1 order (Lifecycle → Assignees → Following →
 *     Shared-With → Originator/Created → Last activity → Header
 *     actions footer).
 *
 * Below 1024px the layout cascades to a single column; the rail
 * unstacks above the Discussion (Q3 — option C).
 *
 * Note compose is gated to the originating-team viewer (or sysadmin);
 * the read visibility filter is enforced server-side in the
 * commentThread.listForRequest procedure.
 *
 * Still to land: the system-event hook (atom 5d-3) — fires
 * Comment.source = 'system' rows on column moves and urgent flips,
 * gated on bu-kanban-event-config landing first.
 *
 * Gated by `coord_board_v1`. Flag-off → /feed (mirrors the kanban
 * grid). Unauthed → /dev/login. Group resolved by slug; ticket
 * resolved by id within the group's link scope. Either lookup
 * returning null → 404.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { EditableTicketTitle } from '@/components/board/EditableTicketTitle';
import { EditableTicketBody } from '@/components/board/EditableTicketBody';
import { Discussion } from '@/components/board/Discussion';
import { UrgentToggle } from '@/components/board/UrgentToggle';
import { TicketDetailRail } from '@/components/board/TicketDetailRail';

interface BoardTicketDetailPageProps {
  params: Promise<{ groupSlug: string; ticketId: string }>;
}

export const metadata = {
  title: 'Ticket — GPS Action',
};

export default async function BoardTicketDetailPage({ params }: BoardTicketDetailPageProps) {
  const flagEnabled = await isFeatureEnabled('coord_board_v1');
  if (!flagEnabled) {
    redirect('/feed');
  }

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect('/dev/login');
  }

  const { groupSlug, ticketId } = await params;
  const caller = createCaller(ctx);

  const accessibleGroup = await caller.groupKanban.bySlug({ slug: groupSlug });
  if (!accessibleGroup) {
    notFound();
  }

  let ticket;
  try {
    ticket = await caller.board.getTicket({
      requestId: ticketId,
      groupId: accessibleGroup.group.id,
    });
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') {
      // The ticket might genuinely not exist (true 404) OR the
      // viewer might have just lost access via unshare. Distinguish
      // the two before deciding 404 vs graceful redirect (Item 4 of
      // bu-ticket-view-fixes / Sub-build B). On access-loss we
      // navigate to this group's matching lifecycle list with a
      // toast hint in the query string.
      const accessCheck = await caller.share
        .checkAccessLoss({
          requestId: ticketId,
          groupId: accessibleGroup.group.id,
        })
        .catch(() => null);
      if (accessCheck && accessCheck.accessLost) {
        const lane =
          accessCheck.status === 'backlog'
            ? '/backlog'
            : accessCheck.status === 'done'
              ? '/done'
              : '';
        redirect(`/board/${groupSlug}${lane}?unshared=1`);
      }
      notFound();
    }
    throw err;
  }

  const viewerId = ctx.user.id;
  const isMineActive = ticket.assignees.some((a) => a.userId === viewerId);
  const isMineSubscribed = ticket.subscribers.some((s) => s.userId === viewerId);

  // Comment / Note thread (atom 5d-5). Note compose is gated to the
  // originating-team viewer or sysadmin; visibility filter for read
  // lives in the listForRequest service.
  const isSystemAdmin = ctx.activeRoles.includes('admin');
  // Item 13 (Sub-build B): the Delete affordance is visible only to
  // the originator or to a system admin. Server-side enforces the
  // same gate on the mutation; the UI gate just hides the button.
  const isOriginator = ticket.createdByUserId === viewerId;
  const canDelete = isOriginator || isSystemAdmin;
  const originatingGroup = ticket.groups.find((g) => g.origin === 'originating');
  const isOnOriginatingBoard = originatingGroup?.groupId === accessibleGroup.group.id;
  const canPostNote = isOnOriginatingBoard || isSystemAdmin;
  const [threadRows, activeColumns] = await Promise.all([
    caller.commentThread.listForRequest({
      requestId: ticket.id,
      viewerGroupId: accessibleGroup.group.id,
    }),
    caller.boardColumn.listForGroup({ groupId: accessibleGroup.group.id }),
  ]);

  // Where the card currently lives — captured for undo when the user
  // moves it via the lifecycle actions. The originating link is the
  // source of truth for column.
  const currentColumnId = originatingGroup?.columnId ?? null;
  const cardLifecycleStatus =
    ticket.status === 'active' || ticket.status === 'backlog' || ticket.status === 'done'
      ? ticket.status
      : null;

  // Share-with-team picker (atom 5e). Workflow allow-list targets minus
  // any group already linked. Service errors fall through silently —
  // the picker just renders with an empty target list and a disabled
  // button; the rest of the page stays usable.
  const workflowTargetsRaw = await caller.share
    .listWorkflowTargets({ sourceGroupId: accessibleGroup.group.id })
    .catch(() => []);
  const linkedGroupIds = new Set(ticket.groups.map((g) => g.groupId));
  const availableShareTargets = workflowTargetsRaw
    .map((t) => ({
      groupId: t.group.id,
      displayName: t.group.displayName,
      slug: t.group.slug,
    }))
    .filter((t) => !linkedGroupIds.has(t.groupId));

  return (
    <main
      data-testid="board-ticket-detail"
      style={{
        padding: 'var(--space-5) var(--space-4) var(--space-6)',
        margin: '0 auto',
        maxWidth: 1280,
      }}
    >
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <Link
          href={`/board/${groupSlug}`}
          data-testid="board-ticket-back"
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-link)',
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 'var(--space-2)',
          }}
        >
          ← {accessibleGroup.group.displayName} board
        </Link>
      </header>

      <div
        data-testid="board-ticket-detail-grid"
        className="ticket-detail-grid"
        style={{
          display: 'grid',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
      >
        <div
          data-testid="board-ticket-detail-main"
          className="ticket-detail-main"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            minWidth: 0,
          }}
        >
          <div data-testid="board-ticket-title-block">
            <EditableTicketTitle
              requestId={ticket.id}
              groupSlug={groupSlug}
              groupId={accessibleGroup.group.id}
              initial={ticket.title}
              urgent={ticket.urgency}
            />
            {ticket.kindDisplayName && (
              <p
                data-testid="board-ticket-kind"
                style={{
                  margin: 'var(--space-1) 0 0 0',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--colour-text-secondary)',
                }}
              >
                {ticket.kindDisplayName}
              </p>
            )}
            <div
              style={{
                marginTop: 'var(--space-2)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}
            >
              <UrgentToggle
                requestId={ticket.id}
                groupId={accessibleGroup.group.id}
                groupSlug={groupSlug}
                urgent={ticket.urgency}
              />
            </div>
          </div>

          <section data-testid="board-ticket-description" aria-label="Description">
            <h2
              style={{
                margin: '0 0 var(--space-2) 0',
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--colour-text-secondary)',
              }}
            >
              Description
            </h2>
            <EditableTicketBody
              requestId={ticket.id}
              groupSlug={groupSlug}
              groupId={accessibleGroup.group.id}
              initial={ticket.body}
            />
          </section>

          <div data-testid="board-ticket-discussion-slot" className="ticket-detail-discussion">
            <Discussion
              rows={threadRows}
              requestId={ticket.id}
              groupSlug={groupSlug}
              viewerId={viewerId}
              canPostNote={canPostNote}
            />
          </div>
        </div>

        <div data-testid="board-ticket-detail-rail-slot" className="ticket-detail-rail-slot">
          <TicketDetailRail
            requestId={ticket.id}
            groupSlug={groupSlug}
            groupId={accessibleGroup.group.id}
            cardLifecycleStatus={cardLifecycleStatus}
            currentColumnId={currentColumnId}
            activeColumns={activeColumns.map((c) => ({
              id: c.id,
              displayName: c.displayName,
            }))}
            assignees={ticket.assignees.map((a) => ({
              userId: a.userId,
              displayName: a.displayName,
              avatarUrl: a.avatarUrl,
            }))}
            isMineActive={isMineActive}
            isMineSubscribed={isMineSubscribed}
            sharedGroups={ticket.groups.map((g) => ({
              groupId: g.groupId,
              slug: g.slug,
              displayName: g.displayName,
              origin: g.origin,
            }))}
            availableShareTargets={availableShareTargets}
            viewerIsOriginator={isOriginator}
            createdAt={ticket.createdAt}
            lastActivityAt={ticket.lastActivityAt}
            canDelete={canDelete}
          />
        </div>
      </div>
    </main>
  );
}
