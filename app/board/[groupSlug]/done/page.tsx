/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4e)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Done tab — list-default archive of completed cards. Same shape as
 * Backlog: scoped to `Request.status = 'done'` and per-link
 * `columnId IS NULL`.
 */

import { notFound, redirect } from 'next/navigation';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { Card, type CardProps } from '@/components/board/Card';
import { BoardTabs } from '@/components/board/BoardTabs';
import { BoardBackLink } from '@/components/board/BoardBackLink';

interface BoardDonePageProps {
  params: Promise<{ groupSlug: string }>;
}

export const metadata = {
  title: 'Done — GPS Action',
};

export default async function BoardDonePage({ params }: BoardDonePageProps) {
  const flagEnabled = await isFeatureEnabled('coord_board_v1');
  if (!flagEnabled) {
    redirect('/feed');
  }

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect('/dev/login');
  }

  const { groupSlug } = await params;
  const caller = createCaller(ctx);

  const accessibleGroup = await caller.groupKanban.bySlug({ slug: groupSlug });
  if (!accessibleGroup) {
    notFound();
  }

  const [cards, columns] = await Promise.all([
    caller.board.listCards({
      groupId: accessibleGroup.group.id,
      status: 'done',
    }),
    caller.boardColumn.listForGroup({ groupId: accessibleGroup.group.id }),
  ]);

  const tickets: CardProps['ticket'][] = cards.map((card) => ({
    id: card.id,
    title: card.title,
    kindSlug: card.kindSlug,
    kindDisplayName: card.kindDisplayName,
    isUrgent: card.isUrgent,
    assignees: card.assignees,
    updatedAt: card.updatedAt,
  }));

  return (
    <main
      style={{
        padding: 'var(--space-5) var(--space-4) var(--space-6)',
        margin: '0 auto',
        maxWidth: 720,
      }}
    >
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <BoardBackLink />
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--text-xl)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {accessibleGroup.group.displayName}
        </h1>
      </header>
      <BoardTabs groupSlug={groupSlug} active="done" />
      {tickets.length === 0 ? (
        <p
          data-testid="board-done-empty"
          style={{
            padding: 'var(--space-5)',
            background: 'var(--colour-surface-sunken)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--colour-text-secondary)',
            textAlign: 'center',
          }}
        >
          No tickets are done yet.
        </p>
      ) : (
        <ul
          data-testid="board-done-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {tickets.map((ticket) => (
            <li key={ticket.id} style={{ margin: 0 }}>
              <Card
                groupSlug={groupSlug}
                ticket={ticket}
                lifecycle={{
                  status: 'done',
                  groupId: accessibleGroup.group.id,
                  currentColumnId: null,
                  activeColumns: columns.map((c) => ({ id: c.id, displayName: c.displayName })),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
