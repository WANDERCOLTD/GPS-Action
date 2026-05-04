/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4e)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * BoardTabs — Active / Backlog / Done tab strip on the per-group
 * board pages. Pure presentational; the page passes the active tab
 * key. Uses Next.js Link so each tab is a real URL (deep-linkable).
 */

import Link from 'next/link';

export type BoardTab = 'active' | 'backlog' | 'done';

interface BoardTabsProps {
  groupSlug: string;
  active: BoardTab;
}

const TABS: Array<{ key: BoardTab; label: string; suffix: string }> = [
  { key: 'active', label: 'Active', suffix: '' },
  { key: 'backlog', label: 'Backlog', suffix: '/backlog' },
  { key: 'done', label: 'Done', suffix: '/done' },
];

export function BoardTabs({ groupSlug, active }: BoardTabsProps) {
  return (
    <nav
      data-testid="board-tabs-strip"
      aria-label="Board view"
      style={{
        display: 'flex',
        gap: 'var(--space-1)',
        marginBottom: 'var(--space-4)',
        borderBottom: '1px solid var(--colour-border)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/board/${groupSlug}${tab.suffix}`}
            data-testid="board-tabs-link"
            data-tab={tab.key}
            aria-current={isActive ? 'page' : undefined}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-ui)',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--colour-text-primary)' : 'var(--colour-text-secondary)',
              textDecoration: 'none',
              borderBottom: isActive
                ? '2px solid var(--colour-accent-strong)'
                : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
