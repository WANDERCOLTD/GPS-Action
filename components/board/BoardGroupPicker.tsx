/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4c)
 * @build-unit bu-group-identity (mounts <GroupBadge size="md" />)
 * @build-unit bu-board-gallery (2-up gallery layout — partial impl;
 *             snapshot-cache + filter chips + sort defer to the full BU)
 * @spec build/session-briefs/bu-coordination-board.md
 * @spec build/session-briefs/bu-group-identity.md
 * @spec build/session-briefs/bu-board-gallery.md
 * @spec docs/adrs/0013-group-colour-identity.md
 *
 * BoardGroupPicker — the `/board` landing page lists every working
 * group the caller can open a board for. Each tile links to
 * `/board/[slug]` (built in PR #4d). Empty state for callers who
 * aren't a member of any group.
 *
 * Pure presentational component: takes a flat array of items and
 * renders into a responsive 2-up grid (1-up < 720px, 2-up >= 720px,
 * via `.gps-board-gallery` in styles/components.css). Page owns the
 * data fetch + access flag mapping.
 */

import Link from 'next/link';
import { GroupBadge, type GroupBadgeColourKey } from '@/components/group/GroupBadge';

export type BoardGroupKind = 'workstream' | 'region' | 'network' | 'team' | 'topic';

export interface BoardGroupPickerItem {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  kind: BoardGroupKind;
  /** bu-group-identity — accent for the row's <GroupBadge />. */
  colourKey: GroupBadgeColourKey;
  /** Optional logo; the badge falls back to initials if null. */
  logoUrl: string | null;
  isAdmin: boolean;
}

interface BoardGroupPickerProps {
  groups: BoardGroupPickerItem[];
}

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
      className="gps-board-gallery"
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
    >
      {groups.map((group) => (
        <li key={group.id} style={{ margin: 0 }}>
          <Link
            href={`/board/${group.slug}`}
            data-testid="board-picker-card"
            data-group-slug={group.slug}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--colour-surface-raised)',
              border: '1px solid var(--colour-border-subtle)',
              boxShadow: 'var(--shadow-sm)',
              textDecoration: 'none',
              color: 'inherit',
              height: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <GroupBadge
                group={{
                  displayName: group.displayName,
                  kind: group.kind,
                  colourKey: group.colourKey,
                  logoUrl: group.logoUrl,
                }}
                size="md"
                decorative
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 600,
                    fontSize: 'var(--text-md)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {group.displayName}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--colour-text-secondary)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <span>{KIND_LABEL[group.kind]}</span>
                  {group.isAdmin && (
                    <span
                      data-testid="board-picker-admin-badge"
                      style={{
                        padding: '0 var(--space-2)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--colour-primary-subtle)',
                        color: 'var(--colour-primary)',
                        fontWeight: 600,
                      }}
                    >
                      Admin
                    </span>
                  )}
                </div>
              </div>
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

const KIND_LABEL: Record<BoardGroupKind, string> = {
  workstream: 'Workstream',
  region: 'Region',
  network: 'Network',
  team: 'Team',
  topic: 'Topic',
};
