/**
 * @build-unit BU-board-palette (replaces magnolia tile-wall background)
 * @spec docs/build/session-briefs/BU-board-palette.md
 *
 * Column — a vertical stack of cards under a fixed header. Pure
 * presentational; the optional `dropRef` / `isOver` / `renderCard`
 * props are wired by `BoardGrid` to add drag-and-drop targeting
 * without coupling Column itself to dnd-kit.
 *
 * Background uses the centralised position-keyed pastel palette
 * (`shared/styles/pastel-palette`) so the modal, the mobile tag-pill
 * and the column itself all stay in sync — and `/network` cards
 * (BU-network-feed) can drop-in adopt the same source of truth.
 */

import { Fragment, type ReactNode } from 'react';
import type { CardProps } from '@/components/board/Card';
import { Card } from '@/components/board/Card';
import { pastelTintByIndex } from '@/shared/styles/pastel-palette';

export interface ColumnProps {
  columnId: string;
  displayName: string;
  groupSlug: string;
  tickets: CardProps['ticket'][];
  /**
   * Position of this column in the group's column ordering. Drives
   * the pastel background lookup — index 0 is leftmost. Defaults to
   * 0 if omitted (single-column callers, list-view fallbacks).
   */
  positionIndex?: number;
  /** Custom card renderer. Defaults to the plain `<Card>`. */
  renderCard?: (ticket: CardProps['ticket']) => ReactNode;
  /** `setNodeRef` from `useDroppable` so this column can receive drops. */
  dropRef?: (el: HTMLElement | null) => void;
  /** True while a draggable is hovering this column. */
  isOver?: boolean;
  /** Rendered after the card list — typically a quick-add affordance. */
  footer?: ReactNode;
}

export function Column({
  columnId,
  displayName,
  groupSlug,
  tickets,
  positionIndex = 0,
  renderCard,
  dropRef,
  isOver,
  footer,
}: ColumnProps) {
  const tint = pastelTintByIndex(positionIndex);
  return (
    <section
      ref={dropRef}
      className="gps-board-column"
      data-testid="board-column-card"
      data-column-id={columnId}
      data-position-index={positionIndex}
      data-drop-over={isOver ? 'true' : 'false'}
      style={{
        // `isOver` overlays the primary-blue drop highlight on top of
        // the column's own pastel — mixing into the pastel (not into
        // surface-sunken) keeps the transition perceptible even when
        // the column is already on the primary tint (column 3).
        background: isOver ? `color-mix(in srgb, var(--colour-primary) 14%, ${tint})` : tint,
        outline: isOver ? '3px solid var(--colour-primary)' : '3px solid transparent',
        boxShadow: isOver
          ? '0 0 0 6px color-mix(in srgb, var(--colour-primary) 18%, transparent)'
          : 'none',
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
      {footer}
    </section>
  );
}
