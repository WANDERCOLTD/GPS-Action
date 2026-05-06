/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4a + #4d; #5a + #5c — Surface 2 read + edit)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0006 0009 0011 0012 0013
 *
 * Board service — drag-reorder + status transitions + position math
 * + read query for the kanban surface (Surface 1).
 *
 * Four concerns, one service:
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
 *   4. Read query (PR #4d): listBoardCardsForGroup returns cards in a
 *      group's active set, joined to assignees + kind. Per-link state
 *      (column placement, isUrgent) lives on RequestGroup so the same
 *      Request can sit on different columns in different groups.
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
import { emitKanbanSystemEvent } from '@/server/services/kanban-system-events';

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

    if (targetColumnId !== null && targetColumnId !== request.columnId) {
      await emitKanbanSystemEvent({
        requestId: input.requestId,
        actorId: input.actorId,
        event: { kind: 'column_move', newColumnId: targetColumnId },
      });
    }
    if (newStatus !== request.status) {
      await emitKanbanSystemEvent({
        requestId: input.requestId,
        actorId: input.actorId,
        event: { kind: 'status_change', newStatus },
      });
    }

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

  if (targetColumnId !== null && targetColumnId !== link.columnId) {
    await emitKanbanSystemEvent({
      requestId: input.requestId,
      actorId: input.actorId,
      event: { kind: 'column_move', newColumnId: targetColumnId },
    });
  }

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

  await emitKanbanSystemEvent({
    requestId: input.requestId,
    actorId: input.actorId,
    event: { kind: 'status_change', newStatus: input.status },
  });

  return updated;
}

export interface SetUrgencyInput {
  requestId: string;
  urgent: boolean;
  actorId: string;
}

/**
 * Toggle the global `Request.urgency` flag. Idempotent: returns the
 * existing row unchanged when the flag already matches; no audit, no
 * system event. On change writes an audit row and emits the matching
 * system event (`urgent_on` or `urgent_off`), gated by the admin
 * toggle in `kanban-event-config`.
 *
 * Per-link urgency (`RequestGroup.isUrgent`) is independent and not
 * touched here — the brief calls `Request.urgency` the canonical
 * "this ticket is urgent" flag.
 */
export async function setRequestUrgency(input: SetUrgencyInput): Promise<Request> {
  const before = await prisma.request.findUnique({
    where: { id: input.requestId },
    select: { id: true, urgency: true },
  });
  if (!before) {
    throw new BoardError('request_not_found', `Request ${input.requestId} not found`);
  }
  if (before.urgency === input.urgent) {
    return prisma.request.findUniqueOrThrow({ where: { id: input.requestId } });
  }

  const updated = await prisma.request.update({
    where: { id: input.requestId },
    data: { urgency: input.urgent },
  });

  await auditLog({
    action: 'request_urgency_changed',
    entityType: 'Request',
    entityId: input.requestId,
    userId: input.actorId,
    changes: { urgency: { from: before.urgency, to: input.urgent } },
  });

  await emitKanbanSystemEvent({
    requestId: input.requestId,
    actorId: input.actorId,
    event: { kind: input.urgent ? 'urgent_on' : 'urgent_off' },
  });

  return updated;
}

// ─── Read query: cards on a group's board ───────────────────────────────────

export interface BoardCardAssignee {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface BoardCard {
  /** Request.id — primary identifier; routes use this for ticket detail. */
  id: string;
  /**
   * Display title. Read from typed `Request.title` (ADR-0013 / D079).
   * The DB-level sentinel default ('(Untitled)') keeps NOT NULL safe
   * for any rows that slipped past the back-fill, so no runtime
   * fallback is needed here.
   */
  title: string;
  kindSlug: string | null;
  kindDisplayName: string | null;
  /** Per-link urgency (RequestGroup.isUrgent). Independent of the global Request.urgency flag. */
  isUrgent: boolean;
  /** Global Request.status. Same value across every group's view. */
  status: RequestStatus;
  /**
   * Per-link column placement (RequestGroup.columnId). Non-null on the
   * Active tab; null on Backlog / Done lists (off-board lanes).
   */
  columnId: string | null;
  /** Per-link board position as a string for client serialisation safety. */
  boardPosition: string;
  /** Active assignees, ordered oldest assignment first (visual stability). */
  assignees: BoardCardAssignee[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ListBoardCardsOptions {
  /**
   * Filter cards by global Request.status. Defaults to 'active' (the
   * Active tab). 'backlog' / 'done' / 'abandoned' return off-board cards
   * for the same group; PR #4e adds the Backlog and Done list pages.
   */
  status?: RequestStatus;
}

/**
 * Read cards for a group's board, scoped to a status (Active tab by
 * default). Includes both originating cards and cards shared into this
 * group from other groups.
 *
 * Joins via RequestGroup so the per-link state (`columnId`,
 * `boardPosition`, `isUrgent`) drives the view — for the originating
 * group these mirror Request, for shared groups they're independent.
 *
 * Filters:
 *   - RequestGroup.deletedAt IS NULL (link is active).
 *   - When status='active': RequestGroup.columnId IS NOT NULL (card
 *     placed on a column).
 *   - When status='backlog' | 'done' | 'abandoned': RequestGroup.columnId
 *     IS NULL (card is off-board).
 *   - Request.deletedAt IS NULL (request not soft-deleted).
 *   - Request.status === <status> (filter passed in or default 'active').
 *
 * Sort:
 *   - Active: by columnId then boardPosition asc (caller groups by
 *     columnId to render columns).
 *   - Off-board: by boardPosition asc, then createdAt asc tie-break.
 */
export async function listBoardCardsForGroup(
  groupId: string,
  options: ListBoardCardsOptions = {},
): Promise<BoardCard[]> {
  const status = options.status ?? 'active';
  const isActive = status === 'active';
  const rows = await prisma.requestGroup.findMany({
    where: {
      groupId,
      deletedAt: null,
      columnId: isActive ? { not: null } : null,
      request: {
        deletedAt: null,
        status,
      },
    },
    orderBy: isActive
      ? [{ columnId: 'asc' }, { boardPosition: 'asc' }]
      : [{ boardPosition: 'asc' }, { createdAt: 'asc' }],
    include: {
      request: {
        select: {
          id: true,
          status: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          kind: { select: { slug: true, displayName: true } },
          assignments: {
            where: { unassignedAt: null },
            orderBy: { assignedAt: 'asc' },
            select: {
              user: { select: { id: true, displayName: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });

  return rows.map(
    (row): BoardCard => ({
      id: row.request.id,
      title: row.request.title,
      kindSlug: row.request.kind?.slug ?? null,
      kindDisplayName: row.request.kind?.displayName ?? null,
      isUrgent: row.isUrgent,
      status: row.request.status,
      columnId: row.columnId,
      boardPosition: (row.boardPosition ?? new Prisma.Decimal(0)).toString(),
      assignees: row.request.assignments.map((a) => ({
        userId: a.user.id,
        displayName: a.user.displayName,
        avatarUrl: a.user.avatarUrl,
      })),
      createdAt: row.request.createdAt,
      updatedAt: row.request.updatedAt,
    }),
  );
}

// ─── Read query: ticket detail (Surface 2 — PR #5a) ─────────────────────────

export interface TicketDetailAssignee {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  assignedAt: Date;
}

export interface TicketDetailSubscriber {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface TicketDetailGroupLink {
  groupId: string;
  slug: string;
  displayName: string;
  origin: 'originating' | 'workflow_share' | 'ad_hoc_share';
  /** Per-link urgency (RequestGroup.isUrgent). Independent of Request.urgency. */
  isUrgent: boolean;
  /** Per-link column placement (null when off-board for this link). */
  columnId: string | null;
}

export interface TicketDetail {
  id: string;
  /** Typed display title (ADR-0013 / D079). */
  title: string;
  /** Typed editable description. Null when no description has been written. */
  body: string | null;
  status: RequestStatus;
  /**
   * Global Request.urgency — the canonical "this ticket is urgent" flag.
   * Per-link urgency lives on each `groups[i].isUrgent`.
   */
  urgency: boolean;
  kindSlug: string | null;
  kindDisplayName: string | null;
  assignees: TicketDetailAssignee[];
  subscribers: TicketDetailSubscriber[];
  /**
   * Every active group link for this ticket. Includes the originating group
   * plus any teams it has been shared with. Soft-deleted links are excluded.
   * Stable order: originating first (by createdAt), then shares oldest-first.
   */
  groups: TicketDetailGroupLink[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GetTicketDetailInput {
  requestId: string;
  /**
   * The group whose board the viewer is acting on. The router must already
   * have asserted the viewer can see this group (via assertCanViewBoard).
   * The service additionally requires the ticket to be linked to this
   * group — so a member of group A cannot read a ticket that lives in
   * group B (no cross-group disclosure).
   */
  viewerGroupId: string;
}

/**
 * Read full detail for a single ticket, scoped to a viewer group.
 *
 * Returns null when:
 *   - The Request does not exist or is soft-deleted.
 *   - The Request is not linked to `viewerGroupId` (or the link is
 *     soft-deleted).
 *
 * The router converts null → NOT_FOUND. We avoid distinguishing "doesn't
 * exist" from "you can't see it" — the router has already established
 * the viewer can see the group; mismatching ticket-group binding is a
 * 404 from the viewer's perspective.
 */
export async function getTicketDetail(input: GetTicketDetailInput): Promise<TicketDetail | null> {
  const viewerLink = await prisma.requestGroup.findUnique({
    where: {
      requestId_groupId: {
        requestId: input.requestId,
        groupId: input.viewerGroupId,
      },
    },
    select: { id: true, deletedAt: true },
  });
  if (!viewerLink || viewerLink.deletedAt !== null) return null;

  const request = await prisma.request.findFirst({
    where: { id: input.requestId, deletedAt: null },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      urgency: true,
      createdAt: true,
      updatedAt: true,
      kind: { select: { slug: true, displayName: true } },
      assignments: {
        where: { unassignedAt: null },
        orderBy: { assignedAt: 'asc' },
        select: {
          assignedAt: true,
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      },
      subscriptions: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      },
      requestGroups: {
        where: { deletedAt: null },
        orderBy: [{ origin: 'asc' }, { createdAt: 'asc' }],
        select: {
          groupId: true,
          origin: true,
          isUrgent: true,
          columnId: true,
          group: { select: { slug: true, displayName: true } },
        },
      },
    },
  });
  if (!request) return null;

  return {
    id: request.id,
    title: request.title,
    body: request.body,
    status: request.status,
    urgency: request.urgency,
    kindSlug: request.kind?.slug ?? null,
    kindDisplayName: request.kind?.displayName ?? null,
    assignees: request.assignments.map((a) => ({
      userId: a.user.id,
      displayName: a.user.displayName,
      avatarUrl: a.user.avatarUrl,
      assignedAt: a.assignedAt,
    })),
    subscribers: request.subscriptions.map((s) => ({
      userId: s.user.id,
      displayName: s.user.displayName,
      avatarUrl: s.user.avatarUrl,
    })),
    groups: request.requestGroups.map((rg) => ({
      groupId: rg.groupId,
      slug: rg.group.slug,
      displayName: rg.group.displayName,
      origin: rg.origin,
      isUrgent: rg.isUrgent,
      columnId: rg.columnId,
    })),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

// ─── Edit ticket title / body (Surface 2 — PR #5c) ──────────────────────────

export const TICKET_TITLE_MAX_LENGTH = 200;
export const TICKET_BODY_MAX_LENGTH = 10000;

export type EditTicketErrorKind =
  | 'request_not_found'
  | 'group_link_not_found'
  | 'title_empty'
  | 'title_too_long'
  | 'body_too_long';

export class EditTicketError extends Error {
  constructor(
    public readonly kind: EditTicketErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'EditTicketError';
  }
}

interface EditTicketBaseInput {
  requestId: string;
  /**
   * The group whose board the editor is acting on. Service requires the
   * ticket to be linked to this group (active link); router has already
   * asserted the actor can view the group.
   */
  viewerGroupId: string;
  actorId: string;
}

export interface EditTicketTitleInput extends EditTicketBaseInput {
  title: string;
}

export interface EditTicketBodyInput extends EditTicketBaseInput {
  /** null → clear the description; non-null string → set it. Whitespace-only collapses to null. */
  body: string | null;
}

async function assertEditableTicket(input: EditTicketBaseInput): Promise<void> {
  const link = await prisma.requestGroup.findUnique({
    where: {
      requestId_groupId: {
        requestId: input.requestId,
        groupId: input.viewerGroupId,
      },
    },
    select: { id: true, deletedAt: true },
  });
  if (!link || link.deletedAt !== null) {
    throw new EditTicketError(
      'group_link_not_found',
      `Request ${input.requestId} is not linked to group ${input.viewerGroupId}`,
    );
  }
}

/**
 * Edit the typed `Request.title`. Permission is "any group member" per
 * the brief — caller is asserted to view the group at the router layer;
 * service additionally verifies the ticket is linked to that group.
 *
 * Idempotent: if the new title equals the existing title, returns the
 * unchanged Request without an audit row.
 */
export async function editTicketTitle(input: EditTicketTitleInput): Promise<Request> {
  const trimmed = input.title.trim();
  if (trimmed.length === 0) {
    throw new EditTicketError('title_empty', 'Title cannot be empty');
  }
  if (trimmed.length > TICKET_TITLE_MAX_LENGTH) {
    throw new EditTicketError(
      'title_too_long',
      `Title exceeds ${TICKET_TITLE_MAX_LENGTH} characters`,
    );
  }

  await assertEditableTicket(input);

  const before = await prisma.request.findFirst({
    where: { id: input.requestId, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!before) {
    throw new EditTicketError('request_not_found', `Request ${input.requestId} not found`);
  }
  if (before.title === trimmed) {
    return prisma.request.findUniqueOrThrow({ where: { id: input.requestId } });
  }

  const updated = await prisma.request.update({
    where: { id: input.requestId },
    data: { title: trimmed },
  });

  await auditLog({
    action: 'ticket_title_edited',
    entityType: 'Request',
    entityId: input.requestId,
    userId: input.actorId,
    changes: { title: { from: before.title, to: trimmed } },
    context: { groupId: input.viewerGroupId },
  });

  await emitKanbanSystemEvent({
    requestId: input.requestId,
    actorId: input.actorId,
    event: { kind: 'title_edit' },
  });

  return updated;
}

/**
 * Edit the typed `Request.body`. Permission identical to title edit.
 *
 * Whitespace-only input collapses to null (an empty description).
 * Idempotent on no-change.
 */
export async function editTicketBody(input: EditTicketBodyInput): Promise<Request> {
  const normalised: string | null =
    input.body === null ? null : input.body.trim() === '' ? null : input.body;

  if (normalised !== null && normalised.length > TICKET_BODY_MAX_LENGTH) {
    throw new EditTicketError('body_too_long', `Body exceeds ${TICKET_BODY_MAX_LENGTH} characters`);
  }

  await assertEditableTicket(input);

  const before = await prisma.request.findFirst({
    where: { id: input.requestId, deletedAt: null },
    select: { id: true, body: true },
  });
  if (!before) {
    throw new EditTicketError('request_not_found', `Request ${input.requestId} not found`);
  }
  if (before.body === normalised) {
    return prisma.request.findUniqueOrThrow({ where: { id: input.requestId } });
  }

  const updated = await prisma.request.update({
    where: { id: input.requestId },
    data: { body: normalised },
  });

  await auditLog({
    action: 'ticket_body_edited',
    entityType: 'Request',
    entityId: input.requestId,
    userId: input.actorId,
    changes: { body: { from: before.body, to: normalised } },
    context: { groupId: input.viewerGroupId },
  });

  await emitKanbanSystemEvent({
    requestId: input.requestId,
    actorId: input.actorId,
    event: { kind: 'body_edit' },
  });

  return updated;
}

// ─── Propose to backlog (Surface 1 — header `+ Propose` button) ─────────────

export type ProposeKanbanTicketErrorKind = 'title_empty' | 'title_too_long' | 'body_too_long';

export class ProposeKanbanTicketError extends Error {
  constructor(
    public readonly kind: ProposeKanbanTicketErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ProposeKanbanTicketError';
  }
}

export interface ProposeKanbanTicketInput {
  groupId: string;
  title: string;
  /** null → no description (matches the EditableTicketBody empty-state). */
  body: string | null;
  actorId: string;
}

export interface ProposeKanbanTicketResult {
  request: Request;
  requestGroup: RequestGroup;
}

/**
 * Create a kanban ticket in the group's backlog. Mirrors the seed
 * pattern (`scripts/seed.ts` — kanban seed block):
 *
 *   - Request.type = null (kanban tickets carry no legacy RequestType).
 *   - Request.status = 'backlog' — off-board until someone drags it
 *     onto a column.
 *   - Request.context = {} — kanban tickets have no per-type payload;
 *     authoritative display fields are `title` + `body`.
 *   - Request.columnId / boardPosition = null (off-board).
 *   - RequestGroup.origin = 'originating', no column placement, not urgent.
 *
 * Caller (router) gates "viewer can see this group" upstream. Author
 * is recorded on Request.createdByUserId AND RequestGroup.sharedByUserId,
 * matching the seed-pattern shape.
 *
 * Whitespace-only body collapses to null (same rule as `editTicketBody`).
 *
 * Audit row: `kanban_ticket_proposed` with the groupId + lengths.
 */
export async function proposeKanbanTicket(
  input: ProposeKanbanTicketInput,
): Promise<ProposeKanbanTicketResult> {
  const trimmedTitle = input.title.trim();
  if (trimmedTitle.length === 0) {
    throw new ProposeKanbanTicketError('title_empty', 'Title cannot be empty');
  }
  if (trimmedTitle.length > TICKET_TITLE_MAX_LENGTH) {
    throw new ProposeKanbanTicketError(
      'title_too_long',
      `Title exceeds ${TICKET_TITLE_MAX_LENGTH} characters`,
    );
  }

  const normalisedBody: string | null =
    input.body === null ? null : input.body.trim() === '' ? null : input.body;
  if (normalisedBody !== null && normalisedBody.length > TICKET_BODY_MAX_LENGTH) {
    throw new ProposeKanbanTicketError(
      'body_too_long',
      `Body exceeds ${TICKET_BODY_MAX_LENGTH} characters`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.request.create({
      data: {
        type: null,
        status: 'backlog',
        priority: 'normal',
        title: trimmedTitle,
        body: normalisedBody,
        context: {},
        urgency: false,
        columnId: null,
        boardPosition: null,
        createdByUserId: input.actorId,
      },
    });
    const requestGroup = await tx.requestGroup.create({
      data: {
        requestId: request.id,
        groupId: input.groupId,
        origin: 'originating',
        columnId: null,
        boardPosition: null,
        isUrgent: false,
        sharedByUserId: input.actorId,
      },
    });
    // Auto-subscribe author per Tier-2 default #4 ("Author + all
    // assignees + ever-mentioned"). Source = auto_author so the row
    // doesn't get clobbered by later auto-rules.
    await tx.requestSubscription.create({
      data: {
        requestId: request.id,
        userId: input.actorId,
        source: 'auto_author',
      },
    });
    return { request, requestGroup };
  });

  await auditLog({
    action: 'kanban_ticket_proposed',
    entityType: 'Request',
    entityId: result.request.id,
    userId: input.actorId,
    changes: {
      titleLength: trimmedTitle.length,
      bodyLength: normalisedBody?.length ?? 0,
    },
    context: { groupId: input.groupId },
  });

  return result;
}
