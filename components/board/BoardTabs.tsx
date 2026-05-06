/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4e)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * BoardTabs — Active / Backlog / Done tab strip on the per-group
 * board pages. Pure presentational; the page passes the active tab
 * key. Uses Next.js Link so each tab is a real URL (deep-linkable).
 *
 * Icons come from the shared `BOARD_LANE_META` map so the tab strip
 * and the per-card lifecycle actions stay visually aligned (the same
 * Inbox icon you tap on a card to send to backlog is the same icon
 * sitting on the Backlog tab).
 */

import Link from 'next/link';
import { BOARD_LANE_META } from '@/components/board/lane-icons';

export type BoardTab = 'active' | 'backlog' | 'done';

interface BoardTabsProps {
  groupSlug: string;
  active: BoardTab;
}

const TABS: ReadonlyArray<BoardTab> = ['active', 'backlog', 'done'];

export function BoardTabs({ groupSlug, active }: BoardTabsProps) {
  return (
    <nav
      data-testid="board-tabs-strip"
      aria-label="Board view"
      style={{
        display: 'flex',
        gap: 'var(--space-1)',
        marginBottom: 'var(--space-4)',
        borderBottom: '1px solid var(--colour-border-subtle)',
      }}
    >
      {TABS.map((tab) => {
        const meta = BOARD_LANE_META[tab];
        const isActive = tab === active;
        const Icon = meta.icon;
        return (
          <Link
            key={tab}
            href={`/board/${groupSlug}${meta.href}`}
            data-testid="board-tabs-link"
            data-tab={tab}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-ui)',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--colour-text-primary)' : 'var(--colour-text-secondary)',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid var(--colour-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{meta.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
