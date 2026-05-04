/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4a)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0006 0009 0011 0012
 *
 * Board service — drag-reorder + status transitions + position math
 * primitives for the kanban surface (Surface 1).
 *
 * Three concerns, one service:
 *
 *   1. Position math (pure): a Decimal between two siblings, padded by
 *      BOARD_POSITION_GAP when one side is open. Avoids renumbering on
 *      drag-reorder; future renumber pass tightens fractions.
 *   2. Card move: single primitive that handles drag-and-drop on either
 *      the originating group's board (writes Request.columnId/
 *      boardPosition + status, mirrors to the originating RequestGroup
 *      row) or a shared group's board (writes the shared RequestGroup
 *      row only, never touches Request.status).
 *   3. Status transitions: explicit setRequestStatus for off-drag
 *      gestures (e.g. "Mark abandoned"). Drag moves go through moveCard.
 *
 * Off-board lanes (backlog / done / abandoned) only make sense on the
 * originating group's board — Request.status is global, not per-link.
 * Shared-group moves to off-board lanes are rejected; caller routes the
 * status change through the originating board.
 *
 * Permission model: service is permission-agnostic, mirrors siblings.
 * Caller (router) gates with assertCanViewBoard / assertCanAdminBoard
 * from group-kanban.ts. Surface 1's permission table:
 *   - Move card between columns: any group member (own assignment) or
 *     any group admin / system admin (any card). Service trusts caller.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { Request, RequestGroup, RequestStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';

/**
 * Step between adjacent cards when one side has no constraint. Powers of
 * two keep midpoint divisions exact in Decimal arithmetic for many
 * inserts before fractional precision matters.
 */
export const BOARD_POSITION_GAP = 1024;

export type BoardLane = 'active' | 'backlog' | 'done' | 'abandoned';

export type MoveDestination =
  | { lane: 'active'; columnId: string }
  | { lane: 'backlog' | 'done' | 'abandoned' };

export interface MoveCardInput {
  requestId: string;
  /** The group whose board the user is acting on. */
  groupId: string;
  /** Where the card is being dropped. */
  destination: MoveDestination;
  /**
   * Sibling immediately above the drop point in the destination lane.
   * Null / omitted when dropped at top (or destination is empty).
   */
  beforeRequestId?: string | null;
  /**
   * Sibling immediately below the drop point in the destination lane.
   * Null / omitted when dropped at bottom (or destination is empty).
   */
  afterRequestId?: string | null;
  actorId: string;
}

export interface MoveCardResult {
  request: Request;
  /** RequestGroup row that was touched (originating mirror or shared link). */
  requestGroup: RequestGroup;
  /** True when the move targeted the originating group; status changed. */
  isOriginating: boolean;
  /** Status after the move. Unchanged for shared-group moves. */
  status: RequestStatus;
}

export interface SetStatusInput {
  requestId: string;
  status: RequestStatus;
  actorId: string;
}

export type BoardErrorKind =
  | 'request_not_found'
  | 'group_link_not_found'
  | 'column_not_in_group'
  | 'shared_off_board_forbidden';

export class BoardError extends Error {
  constructor(
    public readonly kind: BoardErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'BoardError';
  }
}

/**
 * Pure position math. Returns a Decimal strictly between `before` and
 * `after`, or padded by BOARD_POSITION_GAP when one side is open.
 *
 *   positionBetween(null, null) → 0
 *   positionBetween(null, X)    → X - GAP
 *   positionBetween(X, null)    → X + GAP
 *   positionBetween(A, B)       → (A + B) / 2
 *
 * Caller is responsible for tightening positions via a future renumber
 * pass when fractional precision degrades. No renumber here — drag-
 * reorder must not write neighbour rows.
 */
export function positionBetween(
  before: Prisma.Decimal | null,
  after: Prisma.Decimal | null,
): Prisma.Decimal {
  if (before === null && after === null) return new Prisma.Decimal(0);
  if (before === null) return (after as Prisma.Decimal).minus(BOARD_POSITION_GAP);
  if (after === null) return before.plus(BOARD_POSITION_GAP);
  return before.plus(after).div(2);
}

function toDecimal(value: Prisma.Decimal | number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

function laneToStatus(lane: BoardLane): RequestStatus {
  switch (lane) {
    case 'active':
      return 'active';
    case 'backlog':
      return 'backlog';
    case 'done':
      return 'done';
    case 'abandoned':
      return 'abandoned';
  }
}

/**
 * Move a card on a board. Behaviour depends on whether `groupId` is the
 * Request's originating group:
 *
 *   - Originating: writes Request.columnId, Request.boardPosition,
 *     Request.status. Mirrors to the originating RequestGroup row so the
 *     two stay in sync (per the schema invariant in ADR-0009).
 *   - Shared: writes the shared RequestGroup row's columnId +
 *     boardPosition. Request.status is untouched — Request.status is
 *     global, per-link state lives on RequestGroup.
 *
 * Off-board lanes (backlog / done / abandoned) are originating-only.
 * Shared-group moves with `lane !== 'active'` throw
 * BoardError('shared_off_board_forbidden').
 *
 * Sibling positions: when before/afterRequestId are supplied, the
 * service looks up their positions on the appropriate row (Request for
 * originating, RequestGroup for shared) and computes a midpoint. Caller
 * is responsible for passing siblings that share the destination lane —
 * no validation here.
 */
export async function moveCard(input: MoveCardInput): Promise<MoveCardResult> {
  const request = await prisma.request.findUnique({
    where: { id: input.requestId },
    select: { id: true, columnId: true, status: true, boardPosition: true },
  });
  if (!request) {
    throw new BoardError('request_not_found', `Request ${input.requestId} not found`);
  }

  const link = await prisma.requestGroup.findUnique({
    where: { requestId_groupId: { requestId: input.requestId, groupId: input.groupId } },
    select: {
      id: true,
      origin: true,
      columnId: true,
      boardPosition: true,
      deletedAt: true,
    },
  });
  if (!link || link.deletedAt !== null) {
    throw new BoardError(
      'group_link_not_found',
      `Request ${input.requestId} is not linked to group ${input.groupId}`,
    );
  }

  const isOriginating = link.origin === 'originating';

  if (!isOriginating && input.destination.lane !== 'active') {
    throw new BoardError(
      'shared_off_board_forbidden',
      `Cannot move a card to ${input.destination.lane} on a shared group; change status from the originating board`,
    );
  }

  const targetColumnId = input.destination.lane === 'active' ? input.destination.columnId : null;

  if (targetColumnId !== null) {
    const column = await prisma.boardColumn.findUnique({
      where: { id: targetColumnId },
      select: { groupId: true, deletedAt: true },
    });
    if (!column || column.deletedAt !== null || column.groupId !== input.groupId) {
      throw new BoardError(
        'column_not_in_group',
        `BoardColumn ${targetColumnId} does not belong to group ${input.groupId}`,
      );
    }
  }

  const [beforePosition, afterPosition] = await Promise.all([
    lookupSiblingPosition(input.beforeRequestId, isOriginating, input.groupId),
    lookupSiblingPosition(input.afterRequestId, isOriginating, input.groupId),
  ]);

  const newPosition = positionBetween(beforePosition, afterPosition);
  const newStatus = laneToStatus(input.destination.lane);

  if (isOriginating) {
    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.request.update({
        where: { id: input.requestId },
        data: {
          columnId: targetColumnId,
          boardPosition: newPosition,
          status: newStatus,
        },
      });
      const updatedLink = await tx.requestGroup.update({
        where: { id: link.id },
        data: {
          columnId: targetColumnId,
          boardPosition: newPosition,
        },
      });
      return { request: updatedRequest, requestGroup: updatedLink };
    });

    await auditLog({
      action: 'board_card_moved',
      entityType: 'Request',
      entityId: input.requestId,
      userId: input.actorId,
      changes: {
        columnId: { from: request.columnId, to: targetColumnId },
        status: { from: request.status, to: newStatus },
        boardPosition: {
          from: request.boardPosition?.toString() ?? null,
          to: newPosition.toString(),
        },
      },
      context: {
        groupId: input.groupId,
        lane: input.destination.lane,
        scope: 'originating',
      },
    });

    return {
      request: result.request,
      requestGroup: result.requestGroup,
      isOriginating: true,
      status: newStatus,
    };
  }

  const updatedLink = await prisma.requestGroup.update({
    where: { id: link.id },
    data: {
      columnId: targetColumnId,
      boardPosition: newPosition,
    },
  });

  // Re-read Request unchanged so the caller's return shape stays stable.
  const requestRow = await prisma.request.findUniqueOrThrow({
    where: { id: input.requestId },
  });

  await auditLog({
    action: 'board_card_moved',
    entityType: 'RequestGroup',
    entityId: updatedLink.id,
    userId: input.actorId,
    changes: {
      columnId: { from: link.columnId, to: targetColumnId },
      boardPosition: {
        from: link.boardPosition?.toString() ?? null,
        to: newPosition.toString(),
      },
    },
    context: {
      requestId: input.requestId,
      groupId: input.groupId,
      lane: input.destination.lane,
      scope: 'shared',
    },
  });

  return {
    request: requestRow,
    requestGroup: updatedLink,
    isOriginating: false,
    status: requestRow.status,
  };
}

async function lookupSiblingPosition(
  siblingRequestId: string | null | undefined,
  isOriginating: boolean,
  groupId: string,
): Promise<Prisma.Decimal | null> {
  if (!siblingRequestId) return null;

  if (isOriginating) {
    const row = await prisma.request.findUnique({
      where: { id: siblingRequestId },
      select: { boardPosition: true },
    });
    return toDecimal(row?.boardPosition ?? null);
  }

  const link = await prisma.requestGroup.findUnique({
    where: { requestId_groupId: { requestId: siblingRequestId, groupId } },
    select: { boardPosition: true },
  });
  return toDecimal(link?.boardPosition ?? null);
}

/**
 * Explicit status change. Used for off-drag gestures like "Mark
 * abandoned." Drag moves go through moveCard. Idempotent: returns the
 * row unchanged when status already matches; no audit, no churn.
 */
export async function setRequestStatus(input: SetStatusInput): Promise<Request> {
  const before = await prisma.request.findUnique({
    where: { id: input.requestId },
    select: { id: true, status: true },
  });
  if (!before) {
    throw new BoardError('request_not_found', `Request ${input.requestId} not found`);
  }
  if (before.status === input.status) {
    return prisma.request.findUniqueOrThrow({ where: { id: input.requestId } });
  }

  const updated = await prisma.request.update({
    where: { id: input.requestId },
    data: { status: input.status },
  });

  await auditLog({
    action: 'request_status_changed',
    entityType: 'Request',
    entityId: input.requestId,
    userId: input.actorId,
    changes: { status: { from: before.status, to: input.status } },
  });

  return updated;
}
