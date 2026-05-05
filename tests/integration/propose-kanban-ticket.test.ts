/**
 * Integration tests for proposeKanbanTicket (Surface 1 — propose-to-backlog).
 *
 * Asserts the backlog-shape contract:
 *   - Request: type=null, status='backlog', columnId=null, boardPosition=null,
 *     context={}, urgency=false.
 *   - RequestGroup: origin='originating', columnId=null, boardPosition=null.
 *   - Subscription row written for the author with source='auto_author'.
 *   - Audit row written.
 *   - Validation: empty title rejected, oversize title/body rejected.
 *
 * @build-unit bu-coordination-board
 * @spec docs/build/session-briefs/bu-coordination-board.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      auditLog: { create: vi.fn() },
    },
  };
});

import { proposeKanbanTicket, ProposeKanbanTicketError } from '@/server/services/board';
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

const mockAuditCreate = vi.mocked(prisma.auditLog.create);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditCreate.mockResolvedValue({} as never);
  tx.request.create.mockResolvedValue({
    id: 'r-new',
    title: 'Hello',
    status: 'backlog',
  } as never);
  tx.requestGroup.create.mockResolvedValue({
    id: 'rg-new',
    requestId: 'r-new',
    groupId: 'g-1',
  } as never);
  tx.requestSubscription.create.mockResolvedValue({} as never);
});

describe('proposeKanbanTicket — happy path', () => {
  it('writes Request with backlog shape (type=null, status=backlog, no column)', async () => {
    await proposeKanbanTicket({
      groupId: 'g-1',
      title: '  Pitch the new banner  ',
      body: '  with deadline thursday  ',
      actorId: 'u-1',
    });

    expect(tx.request.create).toHaveBeenCalledOnce();
    const data = tx.request.create.mock.calls[0]![0]!.data;
    expect(data).toMatchObject({
      type: null,
      status: 'backlog',
      title: 'Pitch the new banner',
      body: '  with deadline thursday  ',
      context: {},
      urgency: false,
      columnId: null,
      boardPosition: null,
      createdByUserId: 'u-1',
    });
  });

  it('writes RequestGroup with origin=originating and no column placement', async () => {
    await proposeKanbanTicket({
      groupId: 'g-1',
      title: 'A ticket',
      body: null,
      actorId: 'u-1',
    });

    expect(tx.requestGroup.create).toHaveBeenCalledOnce();
    expect(tx.requestGroup.create.mock.calls[0]![0]!.data).toMatchObject({
      requestId: 'r-new',
      groupId: 'g-1',
      origin: 'originating',
      columnId: null,
      boardPosition: null,
      isUrgent: false,
      sharedByUserId: 'u-1',
    });
  });

  it('auto-subscribes the author with source=auto_author', async () => {
    await proposeKanbanTicket({
      groupId: 'g-1',
      title: 'A ticket',
      body: null,
      actorId: 'u-1',
    });

    expect(tx.requestSubscription.create).toHaveBeenCalledOnce();
    expect(tx.requestSubscription.create.mock.calls[0]![0]!.data).toEqual({
      requestId: 'r-new',
      userId: 'u-1',
      source: 'auto_author',
    });
  });

  it('writes the kanban_ticket_proposed audit row', async () => {
    await proposeKanbanTicket({
      groupId: 'g-1',
      title: 'Hello',
      body: null,
      actorId: 'u-1',
    });

    expect(mockAuditCreate).toHaveBeenCalledOnce();
    expect(mockAuditCreate.mock.calls[0]![0]!.data).toMatchObject({
      action: 'kanban_ticket_proposed',
      entityType: 'Request',
      entityId: 'r-new',
      userId: 'u-1',
    });
  });

  it('whitespace-only body collapses to null', async () => {
    await proposeKanbanTicket({
      groupId: 'g-1',
      title: 'Hello',
      body: '   \n  ',
      actorId: 'u-1',
    });

    expect(tx.request.create.mock.calls[0]![0]!.data.body).toBeNull();
  });
});

describe('proposeKanbanTicket — validation', () => {
  it('rejects empty / whitespace-only title with ProposeKanbanTicketError', async () => {
    await expect(
      proposeKanbanTicket({
        groupId: 'g-1',
        title: '   ',
        body: null,
        actorId: 'u-1',
      }),
    ).rejects.toBeInstanceOf(ProposeKanbanTicketError);
    expect(tx.request.create).not.toHaveBeenCalled();
  });

  it('rejects oversize title (>200 chars)', async () => {
    await expect(
      proposeKanbanTicket({
        groupId: 'g-1',
        title: 'x'.repeat(201),
        body: null,
        actorId: 'u-1',
      }),
    ).rejects.toMatchObject({ kind: 'title_too_long' });
  });

  it('rejects oversize body (>10000 chars)', async () => {
    await expect(
      proposeKanbanTicket({
        groupId: 'g-1',
        title: 'Title',
        body: 'x'.repeat(10001),
        actorId: 'u-1',
      }),
    ).rejects.toMatchObject({ kind: 'body_too_long' });
  });
});
