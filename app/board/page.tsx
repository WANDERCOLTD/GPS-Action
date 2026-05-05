/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4c)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * `/board` landing — the group-areas selector. Replaces the placeholder
 * that shipped in #192 with a list of every group the caller can open
 * a board for. Each card links to `/board/[slug]` (the kanban view,
 * built in PR #4d).
 *
 * Gated by the `coord_board_v1` feature flag. Flag-off redirects to
 * `/feed` (matches the placeholder's behaviour, which mirrors the
 * `/calendar` flag-off pattern).
 *
 * Unauthenticated users hit the dev-login redirect: there is no
 * gated landing for /board (members-only surface by design).
 */

import { redirect } from 'next/navigation';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import {
  BoardGroupPicker,
  type BoardGroupKind,
  type BoardGroupPickerItem,
} from '@/components/board/BoardGroupPicker';

export const metadata = {
  title: 'Board — GPS Action',
};

export default async function BoardPage() {
  const flagEnabled = await isFeatureEnabled('coord_board_v1');
  if (!flagEnabled) {
    redirect('/feed');
  }

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect('/dev/login');
  }

  const caller = createCaller(ctx);
  const accessible = await caller.groupKanban.listMine();

  const groups: BoardGroupPickerItem[] = accessible.map((row) => ({
    id: row.group.id,
    slug: row.group.slug,
    displayName: row.group.displayName,
    description: row.group.description,
    kind: row.group.kind as BoardGroupKind,
    colourKey: row.group.colourKey,
    logoUrl: row.group.logoUrl,
    isAdmin: row.access.canAdminBoard,
  }));

  return (
    <main
      style={{
        padding: 'var(--space-6) var(--space-4)',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          margin: 0,
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--text-xl)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        Coordination boards
      </h1>
      <p
        style={{
          margin: 0,
          marginBottom: 'var(--space-5)',
          color: 'var(--colour-text-secondary)',
          lineHeight: 1.5,
        }}
      >
        Open the board for any working group you belong to.
      </p>
      <BoardGroupPicker groups={groups} />
    </main>
  );
}
