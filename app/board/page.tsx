/**
 * @build-unit BU-coordination-board
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * `/board` placeholder route — coordination-board landing surface.
 * Reserved while the BU is still in `planned` status (Direction A —
 * kanban — settled, awaiting tech-review with Simon, Harry, Grant,
 * Paul, Leonid). Members reaching this URL while the flag is on see
 * a coming-soon panel; flag-off redirects to /feed.
 *
 * Gated by the `coord_board_v1` feature flag. Mirrors the
 * `/calendar` flag-off redirect pattern so the route is never
 * reachable without the AppNav tab also being visible.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isFeatureEnabled } from '@/server/services/flags';

export const metadata = {
  title: 'Board — GPS Action',
};

export default async function BoardPage() {
  const flagEnabled = await isFeatureEnabled('coord_board_v1');
  if (!flagEnabled) {
    redirect('/feed');
  }

  return (
    <main
      data-testid="board-placeholder"
      style={{
        padding: 'var(--space-6) var(--space-4)',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          margin: 0,
          marginBottom: 'var(--space-3)',
          fontSize: 'var(--text-xl)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        Coordination board
      </h1>
      <p
        style={{
          margin: 0,
          marginBottom: 'var(--space-4)',
          color: 'var(--colour-text-secondary)',
          lineHeight: 1.5,
        }}
      >
        Coming soon — a kanban view of every job each working group has on the go. Allocate to
        people, see what's stuck, and hand things across teams without losing track.
      </p>
      <p
        style={{
          margin: 0,
          marginBottom: 'var(--space-5)',
          color: 'var(--colour-text-secondary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        The brief is shaped; tech-review and prototype are next. For now this tab reserves the slot.
      </p>
      <Link
        href="/feed"
        data-testid="board-placeholder-back"
        style={{
          display: 'inline-block',
          padding: 'var(--space-2) var(--space-4)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--colour-surface-sunken)',
          color: 'var(--colour-text-link)',
          textDecoration: 'none',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        ← Back to feed
      </Link>
    </main>
  );
}
