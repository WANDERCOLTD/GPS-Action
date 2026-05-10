/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4e)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Backlog tab — list-default view of off-board cards waiting for
 * placement on a column. Same data shape as the Active tab, scoped to
 * `Request.status = 'backlog'` and per-link `columnId IS NULL`.
 *
 * Render: vertical stack of Card components (no column grouping). Empty
 * state when no backlog cards exist.
 */

import { notFound, redirect } from 'next/navigation';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { type CardProps } from '@/components/board/Card';
import { BoardTabs } from '@/components/board/BoardTabs';
import { BoardBackLink } from '@/components/board/BoardBackLink';
import { BacklogList, BacklogEmpty } from '@/components/board/BacklogList';
import { UnsharedToast } from '@/components/board/UnsharedToast';

interface BoardBacklogPageProps {
  params: Promise<{ groupSlug: string }>;
}

export const metadata = {
  title: 'Backlog — GPS Action',
};

export default async function BoardBacklogPage({ params }: BoardBacklogPageProps) {
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
      status: 'backlog',
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
      <UnsharedToast />
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
      <BoardTabs groupSlug={groupSlug} active="backlog" />
      {tickets.length === 0 ? (
        <BacklogEmpty groupId={accessibleGroup.group.id} groupSlug={groupSlug} />
      ) : (
        <BacklogList
          groupSlug={groupSlug}
          groupId={accessibleGroup.group.id}
          tickets={tickets}
          activeColumns={columns.map((c) => ({ id: c.id, displayName: c.displayName }))}
        />
      )}
    </main>
  );
}
