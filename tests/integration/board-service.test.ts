/**
 * Integration tests for the Board service (bu-coordination-board /
 * Surface 1, PR #4a). Mocks the Prisma client; asserts the primitives:
 *
 * - positionBetween: pure midpoint math + edge cases.
 * - moveCard:
 *     - originating-group move writes Request + mirrors RequestGroup.
 *     - originating-group move updates Request.status by lane.
 *     - shared-group move writes only the RequestGroup row.
 *     - shared-group move to off-board lane is rejected.
 *     - target column must belong to the destination group.
 *     - missing Request / missing link surface typed errors.
 * - setRequestStatus: idempotent no-op when unchanged; audit-logs on
 *   change.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/server/db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
    request: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    requestGroup: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    boardColumn: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/services/kanban-system-events', () => ({
  emitKanbanSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

import {
  BOARD_POSITION_GAP,
  BoardError,
  moveCard,
  positionBetween,
  setRequestStatus,
  setRequestUrgency,
} from '@/server/services/board';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { emitKanbanSystemEvent } from '@/server/services/kanban-system-events';

// Loose `any` casts on the Prisma mocks: Prisma client types are deeply
// specific (Prisma__XClient with method chains) which makes
// mockImplementation() argument inference reject the simple
// async ({ where }) => ... shape every test in this file uses. The
// tests assert behaviour, not Prisma's runtime contract — looser typing
// here is fine.
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockedTransaction = vi.mocked(prisma.$transaction) as any;
const mockedRequest = vi.mocked(prisma.request) as any;
const mockedRequestGroup = vi.mocked(prisma.requestGroup) as any;
const mockedBoardColumn = vi.mocked(prisma.boardColumn) as any;
const mockedAudit = vi.mocked(auditLog);
const mockedEmitSystemEvent = vi.mocked(emitKanbanSystemEvent);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('positionBetween', () => {
  it('returns 0 when both siblings are null (empty column)', () => {
    expect(positionBetween(null, null).toString()).toBe('0');
  });

  it('pads down by GAP when only `after` is set (top of column)', () => {
    const result = positionBetween(null, new Prisma.Decimal(1024));
    expect(result.toString()).toBe('0');
  });

  it('pads up by GAP when only `before` is set (bottom of column)', () => {
    const result = positionBetween(new Prisma.Decimal(1024), null);
    expect(result.toString()).toBe(String(1024 + BOARD_POSITION_GAP));
  });

  it('returns the midpoint of two siblings (exact for Decimal)', () => {
    const result = positionBetween(new Prisma.Decimal(0), new Prisma.Decimal(1024));
    expect(result.toString()).toBe('512');
  });

  it('handles fractional midpoints without precision loss', () => {
    // After 10 sequential midpoint inserts at the top, the position
    // should still be exact: 1024 / 2^10 = 1.
    let pos = new Prisma.Decimal(1024);
    for (let i = 0; i < 10; i++) {
      pos = positionBetween(new Prisma.Decimal(0), pos);
    }
    expect(pos.toString()).toBe('1');
  });
});

describe('moveCard — originating group', () => {
  function setUpOriginatingMove(opts: {
    fromColumnId: string | null;
    fromStatus: 'backlog' | 'active' | 'done' | 'abandoned';
    fromPosition: number | null;
  }) {
    mockedRequest.findUnique.mockResolvedValue({
      id: 'r1',
      columnId: opts.fromColumnId,
      status: opts.fromStatus,
      boardPosition: opts.fromPosition === null ? null : new Prisma.Decimal(opts.fromPosition),
    } as never);
    mockedRequestGroup.findUnique.mockImplementation(({ where }: any) => {
      // The originating-link lookup, keyed by (requestId, groupId).
      if (
        where.requestId_groupId?.requestId === 'r1' &&
        where.requestId_groupId?.groupId === 'g1'
      ) {
        return Promise.resolve({
          id: 'rg1',
          origin: 'originating',
          columnId: opts.fromColumnId,
          boardPosition: opts.fromPosition === null ? null : new Prisma.Decimal(opts.fromPosition),
          deletedAt: null,
        } as never);
      }
      return Promise.resolve(null as never);
    });
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g1',
      deletedAt: null,
    } as never);
    mockedTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        request: { update: vi.fn().mockResolvedValue({ id: 'r1' }) },
        requestGroup: { update: vi.fn().mockResolvedValue({ id: 'rg1' }) },
      };
      return cb(tx);
    });
  }

  it('writes Request + mirrors RequestGroup when moving across columns', async () => {
    setUpOriginatingMove({ fromColumnId: 'c-old', fromStatus: 'active', fromPosition: 1024 });
    mockedTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        request: {
          update: vi.fn().mockResolvedValue({
            id: 'r1',
            columnId: 'c-new',
            status: 'active',
            boardPosition: new Prisma.Decimal(0),
          }),
        },
        requestGroup: {
          update: vi.fn().mockResolvedValue({
            id: 'rg1',
            columnId: 'c-new',
            boardPosition: new Prisma.Decimal(0),
          }),
        },
      };
      const result = await cb(tx);
      // Capture the update calls so the test can assert.
      (mockedTransaction as any).__lastTx = tx;
      return result;
    });

    const result = await moveCard({
      requestId: 'r1',
      groupId: 'g1',
      destination: { lane: 'active', columnId: 'c-new' },
      actorId: 'u1',
    });

    expect(result.isOriginating).toBe(true);
    expect(result.status).toBe('active');
    const tx = (mockedTransaction as any).__lastTx;
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        columnId: 'c-new',
        boardPosition: expect.any(Prisma.Decimal),
        status: 'active',
      },
    });
    expect(tx.requestGroup.update).toHaveBeenCalledWith({
      where: { id: 'rg1' },
      data: {
        columnId: 'c-new',
        boardPosition: expect.any(Prisma.Decimal),
      },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'board_card_moved',
        entityType: 'Request',
        context: expect.objectContaining({ scope: 'originating', lane: 'active' }),
      }),
    );
  });

  it('sets status to backlog when dropped on the backlog lane (columnId nulled)', async () => {
    setUpOriginatingMove({ fromColumnId: 'c-old', fromStatus: 'active', fromPosition: 100 });
    mockedTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        request: {
          update: vi.fn().mockImplementation(async ({ data }: any) => ({
            id: 'r1',
            columnId: data.columnId,
            status: data.status,
            boardPosition: data.boardPosition,
          })),
        },
        requestGroup: {
          update: vi.fn().mockImplementation(async ({ data }: any) => ({
            id: 'rg1',
            ...data,
          })),
        },
      };
      const result = await cb(tx);
      (mockedTransaction as any).__lastTx = tx;
      return result;
    });

    const result = await moveCard({
      requestId: 'r1',
      groupId: 'g1',
      destination: { lane: 'backlog' },
      actorId: 'u1',
    });

    expect(result.status).toBe('backlog');
    const tx = (mockedTransaction as any).__lastTx;
    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ columnId: null, status: 'backlog' }),
    });
  });

  it('sets status to done / abandoned for those lanes', async () => {
    for (const lane of ['done', 'abandoned'] as const) {
      setUpOriginatingMove({ fromColumnId: 'c1', fromStatus: 'active', fromPosition: 0 });
      mockedTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          request: {
            update: vi.fn().mockImplementation(async ({ data }: any) => ({
              id: 'r1',
              columnId: data.columnId,
              status: data.status,
              boardPosition: data.boardPosition,
            })),
          },
          requestGroup: {
            update: vi.fn().mockResolvedValue({ id: 'rg1' }),
          },
        };
        return cb(tx);
      });

      const result = await moveCard({
        requestId: 'r1',
        groupId: 'g1',
        destination: { lane },
        actorId: 'u1',
      });
      expect(result.status).toBe(lane);
      expect(result.request.columnId).toBeNull();
    }
  });

  it('rejects a target column that does not belong to the group', async () => {
    setUpOriginatingMove({ fromColumnId: 'c-old', fromStatus: 'active', fromPosition: 0 });
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g-other',
      deletedAt: null,
    } as never);

    await expect(
      moveCard({
        requestId: 'r1',
        groupId: 'g1',
        destination: { lane: 'active', columnId: 'c-foreign' },
        actorId: 'u1',
      }),
    ).rejects.toMatchObject({ kind: 'column_not_in_group' });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it('throws when the Request does not exist', async () => {
    mockedRequest.findUnique.mockResolvedValue(null);
    await expect(
      moveCard({
        requestId: 'r-missing',
        groupId: 'g1',
        destination: { lane: 'backlog' },
        actorId: 'u1',
      }),
    ).rejects.toMatchObject({ kind: 'request_not_found' });
  });

  it('throws when the Request is not linked to the group (missing or soft-deleted)', async () => {
    setUpOriginatingMove({ fromColumnId: null, fromStatus: 'backlog', fromPosition: null });
    mockedRequestGroup.findUnique.mockResolvedValue(null);
    await expect(
      moveCard({
        requestId: 'r1',
        groupId: 'g1',
        destination: { lane: 'backlog' },
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(BoardError);
  });
});

describe('moveCard — shared group', () => {
  function setUpSharedMove() {
    mockedRequest.findUnique.mockResolvedValue({
      id: 'r1',
      columnId: 'c-orig',
      status: 'active',
      boardPosition: new Prisma.Decimal(100),
    } as never);
    mockedRequestGroup.findUnique.mockImplementation(({ where }: any) => {
      if (where.requestId_groupId?.groupId === 'g-shared') {
        return Promise.resolve({
          id: 'rg-shared',
          origin: 'workflow_share',
          columnId: 'c-shared-old',
          boardPosition: new Prisma.Decimal(50),
          deletedAt: null,
        } as never);
      }
      return Promise.resolve(null as never);
    });
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g-shared',
      deletedAt: null,
    } as never);
    mockedRequestGroup.update.mockResolvedValue({
      id: 'rg-shared',
      columnId: 'c-shared-new',
      boardPosition: new Prisma.Decimal(200),
    } as never);
    mockedRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'r1',
      status: 'active',
      columnId: 'c-orig',
      boardPosition: new Prisma.Decimal(100),
    } as never);
  }

  it('updates the shared link only and leaves Request unchanged', async () => {
    setUpSharedMove();

    const result = await moveCard({
      requestId: 'r1',
      groupId: 'g-shared',
      destination: { lane: 'active', columnId: 'c-shared-new' },
      actorId: 'u1',
    });

    expect(result.isOriginating).toBe(false);
    expect(result.status).toBe('active'); // Request.status untouched
    expect(mockedRequestGroup.update).toHaveBeenCalledWith({
      where: { id: 'rg-shared' },
      data: {
        columnId: 'c-shared-new',
        boardPosition: expect.any(Prisma.Decimal),
      },
    });
    expect(mockedTransaction).not.toHaveBeenCalled();
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'RequestGroup',
        context: expect.objectContaining({ scope: 'shared' }),
      }),
    );
  });

  it('rejects off-board moves on a shared link', async () => {
    setUpSharedMove();
    for (const lane of ['backlog', 'done', 'abandoned'] as const) {
      await expect(
        moveCard({
          requestId: 'r1',
          groupId: 'g-shared',
          destination: { lane },
          actorId: 'u1',
        }),
      ).rejects.toMatchObject({ kind: 'shared_off_board_forbidden' });
    }
    expect(mockedRequestGroup.update).not.toHaveBeenCalled();
  });
});

describe('moveCard — sibling position lookup', () => {
  it('looks up sibling positions on Request for an originating move', async () => {
    mockedRequest.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === 'r1') {
        return Promise.resolve({
          id: 'r1',
          columnId: null,
          status: 'backlog',
          boardPosition: null,
        } as never);
      }
      if (where.id === 'r-before') {
        return Promise.resolve({ boardPosition: new Prisma.Decimal(100) } as never);
      }
      if (where.id === 'r-after') {
        return Promise.resolve({ boardPosition: new Prisma.Decimal(300) } as never);
      }
      return Promise.resolve(null);
    });
    mockedRequestGroup.findUnique.mockResolvedValue({
      id: 'rg1',
      origin: 'originating',
      columnId: null,
      boardPosition: null,
      deletedAt: null,
    } as never);
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g1',
      deletedAt: null,
    } as never);
    let capturedPosition: Prisma.Decimal | null = null;
    mockedTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        request: {
          update: vi.fn().mockImplementation(async ({ data }: any) => {
            // Multiple update calls hit `tx.request.update`: the primary
            // write (which carries boardPosition + status), and the
            // ADR-0015 bump (which carries lastActivityAt only). Capture
            // boardPosition only when present so the assertion isn't
            // clobbered by the bump.
            if (data.boardPosition !== undefined) {
              capturedPosition = data.boardPosition;
            }
            return { id: 'r1', boardPosition: data.boardPosition, status: data.status };
          }),
        },
        requestGroup: {
          update: vi.fn().mockResolvedValue({ id: 'rg1' }),
        },
      };
      return cb(tx);
    });

    await moveCard({
      requestId: 'r1',
      groupId: 'g1',
      destination: { lane: 'active', columnId: 'c1' },
      beforeRequestId: 'r-before',
      afterRequestId: 'r-after',
      actorId: 'u1',
    });

    expect(capturedPosition).not.toBeNull();
    expect((capturedPosition as unknown as Prisma.Decimal).toString()).toBe('200');
  });

  it('looks up sibling positions on RequestGroup for a shared move', async () => {
    mockedRequest.findUnique.mockResolvedValue({
      id: 'r1',
      columnId: 'c-orig',
      status: 'active',
      boardPosition: new Prisma.Decimal(0),
    } as never);
    mockedRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'r1',
      status: 'active',
    } as never);
    mockedRequestGroup.findUnique.mockImplementation(({ where }: any) => {
      const groupId = where.requestId_groupId?.groupId;
      const requestId = where.requestId_groupId?.requestId;
      if (requestId === 'r1' && groupId === 'g-shared') {
        return Promise.resolve({
          id: 'rg1',
          origin: 'workflow_share',
          columnId: null,
          boardPosition: null,
          deletedAt: null,
        } as never);
      }
      if (requestId === 'r-before') {
        return Promise.resolve({ boardPosition: new Prisma.Decimal(50) } as never);
      }
      if (requestId === 'r-after') {
        return Promise.resolve({ boardPosition: new Prisma.Decimal(150) } as never);
      }
      return Promise.resolve(null as never);
    });
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g-shared',
      deletedAt: null,
    } as never);
    let capturedPosition: Prisma.Decimal | null = null;
    mockedRequestGroup.update.mockImplementation(async ({ data }: any) => {
      capturedPosition = data.boardPosition;
      return { id: 'rg1', boardPosition: data.boardPosition } as never;
    });

    await moveCard({
      requestId: 'r1',
      groupId: 'g-shared',
      destination: { lane: 'active', columnId: 'c1' },
      beforeRequestId: 'r-before',
      afterRequestId: 'r-after',
      actorId: 'u1',
    });

    expect(capturedPosition).not.toBeNull();
    expect((capturedPosition as unknown as Prisma.Decimal).toString()).toBe('100');
  });
});

describe('setRequestStatus', () => {
  it('updates status + audits when changed', async () => {
    mockedRequest.findUnique.mockResolvedValue({ id: 'r1', status: 'active' } as never);
    mockedRequest.update.mockResolvedValue({ id: 'r1', status: 'abandoned' } as never);

    const result = await setRequestStatus({
      requestId: 'r1',
      status: 'abandoned',
      actorId: 'u1',
    });

    expect(result.status).toBe('abandoned');
    expect(mockedRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'abandoned' },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'request_status_changed',
        changes: { status: { from: 'active', to: 'abandoned' } },
      }),
    );
  });

  it('is idempotent when status already matches', async () => {
    mockedRequest.findUnique.mockResolvedValue({ id: 'r1', status: 'done' } as never);
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', status: 'done' } as never);

    const result = await setRequestStatus({
      requestId: 'r1',
      status: 'done',
      actorId: 'u1',
    });

    expect(result.status).toBe('done');
    expect(mockedRequest.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('throws when the Request does not exist', async () => {
    mockedRequest.findUnique.mockResolvedValue(null);
    await expect(
      setRequestStatus({ requestId: 'r-missing', status: 'done', actorId: 'u1' }),
    ).rejects.toMatchObject({ kind: 'request_not_found' });
  });
});

describe('setRequestUrgency', () => {
  it('flips false → true, audits, emits urgent_on', async () => {
    mockedRequest.findUnique.mockResolvedValue({ id: 'r1', urgency: false } as never);
    mockedRequest.update.mockResolvedValue({ id: 'r1', urgency: true } as never);

    const result = await setRequestUrgency({
      requestId: 'r1',
      urgent: true,
      actorId: 'u1',
    });

    expect(result.urgency).toBe(true);
    expect(mockedRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { urgency: true },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'request_urgency_changed',
        changes: { urgency: { from: false, to: true } },
      }),
    );
    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'urgent_on' },
    });
  });

  it('flips true → false, audits, emits urgent_off', async () => {
    mockedRequest.findUnique.mockResolvedValue({ id: 'r1', urgency: true } as never);
    mockedRequest.update.mockResolvedValue({ id: 'r1', urgency: false } as never);

    await setRequestUrgency({ requestId: 'r1', urgent: false, actorId: 'u1' });

    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'urgent_off' },
    });
  });

  it('is idempotent when the flag already matches — no audit, no system event', async () => {
    mockedRequest.findUnique.mockResolvedValue({ id: 'r1', urgency: true } as never);
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', urgency: true } as never);

    await setRequestUrgency({ requestId: 'r1', urgent: true, actorId: 'u1' });

    expect(mockedRequest.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });

  it('throws request_not_found when the Request is missing', async () => {
    mockedRequest.findUnique.mockResolvedValue(null);
    await expect(
      setRequestUrgency({ requestId: 'r-missing', urgent: true, actorId: 'u1' }),
    ).rejects.toMatchObject({ kind: 'request_not_found' });
  });
});

describe('system event emission (atom 5d-3)', () => {
  it('emits column_move + status_change when an originating move crosses both', async () => {
    mockedRequest.findUnique.mockResolvedValue({
      id: 'r1',
      columnId: null,
      status: 'backlog',
      boardPosition: null,
    } as never);
    mockedRequestGroup.findUnique.mockResolvedValue({
      id: 'rg1',
      origin: 'originating',
      columnId: null,
      boardPosition: null,
      deletedAt: null,
    } as never);
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g1',
      deletedAt: null,
    } as never);
    mockedTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        request: {
          update: vi.fn().mockResolvedValue({
            id: 'r1',
            columnId: 'c-new',
            status: 'active',
            boardPosition: new Prisma.Decimal(0),
          }),
        },
        requestGroup: {
          update: vi.fn().mockResolvedValue({ id: 'rg1' }),
        },
      };
      return cb(tx);
    });

    await moveCard({
      requestId: 'r1',
      groupId: 'g1',
      destination: { lane: 'active', columnId: 'c-new' },
      actorId: 'u1',
    });

    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'column_move', newColumnId: 'c-new' },
    });
    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'status_change', newStatus: 'active' },
    });
  });

  it('skips column_move on a same-column reorder (no column change)', async () => {
    mockedRequest.findUnique.mockResolvedValue({
      id: 'r1',
      columnId: 'c-same',
      status: 'active',
      boardPosition: new Prisma.Decimal(100),
    } as never);
    mockedRequestGroup.findUnique.mockResolvedValue({
      id: 'rg1',
      origin: 'originating',
      columnId: 'c-same',
      boardPosition: new Prisma.Decimal(100),
      deletedAt: null,
    } as never);
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g1',
      deletedAt: null,
    } as never);
    mockedTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        request: { update: vi.fn().mockResolvedValue({ id: 'r1' }) },
        requestGroup: { update: vi.fn().mockResolvedValue({ id: 'rg1' }) },
      };
      return cb(tx);
    });

    await moveCard({
      requestId: 'r1',
      groupId: 'g1',
      destination: { lane: 'active', columnId: 'c-same' },
      actorId: 'u1',
    });

    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });

  it('emits column_move on a shared-group move; never emits status_change', async () => {
    mockedRequest.findUnique.mockResolvedValue({
      id: 'r1',
      columnId: 'c-orig',
      status: 'active',
      boardPosition: new Prisma.Decimal(0),
    } as never);
    mockedRequestGroup.findUnique.mockResolvedValue({
      id: 'rg-shared',
      origin: 'workflow_share',
      columnId: 'c-shared-old',
      boardPosition: new Prisma.Decimal(50),
      deletedAt: null,
    } as never);
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g-shared',
      deletedAt: null,
    } as never);
    mockedRequestGroup.update.mockResolvedValue({
      id: 'rg-shared',
      columnId: 'c-shared-new',
      boardPosition: new Prisma.Decimal(100),
    } as never);
    mockedRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'r1',
      status: 'active',
    } as never);

    await moveCard({
      requestId: 'r1',
      groupId: 'g-shared',
      destination: { lane: 'active', columnId: 'c-shared-new' },
      actorId: 'u1',
    });

    expect(mockedEmitSystemEvent).toHaveBeenCalledTimes(1);
    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'column_move', newColumnId: 'c-shared-new' },
    });
  });

  it('emits status_change from setRequestStatus on actual change', async () => {
    mockedRequest.findUnique.mockResolvedValue({ id: 'r1', status: 'active' } as never);
    mockedRequest.update.mockResolvedValue({ id: 'r1', status: 'done' } as never);

    await setRequestStatus({ requestId: 'r1', status: 'done', actorId: 'u1' });

    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'status_change', newStatus: 'done' },
    });
  });

  it('does not emit from setRequestStatus on idempotent no-op', async () => {
    mockedRequest.findUnique.mockResolvedValue({ id: 'r1', status: 'done' } as never);
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', status: 'done' } as never);

    await setRequestStatus({ requestId: 'r1', status: 'done', actorId: 'u1' });

    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });
});
