/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4c)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * BoardGroupPicker — the `/board` landing page lists every working
 * group the caller can open a board for. Each row links to
 * `/board/[slug]` (built in PR #4d). Empty state for callers who
 * aren't a member of any group.
 *
 * Pure presentational component: takes a flat array of items and
 * renders. Page owns the data fetch + access flag mapping.
 */

import Link from 'next/link';

export type BoardGroupKind = 'workstream' | 'region' | 'network' | 'team' | 'topic';

export interface BoardGroupPickerItem {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  kind: BoardGroupKind;
  isAdmin: boolean;
}

interface BoardGroupPickerProps {
  groups: BoardGroupPickerItem[];
}

const KIND_LABEL: Record<BoardGroupKind, string> = {
  workstream: 'Workstream',
  region: 'Region',
  network: 'Network',
  team: 'Team',
  topic: 'Topic',
};

export function BoardGroupPicker({ groups }: BoardGroupPickerProps) {
  if (groups.length === 0) {
    return (
      <section
        data-testid="board-picker-empty"
        style={{
          padding: 'var(--space-5)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--colour-surface-sunken)',
          color: 'var(--colour-text-secondary)',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, marginBottom: 'var(--space-2)' }}>
          You&apos;re not a member of any working groups yet.
        </p>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
          Group admins can add you, or open a group with the join policy set to public.
        </p>
      </section>
    );
  }

  return (
    <ul
      data-testid="board-picker-list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        listStyle: 'none',
        margin: 0,
        padding: 0,
      }}
    >
      {groups.map((group) => (
        <li key={group.id} style={{ margin: 0 }}>
          <Link
            href={`/board/${group.slug}`}
            data-testid="board-picker-card"
            data-group-slug={group.slug}
            style={{
              display: 'block',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--colour-surface)',
              border: '1px solid var(--colour-border)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: group.description ? 'var(--space-2)' : 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 600,
                  fontSize: 'var(--text-md)',
                }}
              >
                {group.displayName}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--colour-text-secondary)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {KIND_LABEL[group.kind]}
              </span>
              {group.isAdmin && (
                <span
                  data-testid="board-picker-admin-badge"
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-ui)',
                    padding: '0 var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--colour-accent-subtle)',
                    color: 'var(--colour-accent-strong)',
                  }}
                >
                  Admin
                </span>
              )}
            </div>
            {group.description && (
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--colour-text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                {group.description}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
