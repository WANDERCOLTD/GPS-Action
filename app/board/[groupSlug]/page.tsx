/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4d)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Per-group kanban board view (Active tab). Renders the column set for
 * the group + cards joined to columns via per-link state. Backlog and
 * Done tabs ship in PR #4e.
 *
 * Gated by `coord_board_v1`. Flag-off → /feed (mirrors the picker page).
 * Unauthed → /dev/login. Group resolved by slug; null result → 404.
 */

import { notFound, redirect } from 'next/navigation';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { BoardGrid, type CardsByColumn } from '@/components/board/BoardGrid';
import { BoardTabs } from '@/components/board/BoardTabs';
import { BoardBackLink } from '@/components/board/BoardBackLink';

interface BoardGroupPageProps {
  params: Promise<{ groupSlug: string }>;
}

export const metadata = {
  title: 'Board — GPS Action',
};

export default async function BoardGroupPage({ params }: BoardGroupPageProps) {
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

  const [columns, cards] = await Promise.all([
    caller.boardColumn.listForGroup({ groupId: accessibleGroup.group.id }),
    caller.board.listCards({ groupId: accessibleGroup.group.id }),
  ]);

  // Group cards by columnId for the visual grid. Active cards always
  // have columnId set (service contract); the null guard is defensive.
  // Plain object so the map serialises across the server→client boundary.
  const cardsByColumn: CardsByColumn = {};
  for (const card of cards) {
    if (card.columnId === null) continue;
    const list = cardsByColumn[card.columnId] ?? [];
    list.push({
      id: card.id,
      title: card.title,
      kindDisplayName: card.kindDisplayName,
      isUrgent: card.isUrgent,
      assignees: card.assignees,
      updatedAt: card.updatedAt,
    });
    cardsByColumn[card.columnId] = list;
  }

  return (
    <main
      style={{
        padding: 'var(--space-5) var(--space-4) var(--space-6)',
        margin: '0 auto',
        maxWidth: 1280,
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
      <BoardTabs groupSlug={groupSlug} active="active" />

      {columns.length === 0 ? (
        <p
          data-testid="board-view-no-columns"
          style={{
            padding: 'var(--space-5)',
            background: 'var(--colour-surface-sunken)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--colour-text-secondary)',
            textAlign: 'center',
          }}
        >
          This group has no columns yet. Group admins can configure them.
        </p>
      ) : (
        <BoardGrid
          groupSlug={groupSlug}
          groupId={accessibleGroup.group.id}
          columns={columns.map((c) => ({ id: c.id, displayName: c.displayName }))}
          cardsByColumn={cardsByColumn}
        />
      )}
    </main>
  );
}
