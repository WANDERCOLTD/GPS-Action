'use client';

/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, drag-wiring follow-up)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Wraps the pure presentational `<Card>` with `useDraggable` so it
 * can be dragged across columns inside `BoardGrid`. The wrapper owns
 * the drag listeners; the inner `<Card>` keeps its `next/link` so a
 * plain click still navigates to the ticket detail route. Click-vs-
 * drag disambiguation is handled by `PointerSensor`'s 8-px activation
 * distance configured in `BoardGrid` — clicks under that threshold
 * never start a drag.
 */

import type { CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card, type CardProps } from '@/components/board/Card';

export interface DraggableCardProps {
  groupSlug: string;
  ticket: CardProps['ticket'];
}

export function DraggableCard({ groupSlug, ticket }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    data: { type: 'card', requestId: ticket.id },
  });

  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid="board-card-draggable"
      data-request-id={ticket.id}
      data-dragging={isDragging ? 'true' : 'false'}
    >
      <Card groupSlug={groupSlug} ticket={ticket} />
    </div>
  );
}
