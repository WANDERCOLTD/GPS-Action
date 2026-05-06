'use client';

/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, drag-wiring follow-up)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Client wrapper around the column grid that adds drag-and-drop:
 *
 *   - `DndContext` with a `PointerSensor` (8-px activation distance,
 *     so plain clicks on `<Card>` still navigate to the ticket route).
 *   - `useDroppable` per column (via `DroppableColumn`).
 *   - `useDraggable` per card (via `DraggableCard`).
 *   - Optimistic local state — the dropped card moves immediately;
 *     `moveCardAction` runs in a transition; on failure the previous
 *     map is restored and an inline error is shown.
 *
 * MVP scope: cross-column moves only. The dropped card lands at the
 * end of the target column. Within-column reorder + precise drop-
 * position computation are follow-up work.
 */

import { useEffect, useState, useTransition } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Card, type CardProps } from '@/components/board/Card';
import { Column } from '@/components/board/Column';
import { DraggableCard } from '@/components/board/DraggableCard';
import { computeMove, type CardsByColumn } from '@/components/board/computeMove';
import { moveCardAction } from '@/app/board/[groupSlug]/actions';

export type { CardsByColumn } from '@/components/board/computeMove';

export interface BoardGridColumn {
  id: string;
  displayName: string;
}

export interface BoardGridProps {
  groupSlug: string;
  groupId: string;
  columns: BoardGridColumn[];
  cardsByColumn: CardsByColumn;
}

function DroppableColumn(props: {
  columnId: string;
  displayName: string;
  groupSlug: string;
  tickets: CardProps['ticket'][];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: props.columnId,
    data: { type: 'column', columnId: props.columnId },
  });
  return (
    <Column
      columnId={props.columnId}
      displayName={props.displayName}
      groupSlug={props.groupSlug}
      tickets={props.tickets}
      dropRef={setNodeRef}
      isOver={isOver}
      renderCard={(t) => <DraggableCard groupSlug={props.groupSlug} ticket={t} />}
    />
  );
}

export function BoardGrid({ groupSlug, groupId, columns, cardsByColumn }: BoardGridProps) {
  const [optimistic, setOptimistic] = useState<CardsByColumn>(cardsByColumn);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // When the server revalidates the route after a successful move,
  // the page re-renders with fresh `cardsByColumn`; sync local state.
  useEffect(() => {
    setOptimistic(cardsByColumn);
  }, [cardsByColumn]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Look up the active card so DragOverlay can render a visible
  // floating copy. The source card stays in the column at reduced
  // opacity (DraggableCard.isDragging) so the layout doesn't shift.
  const activeCard: CardProps['ticket'] | null = activeId
    ? (Object.values(optimistic)
        .flat()
        .find((c) => c.id === activeId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setError(null);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const requestId = String(active.id);
    const targetColumnId = String(over.id);

    const move = computeMove(optimistic, requestId, targetColumnId);
    if (!move) return;

    const previous = optimistic;
    setOptimistic(move.next);
    setError(null);

    startTransition(async () => {
      const result = await moveCardAction({
        requestId,
        groupId,
        groupSlug,
        destination: { lane: 'active', columnId: targetColumnId },
        beforeRequestId: move.beforeRequestId,
        afterRequestId: move.afterRequestId,
      });
      if (!result.ok) {
        setOptimistic(previous);
        setError(result.error ?? 'Could not move the card — try again.');
      }
    });
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          data-testid="board-grid-error"
          style={{
            marginBottom: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            background: 'color-mix(in srgb, var(--colour-danger) 8%, transparent)',
            color: 'var(--colour-danger)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {error}
        </div>
      )}
      {/*
        Stable `id` makes dnd-kit's auto-generated `aria-describedby` (and
        the underlying useUniqueId counter in @dnd-kit/utilities) deterministic
        across server/client renders. Without it, React StrictMode double-mount
        in dev advances the global counter on the client past the server value
        and hydration warns. One DndContext per page = one stable id.
      */}
      <DndContext
        id={`board-${groupSlug}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className="gps-board-grid"
          data-testid="board-view-grid"
          data-pending={isPending ? 'true' : 'false'}
        >
          {columns.map((column) => (
            <DroppableColumn
              key={column.id}
              columnId={column.id}
              displayName={column.displayName}
              groupSlug={groupSlug}
              tickets={optimistic[column.id] ?? []}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeCard ? (
            <div
              data-testid="board-card-drag-overlay"
              style={{
                cursor: 'grabbing',
                transform: 'rotate(2deg)',
                boxShadow: 'var(--shadow-xl)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <Card groupSlug={groupSlug} ticket={activeCard} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
