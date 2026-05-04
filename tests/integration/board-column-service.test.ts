/**
 * Integration tests for the BoardColumn service (bu-coordination-board /
 * ADR-0006). Mocks the Prisma client; asserts the service-layer
 * invariants from ADR-0006:
 *
 * - seedDefaultColumnsForGroup creates the right column count + names
 *   per GroupKind, ordinal-contiguous from 0.
 * - seedDefaultColumnsForGroup is idempotent (no-op + no audit when
 *   columns already exist).
 * - createColumn appends at end (ordinal = current count) + rejects
 *   empty / whitespace displayName.
 * - renameColumn no-ops when name unchanged after trim.
 * - softDeleteColumn refuses when active Requests still reference it.
 * - softDeleteColumn renumbers surviving columns to keep ordinals
 *   contiguous.
 * - reorderColumns refuses when orderedIds doesn't exactly cover the
 *   active set; no-ops + skips audit when already in order.
 * - reorderColumns uses two-phase write to avoid unique-constraint
 *   collision on (groupId, ordinal).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
    boardColumn: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    request: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import {
  seedDefaultColumnsForGroup,
  listColumnsForGroup,
  createColumn,
  renameColumn,
  softDeleteColumn,
  reorderColumns,
} from '@/server/services/board-column';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';

const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedBoardColumn = vi.mocked(prisma.boardColumn);
const mockedRequest = vi.mocked(prisma.request);
const mockedAudit = vi.mocked(auditLog);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeTxStub() {
  return {
    boardColumn: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('seedDefaultColumnsForGroup', () => {
  it('seeds the workstream default set (4 columns) with contiguous ordinals', async () => {
    mockedBoardColumn.findMany.mockResolvedValue([]);
    mockedTransaction.mockImplementation(async (ops: any) => {
      // mode: array form (passed an array of pending prisma calls)
      // The service builds prisma.boardColumn.create(...) calls and
      // hands them to $transaction as an array; we resolve them to the
      // expected created shapes in order.
      return ops.map((_op: unknown, i: number) => ({
        id: `c${i}`,
        groupId: 'g1',
        ordinal: i,
        displayName: ['Recruitment', 'Preparation', 'Implementation', 'Monitoring'][i],
        deletedAt: null,
      }));
    });

    const result = await seedDefaultColumnsForGroup({
      groupId: 'g1',
      kind: 'workstream',
      actorId: 'admin-1',
    });

    expect(result).toHaveLength(4);
    expect(result.map((c) => c.displayName)).toEqual([
      'Recruitment',
      'Preparation',
      'Implementation',
      'Monitoring',
    ]);
    expect(result.map((c) => c.ordinal)).toEqual([0, 1, 2, 3]);
    expect(mockedAudit).toHaveBeenCalledTimes(4);
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'board_column_seeded', entityType: 'BoardColumn' }),
    );
  });

  it('seeds the network default set (3 columns: New / Open / Done)', async () => {
    mockedBoardColumn.findMany.mockResolvedValue([]);
    mockedTransaction.mockImplementation(async (ops: any) => {
      return ops.map((_op: unknown, i: number) => ({
        id: `c${i}`,
        groupId: 'g1',
        ordinal: i,
        displayName: ['New', 'Open', 'Done'][i],
        deletedAt: null,
      }));
    });

    const result = await seedDefaultColumnsForGroup({
      groupId: 'g1',
      kind: 'network',
      actorId: 'admin-1',
    });

    expect(result.map((c) => c.displayName)).toEqual(['New', 'Open', 'Done']);
  });

  it('is idempotent — returns existing columns + skips audit when already seeded', async () => {
    const existing = [
      { id: 'c0', groupId: 'g1', ordinal: 0, displayName: 'Recruitment', deletedAt: null },
      { id: 'c1', groupId: 'g1', ordinal: 1, displayName: 'Preparation', deletedAt: null },
    ];
    mockedBoardColumn.findMany.mockResolvedValue(existing as never);

    const result = await seedDefaultColumnsForGroup({
      groupId: 'g1',
      kind: 'team',
      actorId: 'admin-1',
    });

    expect(result).toBe(existing);
    expect(mockedTransaction).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});

describe('listColumnsForGroup', () => {
  it('returns active columns ordinal-asc, excluding soft-deleted', async () => {
    mockedBoardColumn.findMany.mockResolvedValue([
      { id: 'c0', ordinal: 0, displayName: 'New' },
      { id: 'c1', ordinal: 1, displayName: 'Active' },
    ] as never);

    const result = await listColumnsForGroup('g1');

    expect(mockedBoardColumn.findMany).toHaveBeenCalledWith({
      where: { groupId: 'g1', deletedAt: null },
      orderBy: { ordinal: 'asc' },
    });
    expect(result).toHaveLength(2);
  });
});

describe('createColumn', () => {
  it('appends a new column at ordinal = current count + writes audit', async () => {
    const tx = makeTxStub();
    tx.boardColumn.count.mockResolvedValue(3);
    tx.boardColumn.create.mockResolvedValue({
      id: 'c3',
      groupId: 'g1',
      ordinal: 3,
      displayName: 'Review',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await createColumn({
      groupId: 'g1',
      displayName: '  Review  ',
      actorId: 'admin-1',
    });

    expect(tx.boardColumn.create).toHaveBeenCalledWith({
      data: { groupId: 'g1', displayName: 'Review', ordinal: 3 },
    });
    expect(result.ordinal).toBe(3);
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'board_column_created' }),
    );
  });

  it('rejects empty / whitespace displayName', async () => {
    await expect(
      createColumn({ groupId: 'g1', displayName: '   ', actorId: 'admin-1' }),
    ).rejects.toThrow(/non-empty/);
    expect(mockedTransaction).not.toHaveBeenCalled();
  });
});

describe('renameColumn', () => {
  it('updates displayName + writes audit with from/to', async () => {
    mockedBoardColumn.findUnique.mockResolvedValue({
      id: 'c1',
      groupId: 'g1',
      ordinal: 1,
      displayName: 'Implementation',
      deletedAt: null,
    } as never);
    mockedBoardColumn.update.mockResolvedValue({
      id: 'c1',
      groupId: 'g1',
      ordinal: 1,
      displayName: 'Active',
      deletedAt: null,
    } as never);

    await renameColumn({ columnId: 'c1', displayName: 'Active', actorId: 'admin-1' });

    expect(mockedBoardColumn.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { displayName: 'Active' },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'board_column_renamed',
        changes: { displayName: { from: 'Implementation', to: 'Active' } },
      }),
    );
  });

  it('no-ops when name unchanged after trim', async () => {
    mockedBoardColumn.findUnique.mockResolvedValue({
      id: 'c1',
      groupId: 'g1',
      displayName: 'Active',
      deletedAt: null,
    } as never);

    await renameColumn({ columnId: 'c1', displayName: '  Active  ', actorId: 'admin-1' });

    expect(mockedBoardColumn.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('rejects deleted column', async () => {
    mockedBoardColumn.findUnique.mockResolvedValue({
      id: 'c1',
      displayName: 'Old',
      deletedAt: new Date(),
    } as never);

    await expect(
      renameColumn({ columnId: 'c1', displayName: 'New', actorId: 'admin-1' }),
    ).rejects.toThrow(/deleted/);
  });
});

describe('softDeleteColumn', () => {
  it('refuses when active Requests still reference the column', async () => {
    mockedBoardColumn.findUnique.mockResolvedValue({
      id: 'c1',
      groupId: 'g1',
      ordinal: 1,
      displayName: 'Active',
      deletedAt: null,
    } as never);
    mockedRequest.count.mockResolvedValue(3);

    await expect(softDeleteColumn({ columnId: 'c1', actorId: 'admin-1' })).rejects.toThrow(
      /3 active request/,
    );
    expect(mockedTransaction).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('soft-deletes + decrements ordinals of columns past the deleted one', async () => {
    mockedBoardColumn.findUnique.mockResolvedValue({
      id: 'c1',
      groupId: 'g1',
      ordinal: 1,
      displayName: 'Preparation',
      deletedAt: null,
    } as never);
    mockedRequest.count.mockResolvedValue(0);

    const tx = makeTxStub();
    tx.boardColumn.update.mockResolvedValue({
      id: 'c1',
      groupId: 'g1',
      ordinal: 1,
      displayName: 'Preparation',
      deletedAt: new Date(),
    });
    tx.boardColumn.updateMany.mockResolvedValue({ count: 2 });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await softDeleteColumn({ columnId: 'c1', actorId: 'admin-1' });

    expect(tx.boardColumn.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.boardColumn.updateMany).toHaveBeenCalledWith({
      where: { groupId: 'g1', deletedAt: null, ordinal: { gt: 1 } },
      data: { ordinal: { decrement: 1 } },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'board_column_deleted' }),
    );
  });

  it('idempotent on already-deleted column', async () => {
    const deleted = {
      id: 'c1',
      groupId: 'g1',
      ordinal: 1,
      displayName: 'Old',
      deletedAt: new Date('2026-05-01'),
    };
    mockedBoardColumn.findUnique.mockResolvedValue(deleted as never);

    const result = await softDeleteColumn({ columnId: 'c1', actorId: 'admin-1' });

    expect(result).toBe(deleted);
    expect(mockedTransaction).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});

describe('reorderColumns', () => {
  it('rejects when orderedIds does not cover the active set', async () => {
    const tx = makeTxStub();
    tx.boardColumn.findMany.mockResolvedValue([
      { id: 'c0', ordinal: 0, displayName: 'A' },
      { id: 'c1', ordinal: 1, displayName: 'B' },
      { id: 'c2', ordinal: 2, displayName: 'C' },
    ]);
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await expect(
      reorderColumns({ groupId: 'g1', orderedIds: ['c0', 'c1'], actorId: 'admin-1' }),
    ).rejects.toThrow(/exactly cover/);
    expect(tx.boardColumn.update).not.toHaveBeenCalled();
  });

  it('no-ops + skips audit when already in requested order', async () => {
    const tx = makeTxStub();
    tx.boardColumn.findMany.mockResolvedValue([
      { id: 'c0', ordinal: 0, displayName: 'A' },
      { id: 'c1', ordinal: 1, displayName: 'B' },
    ]);
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await reorderColumns({ groupId: 'g1', orderedIds: ['c0', 'c1'], actorId: 'admin-1' });

    expect(tx.boardColumn.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('uses two-phase write (high offsets first, then 0..N-1) to avoid ordinal collisions', async () => {
    const tx = makeTxStub();
    tx.boardColumn.findMany.mockResolvedValue([
      { id: 'c0', ordinal: 0, displayName: 'A' },
      { id: 'c1', ordinal: 1, displayName: 'B' },
      { id: 'c2', ordinal: 2, displayName: 'C' },
    ]);
    tx.boardColumn.update.mockImplementation(async (args: any) => ({
      id: args.where.id,
      groupId: 'g1',
      ordinal: args.data.ordinal,
      displayName: 'X',
      deletedAt: null,
    }));
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    // Reverse the order: c2, c1, c0.
    await reorderColumns({
      groupId: 'g1',
      orderedIds: ['c2', 'c1', 'c0'],
      actorId: 'admin-1',
    });

    const calls = tx.boardColumn.update.mock.calls.map((c: any[]) => c[0]);
    // Phase 1: high-range offsets (>= 1_000_000).
    expect(calls.slice(0, 3)).toEqual([
      { where: { id: 'c2' }, data: { ordinal: 1_000_000 } },
      { where: { id: 'c1' }, data: { ordinal: 1_000_001 } },
      { where: { id: 'c0' }, data: { ordinal: 1_000_002 } },
    ]);
    // Phase 2: contiguous 0..2.
    expect(calls.slice(3, 6)).toEqual([
      { where: { id: 'c2' }, data: { ordinal: 0 } },
      { where: { id: 'c1' }, data: { ordinal: 1 } },
      { where: { id: 'c0' }, data: { ordinal: 2 } },
    ]);
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'board_column_reordered',
        context: { groupId: 'g1', orderedIds: ['c2', 'c1', 'c0'] },
      }),
    );
  });
});
