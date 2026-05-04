/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4d)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * Column — a vertical stack of cards under a fixed header. Pure
 * presentational. Drag-drop wiring layers on later (PR #4 polish);
 * this PR ships the static grid.
 */

import type { CardProps } from '@/components/board/Card';
import { Card } from '@/components/board/Card';

export interface ColumnProps {
  columnId: string;
  displayName: string;
  groupSlug: string;
  tickets: CardProps['ticket'][];
}

export function Column({ columnId, displayName, groupSlug, tickets }: ColumnProps) {
  return (
    <section
      data-testid="board-column-card"
      data-column-id={columnId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        background: 'var(--colour-surface-sunken)',
        borderRadius: 'var(--radius-md)',
        minWidth: 280,
        flex: '0 0 280px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-2)',
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
          {displayName}
        </h2>
        <span
          data-testid="board-column-count"
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
          data-testid="board-column-empty"
          style={{
            margin: 0,
            padding: 'var(--space-3) 0',
            color: 'var(--colour-text-secondary)',
            fontSize: 'var(--text-sm)',
            textAlign: 'center',
          }}
        >
          No tickets in this column.
        </p>
      ) : (
        tickets.map((ticket) => <Card key={ticket.id} groupSlug={groupSlug} ticket={ticket} />)
      )}
    </section>
  );
}
