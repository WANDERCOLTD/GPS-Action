/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4d, drag-wiring follow-up)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * Column — a vertical stack of cards under a fixed header. Pure
 * presentational; the optional `dropRef` / `isOver` / `renderCard`
 * props are wired by `BoardGrid` to add drag-and-drop targeting
 * without coupling Column itself to dnd-kit.
 */

import { Fragment, type ReactNode } from 'react';
import type { CardProps } from '@/components/board/Card';
import { Card } from '@/components/board/Card';

export interface ColumnProps {
  columnId: string;
  displayName: string;
  groupSlug: string;
  tickets: CardProps['ticket'][];
  /** Custom card renderer. Defaults to the plain `<Card>`. */
  renderCard?: (ticket: CardProps['ticket']) => ReactNode;
  /** `setNodeRef` from `useDroppable` so this column can receive drops. */
  dropRef?: (el: HTMLElement | null) => void;
  /** True while a draggable is hovering this column. */
  isOver?: boolean;
}

export function Column({
  columnId,
  displayName,
  groupSlug,
  tickets,
  renderCard,
  dropRef,
  isOver,
}: ColumnProps) {
  return (
    <section
      ref={dropRef}
      data-testid="board-column-card"
      data-column-id={columnId}
      data-drop-over={isOver ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        background: isOver
          ? 'color-mix(in srgb, var(--colour-primary) 8%, var(--colour-surface-sunken))'
          : 'var(--colour-surface-sunken)',
        borderRadius: 'var(--radius-md)',
        minWidth: 280,
        flex: '0 0 280px',
        outline: isOver
          ? '2px dashed color-mix(in srgb, var(--colour-primary) 40%, transparent)'
          : '2px dashed transparent',
        outlineOffset: -2,
        transition: 'background 120ms, outline-color 120ms',
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
        tickets.map((ticket) =>
          renderCard ? (
            <Fragment key={ticket.id}>{renderCard(ticket)}</Fragment>
          ) : (
            <Card key={ticket.id} groupSlug={groupSlug} ticket={ticket} />
          ),
        )
      )}
    </section>
  );
}
