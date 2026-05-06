/**
 * @build-unit bu-coord-board-share-allowlist-ui
 * @spec docs/build/session-briefs/bu-coord-board-share-allowlist-ui.md
 *
 * Group settings page — currently houses the Share-with-team allow-list
 * config. Group admin or sysadmin only; non-admins redirect to the board
 * view. Gated by `coord_board_v1` (mirrors the rest of the kanban
 * surface).
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { ShareAllowListSection } from './ShareAllowListSection';

interface BoardSettingsPageProps {
  params: Promise<{ groupSlug: string }>;
}

export const metadata = {
  title: 'Board settings — GPS Action',
};

export default async function BoardSettingsPage({ params }: BoardSettingsPageProps) {
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
    redirect('/board');
  }
  if (!accessibleGroup.access.canAdminBoard) {
    redirect(`/board/${groupSlug}`);
  }

  const [allowedTargets, addableTargets] = await Promise.all([
    caller.share.listWorkflowTargets({ sourceGroupId: accessibleGroup.group.id }),
    caller.share.listAddableTargets({ sourceGroupId: accessibleGroup.group.id }),
  ]);

  return (
    <main
      data-testid="board-settings"
      style={{
        padding: 'var(--space-5) var(--space-4) var(--space-6)',
        margin: '0 auto',
        maxWidth: 720,
      }}
    >
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <Link
          href={`/board/${groupSlug}`}
          data-testid="board-settings-back"
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
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--colour-text-primary)',
          }}
        >
          {accessibleGroup.group.displayName} — settings
        </h1>
      </header>

      <ShareAllowListSection
        sourceGroupId={accessibleGroup.group.id}
        groupSlug={groupSlug}
        allowedTargets={allowedTargets.map((t) => ({
          groupId: t.group.id,
          displayName: t.group.displayName,
          slug: t.group.slug,
          addedAt: t.workflow.createdAt.toISOString(),
        }))}
        addableTargets={addableTargets.map((g) => ({
          groupId: g.id,
          displayName: g.displayName,
          slug: g.slug,
        }))}
      />
    </main>
  );
}
