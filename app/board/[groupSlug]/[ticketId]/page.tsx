/**
 * @build-unit bu-coordination-board (build seq #5 — Surface 2, PR #5a, #5b, #5c, #5d.{1,2,4,5})
 * @spec docs/build/session-briefs/bu-coordination-board.md
 * @adr 0013
 *
 * Ticket-detail page. Renders the typed title, kind label, urgent
 * dot, the unified Assign-me / Follow action pair, the assignee list,
 * the editable description, and the interleaved Comment + Note thread.
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
import { formatDistanceToNow } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { BoardActionPair } from '@/components/board/BoardActionPair';
import { EditableTicketTitle } from '@/components/board/EditableTicketTitle';
import { EditableTicketBody } from '@/components/board/EditableTicketBody';
import { CommentNoteThread } from '@/components/board/CommentNoteThread';
import { UrgentToggle } from '@/components/board/UrgentToggle';
import { CardLifecycleActions } from '@/components/board/CardLifecycleActions';
import { ShareWithTeamButton } from '@/components/board/ShareWithTeamButton';

interface BoardTicketDetailPageProps {
  params: Promise<{ groupSlug: string; ticketId: string }>;
}

export const metadata = {
  title: 'Ticket — GPS Action',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

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
        maxWidth: 720,
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
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <BoardActionPair
          requestId={ticket.id}
          groupSlug={groupSlug}
          assigned={isMineActive}
          following={isMineSubscribed}
        />
        <UrgentToggle
          requestId={ticket.id}
          groupId={accessibleGroup.group.id}
          groupSlug={groupSlug}
          urgent={ticket.urgency}
        />
        {cardLifecycleStatus && (
          <CardLifecycleActions
            requestId={ticket.id}
            groupId={accessibleGroup.group.id}
            groupSlug={groupSlug}
            status={cardLifecycleStatus}
            currentColumnId={currentColumnId}
            activeColumns={activeColumns.map((c) => ({ id: c.id, displayName: c.displayName }))}
            variant="surface-2"
          />
        )}
      </div>

      <section
        data-testid="board-ticket-assignees"
        aria-label="Assignees"
        style={{
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3)',
          background: 'var(--colour-surface-sunken)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <h2
          style={{
            margin: '0 0 var(--space-2) 0',
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--colour-text-secondary)',
          }}
        >
          Assignees
        </h2>
        {ticket.assignees.length === 0 ? (
          <p
            data-testid="board-ticket-assignees-empty"
            style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--colour-text-secondary)',
            }}
          >
            No one is assigned yet.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            {ticket.assignees.map((a) => (
              <li
                key={a.userId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '4px 10px 4px 4px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--colour-surface-raised)',
                  border: '1px solid var(--colour-border-subtle)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span
                  title={a.displayName}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: a.avatarUrl
                      ? `center / cover no-repeat url(${a.avatarUrl})`
                      : 'var(--colour-surface-sunken)',
                    color: 'var(--colour-text-secondary)',
                    fontSize: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--colour-border-subtle)',
                  }}
                >
                  {a.avatarUrl ? '' : initials(a.displayName)}
                </span>
                {a.displayName}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        data-testid="board-ticket-shared-with"
        aria-label="Shared with"
        style={{
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3)',
          background: 'var(--colour-surface-sunken)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <h2
          style={{
            margin: '0 0 var(--space-2) 0',
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--colour-text-secondary)',
          }}
        >
          Shared with
        </h2>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <ul
            data-testid="board-ticket-shared-with-list"
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            {ticket.groups.map((g) => (
              <li
                key={g.groupId}
                data-testid="board-ticket-shared-with-pill"
                data-origin={g.origin}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--colour-surface-raised)',
                  border: '1px solid var(--colour-border-subtle)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {g.displayName}
                {g.origin === 'originating' && (
                  <span
                    style={{
                      marginLeft: 'var(--space-1)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--colour-text-secondary)',
                    }}
                  >
                    · originating
                  </span>
                )}
              </li>
            ))}
          </ul>
          <ShareWithTeamButton
            requestId={ticket.id}
            groupSlug={groupSlug}
            sourceGroupId={accessibleGroup.group.id}
            availableTargets={availableShareTargets}
          />
        </div>
      </section>

      <section
        data-testid="board-ticket-description"
        aria-label="Description"
        style={{
          marginBottom: 'var(--space-4)',
        }}
      >
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

      <CommentNoteThread
        rows={threadRows}
        requestId={ticket.id}
        groupSlug={groupSlug}
        canPostNote={canPostNote}
      />

      <footer
        data-testid="board-ticket-meta"
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-secondary)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--colour-border-subtle)',
        }}
      >
        Last activity {formatDistanceToNow(ticket.lastActivityAt, { addSuffix: true })}
      </footer>
    </main>
  );
}
