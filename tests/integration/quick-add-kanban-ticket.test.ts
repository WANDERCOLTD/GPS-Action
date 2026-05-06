/**
 * Integration tests for quickAddKanbanTicket (Surface 1 — per-column quick-add).
 *
 * Asserts the in-column shape contract:
 *   - Request: type=null, status='active', columnId=X, boardPosition=Y,
 *     context={}, urgency=false.
 *   - RequestGroup: origin='originating', columnId=X, boardPosition=Y.
 *   - Subscription row written for the author with source='auto_author'.
 *   - Audit row written with action='kanban_ticket_quick_added'.
 *   - Position math: lands AFTER the current max in that column.
 *   - Validation: empty title rejected, oversize title rejected,
 *     column-not-in-group rejected.
 *
 * @build-unit bu-coordination-board
 * @spec docs/build/session-briefs/bu-coordination-board.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/server/db/client', () => {
  const tx = {
    request: { create: vi.fn() },
    requestGroup: { create: vi.fn() },
    requestSubscription: { create: vi.fn() },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      __tx: tx,
      boardColumn: { findUnique: vi.fn() },
      request: { findFirst: vi.fn() },
      auditLog: { create: vi.fn() },
    },
  };
});

import {
  quickAddKanbanTicket,
  BoardError,
  ProposeKanbanTicketError,
} from '@/server/services/board';
import { prisma } from '@/server/db/client';

const tx = (
  prisma as unknown as {
    __tx: {
      request: { create: ReturnType<typeof vi.fn> };
      requestGroup: { create: ReturnType<typeof vi.fn> };
      requestSubscription: { create: ReturnType<typeof vi.fn> };
    };
  }
).__tx;

const mockColumnFind = vi.mocked(prisma.boardColumn.findUnique);
const mockRequestFindFirst = vi.mocked(prisma.request.findFirst);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);

beforeEach(() => {
  vi.clearAllMocks();
  mockColumnFind.mockResolvedValue({ groupId: 'g-1', deletedAt: null } as never);
  mockRequestFindFirst.mockResolvedValue(null as never);
  mockAuditCreate.mockResolvedValue({} as never);
  tx.request.create.mockResolvedValue({
    id: 'r-new',
    title: 'Hello',
    status: 'active',
    columnId: 'c-rec',
  } as never);
  tx.requestGroup.create.mockResolvedValue({
    id: 'rg-new',
    requestId: 'r-new',
    groupId: 'g-1',
  } as never);
  tx.requestSubscription.create.mockResolvedValue({} as never);
});

describe('quickAddKanbanTicket — happy path', () => {
  it('writes Request with active status + the chosen column', async () => {
    await quickAddKanbanTicket({
      groupId: 'g-1',
      columnId: 'c-rec',
      title: '  Pitch the new banner  ',
      actorId: 'u-1',
    });

    expect(tx.request.create).toHaveBeenCalledOnce();
    const data = tx.request.create.mock.calls[0]![0]!.data;
    expect(data).toMatchObject({
      type: null,
      status: 'active',
      title: 'Pitch the new banner',
      body: null,
      context: {},
      urgency: false,
      columnId: 'c-rec',
      createdByUserId: 'u-1',
    });
    // boardPosition is a Prisma.Decimal — assert it's not null.
    expect(data.boardPosition).not.toBeNull();
  });

  it('writes RequestGroup with origin=originating and the same column placement', async () => {
    await quickAddKanbanTicket({
      groupId: 'g-1',
      columnId: 'c-rec',
      title: 'A ticket',
      actorId: 'u-1',
    });

    expect(tx.requestGroup.create).toHaveBeenCalledOnce();
    expect(tx.requestGroup.create.mock.calls[0]![0]!.data).toMatchObject({
      requestId: 'r-new',
      groupId: 'g-1',
      origin: 'originating',
      columnId: 'c-rec',
      isUrgent: false,
      sharedByUserId: 'u-1',
    });
  });

  it('places the new card AFTER the current tail of the column', async () => {
    mockRequestFindFirst.mockResolvedValueOnce({
      boardPosition: new Prisma.Decimal(100),
    } as never);

    await quickAddKanbanTicket({
      groupId: 'g-1',
      columnId: 'c-rec',
      title: 'Pitch',
      actorId: 'u-1',
    });

    const requestData = tx.request.create.mock.calls[0]![0]!.data;
    const groupData = tx.requestGroup.create.mock.calls[0]![0]!.data;
    // Tail was 100, GAP-padded → new position > 100.
    expect((requestData.boardPosition as Prisma.Decimal).greaterThan(100)).toBe(true);
    expect(
      (requestData.boardPosition as Prisma.Decimal).equals(
        groupData.boardPosition as Prisma.Decimal,
      ),
    ).toBe(true);
  });

  it('auto-subscribes the author with source=auto_author', async () => {
    await quickAddKanbanTicket({
      groupId: 'g-1',
      columnId: 'c-rec',
      title: 'A ticket',
      actorId: 'u-1',
    });

    expect(tx.requestSubscription.create).toHaveBeenCalledOnce();
    expect(tx.requestSubscription.create.mock.calls[0]![0]!.data).toEqual({
      requestId: 'r-new',
      userId: 'u-1',
      source: 'auto_author',
    });
  });

  it('writes an audit row with action=kanban_ticket_quick_added', async () => {
    await quickAddKanbanTicket({
      groupId: 'g-1',
      columnId: 'c-rec',
      title: 'A ticket',
      actorId: 'u-1',
    });

    expect(mockAuditCreate).toHaveBeenCalledOnce();
    const auditData = mockAuditCreate.mock.calls[0]![0]!.data;
    expect(auditData).toMatchObject({
      action: 'kanban_ticket_quick_added',
      entityType: 'Request',
      entityId: 'r-new',
      userId: 'u-1',
    });
  });
});

describe('quickAddKanbanTicket — validation', () => {
  it('rejects empty title', async () => {
    await expect(
      quickAddKanbanTicket({
        groupId: 'g-1',
        columnId: 'c-rec',
        title: '   ',
        actorId: 'u-1',
      }),
    ).rejects.toBeInstanceOf(ProposeKanbanTicketError);
    expect(tx.request.create).not.toHaveBeenCalled();
  });

  it('rejects oversize title (>200 chars)', async () => {
    await expect(
      quickAddKanbanTicket({
        groupId: 'g-1',
        columnId: 'c-rec',
        title: 'x'.repeat(201),
        actorId: 'u-1',
      }),
    ).rejects.toBeInstanceOf(ProposeKanbanTicketError);
  });

  it('rejects a column that does not belong to the group', async () => {
    mockColumnFind.mockResolvedValueOnce({ groupId: 'other-group', deletedAt: null } as never);

    await expect(
      quickAddKanbanTicket({
        groupId: 'g-1',
        columnId: 'c-rec',
        title: 'A ticket',
        actorId: 'u-1',
      }),
    ).rejects.toBeInstanceOf(BoardError);
    expect(tx.request.create).not.toHaveBeenCalled();
  });

  it('rejects a soft-deleted column', async () => {
    mockColumnFind.mockResolvedValueOnce({ groupId: 'g-1', deletedAt: new Date() } as never);

    await expect(
      quickAddKanbanTicket({
        groupId: 'g-1',
        columnId: 'c-rec',
        title: 'A ticket',
        actorId: 'u-1',
      }),
    ).rejects.toBeInstanceOf(BoardError);
  });

  it('rejects a column that does not exist', async () => {
    mockColumnFind.mockResolvedValueOnce(null as never);

    await expect(
      quickAddKanbanTicket({
        groupId: 'g-1',
        columnId: 'c-rec',
        title: 'A ticket',
        actorId: 'u-1',
      }),
    ).rejects.toBeInstanceOf(BoardError);
  });
});
