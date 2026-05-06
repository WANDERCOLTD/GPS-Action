/**
 * @build-unit bu-coordination-board (Surface 1 — Active list view, PR #7 atom B3)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 * @handoff docs/build/session-handoffs/bu-coordination-board-mobile-2026-05-06.md
 *
 * BoardList — flat vertical rendering of the Active tab's cards
 * grouped by column header. Used as the alternative to the column
 * grid when the user opts into list view from `BoardGrid`.
 *
 * Pure presentational. No drag wiring — column moves in list view
 * are out of scope (the toggle ships drag with grid view; users who
 * need to move a card switch back). Empty columns render their
 * header and a "no tickets" placeholder so the list reads at a
 * glance.
 */

import { Card, type CardProps } from '@/components/board/Card';
import type { CardsByColumn } from '@/components/board/computeMove';

export interface BoardListColumn {
  id: string;
  displayName: string;
}

export interface BoardListProps {
  groupSlug: string;
  columns: BoardListColumn[];
  cardsByColumn: CardsByColumn;
}

export function BoardList({ groupSlug, columns, cardsByColumn }: BoardListProps) {
  return (
    <div
      data-testid="board-view-list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      {columns.map((column) => {
        const tickets: CardProps['ticket'][] = cardsByColumn[column.id] ?? [];
        return (
          <section
            key={column.id}
            data-testid="board-list-section"
            data-column-id={column.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                paddingBottom: 'var(--space-1)',
                borderBottom: '1px solid var(--colour-border-subtle)',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 'var(--text-md)',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 600,
                }}
              >
                {column.displayName}
              </h2>
              <span
                data-testid="board-list-section-count"
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--colour-text-secondary)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {tickets.length}
              </span>
            </header>
            {tickets.length === 0 ? (
              <p
                data-testid="board-list-section-empty"
                style={{
                  margin: 0,
                  padding: 'var(--space-2) 0',
                  color: 'var(--colour-text-secondary)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                No tickets in this column.
              </p>
            ) : (
              <ul
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
                    <Card groupSlug={groupSlug} ticket={ticket} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
