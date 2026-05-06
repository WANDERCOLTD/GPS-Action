/**
 * Integration tests for the Assignment service (bu-coordination-board /
 * ADR-0009). Mocks the Prisma client; asserts the service-layer
 * invariants from ADR-0009 + the brief Tier-2 defaults:
 *
 * - assign creates an Assignment + an auto_assignee RequestSubscription.
 * - re-assign on an already-active user is a no-op (no audit, no
 *   subscription churn).
 * - re-assign on a previously-unassigned user reactivates the row
 *   AND reactivates the subscription if it was soft-deleted.
 * - existing stronger subscription source (e.g. auto_author) is NOT
 *   downgraded to auto_assignee on re-assign.
 * - unassign sets unassignedAt; subscription is intentionally LEFT
 *   in place (members keep getting notifications until they
 *   explicitly unfollow).
 * - listAssigneesForRequest filters out unassigned rows and returns
 *   user fields the avatar row needs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
    assignment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    requestSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    request: {
      findUnique: vi.fn(),
    },
    boardColumn: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/services/kanban-system-events', () => ({
  emitKanbanSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/services/board', () => ({
  moveCard: vi.fn().mockResolvedValue(undefined),
}));

import {
  assignToRequest,
  unassign,
  listAssigneesForRequest,
  isAssigneeActive,
} from '@/server/services/assignments';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { emitKanbanSystemEvent } from '@/server/services/kanban-system-events';
import { moveCard } from '@/server/services/board';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedAssignment = vi.mocked(prisma.assignment);
const mockedSubscription = vi.mocked(prisma.requestSubscription);
const mockedRequest = vi.mocked(prisma.request) as any;
const mockedBoardColumn = vi.mocked(prisma.boardColumn) as any;
const mockedAudit = vi.mocked(auditLog);
const mockedEmitSystemEvent = vi.mocked(emitKanbanSystemEvent);
const mockedMoveCard = vi.mocked(moveCard);

beforeEach(() => {
  vi.clearAllMocks();
  // Default the auto-advance lookups to off-board so existing tests
  // that don't care about the Recruitment rule short-circuit cleanly.
  mockedRequest.findUnique.mockResolvedValue({ columnId: null });
  mockedBoardColumn.findUnique.mockResolvedValue(null);
  mockedBoardColumn.findFirst.mockResolvedValue(null);
});

/**
 * Build a transaction client stub that mirrors the prisma surface the
 * service uses. Each test wires up the per-call behaviour.
 */
function makeTxStub() {
  return {
    assignment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    requestSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('assignToRequest — create path', () => {
  it('creates a new Assignment + auto_assignee subscription when none exists', async () => {
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(null);
    tx.assignment.create.mockResolvedValue({
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date(),
      unassignedAt: null,
    });
    tx.requestSubscription.findUnique.mockResolvedValue(null);
    tx.requestSubscription.create.mockResolvedValue({});
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(result.created).toBe(true);
    expect(result.reactivated).toBe(false);
    expect(tx.assignment.create).toHaveBeenCalledWith({
      data: { requestId: 'r1', userId: 'u1' },
    });
    expect(tx.requestSubscription.create).toHaveBeenCalledWith({
      data: { requestId: 'r1', userId: 'u1', source: 'auto_assignee' },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'assignment_created',
        entityType: 'Assignment',
        entityId: 'a1',
        targetUserId: 'u1',
      }),
    );
  });
});

describe('assignToRequest — idempotent on active user', () => {
  it('returns the existing row without writing audit when user is already actively assigned', async () => {
    const existing = {
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date('2026-05-01'),
      unassignedAt: null,
    };
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(existing);
    tx.requestSubscription.findUnique.mockResolvedValue({
      id: 's1',
      source: 'auto_assignee',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(result.created).toBe(false);
    expect(result.reactivated).toBe(false);
    expect(tx.assignment.create).not.toHaveBeenCalled();
    expect(tx.assignment.update).not.toHaveBeenCalled();
    expect(tx.requestSubscription.create).not.toHaveBeenCalled();
    expect(tx.requestSubscription.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});

describe('assignToRequest — reactivate path', () => {
  it('clears unassignedAt + reactivates a soft-deleted subscription', async () => {
    const previouslyUnassigned = {
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date('2026-05-01'),
      unassignedAt: new Date('2026-05-02'),
    };
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(previouslyUnassigned);
    tx.assignment.update.mockResolvedValue({
      ...previouslyUnassigned,
      unassignedAt: null,
      assignedAt: new Date('2026-05-04'),
    });
    tx.requestSubscription.findUnique.mockResolvedValue({
      id: 's1',
      source: 'auto_assignee',
      deletedAt: new Date('2026-05-02'),
    });
    tx.requestSubscription.update.mockResolvedValue({});
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(result.reactivated).toBe(true);
    expect(tx.assignment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { unassignedAt: null, assignedAt: expect.any(Date) },
    });
    expect(tx.requestSubscription.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { deletedAt: null },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'assignment_reactivated' }),
    );
  });
});

describe('assignToRequest — preserves stronger subscription source', () => {
  it('does NOT downgrade an auto_author subscription to auto_assignee', async () => {
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(null);
    tx.assignment.create.mockResolvedValue({
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date(),
      unassignedAt: null,
    });
    tx.requestSubscription.findUnique.mockResolvedValue({
      id: 's1',
      source: 'auto_author',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    // Subscription already active with stronger source — no churn.
    expect(tx.requestSubscription.create).not.toHaveBeenCalled();
    expect(tx.requestSubscription.update).not.toHaveBeenCalled();
  });
});

describe('unassign', () => {
  it('sets unassignedAt and audits but does NOT touch the subscription', async () => {
    const active = {
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date('2026-05-01'),
      unassignedAt: null,
    };
    mockedAssignment.findUnique.mockResolvedValue(active);
    mockedAssignment.update.mockResolvedValue({ ...active, unassignedAt: new Date() });

    const result = await unassign({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(result?.unassignedAt).toBeInstanceOf(Date);
    expect(mockedAssignment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { unassignedAt: expect.any(Date) },
    });
    // Subscription deliberately untouched — Tier-2 default + Surface 2 spec.
    expect(mockedSubscription.update).not.toHaveBeenCalled();
    expect(mockedSubscription.create).not.toHaveBeenCalled();
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'assignment_unassigned' }),
    );
  });

  it('is idempotent when already unassigned', async () => {
    const alreadyUnassigned = {
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date('2026-05-01'),
      unassignedAt: new Date('2026-05-02'),
    };
    mockedAssignment.findUnique.mockResolvedValue(alreadyUnassigned);

    const result = await unassign({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(result).toBe(alreadyUnassigned);
    expect(mockedAssignment.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('returns null when no Assignment row exists', async () => {
    mockedAssignment.findUnique.mockResolvedValue(null);

    const result = await unassign({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(result).toBeNull();
    expect(mockedAssignment.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});

describe('listAssigneesForRequest', () => {
  it('filters out unassigned rows + returns avatar-row fields', async () => {
    mockedAssignment.findMany.mockResolvedValue([
      {
        id: 'a1',
        assignedAt: new Date('2026-05-01'),
        user: { id: 'u1', displayName: 'Sharon', avatarUrl: 'https://x/sharon.png' },
      },
      {
        id: 'a2',
        assignedAt: new Date('2026-05-02'),
        user: { id: 'u2', displayName: 'Maya', avatarUrl: null },
      },
    ] as never);

    const out = await listAssigneesForRequest('r1');

    expect(mockedAssignment.findMany).toHaveBeenCalledWith({
      where: { requestId: 'r1', unassignedAt: null },
      orderBy: { assignedAt: 'asc' },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    expect(out).toEqual([
      {
        userId: 'u1',
        displayName: 'Sharon',
        avatarUrl: 'https://x/sharon.png',
        assignedAt: new Date('2026-05-01'),
      },
      { userId: 'u2', displayName: 'Maya', avatarUrl: null, assignedAt: new Date('2026-05-02') },
    ]);
  });
});

describe('system event emission (atom 5d-3)', () => {
  it('emits assign_self when actor === userId on a real state change', async () => {
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(null);
    tx.assignment.create.mockResolvedValue({
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date(),
      unassignedAt: null,
    });
    tx.requestSubscription.findUnique.mockResolvedValue(null);
    tx.requestSubscription.create.mockResolvedValue({});
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'assign_self' },
    });
  });

  it('does NOT emit assign_self when actor is a different user (admin assigning someone)', async () => {
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(null);
    tx.assignment.create.mockResolvedValue({
      id: 'a1',
      requestId: 'r1',
      userId: 'u-target',
      assignedAt: new Date(),
      unassignedAt: null,
    });
    tx.requestSubscription.findUnique.mockResolvedValue(null);
    tx.requestSubscription.create.mockResolvedValue({});
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await assignToRequest({ requestId: 'r1', userId: 'u-target', actorId: 'u-admin' });

    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });

  it('does NOT emit assign_self when re-assigning an already-active user (no state change)', async () => {
    const existing = {
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date('2026-05-01'),
      unassignedAt: null,
    };
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(existing);
    tx.requestSubscription.findUnique.mockResolvedValue({
      id: 's1',
      source: 'auto_assignee',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });

  it('emits unassign_self when actor === userId on a real state change', async () => {
    const active = {
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date('2026-05-01'),
      unassignedAt: null,
    };
    mockedAssignment.findUnique.mockResolvedValue(active);
    mockedAssignment.update.mockResolvedValue({ ...active, unassignedAt: new Date() });

    await unassign({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'unassign_self' },
    });
  });

  it('does NOT emit unassign_self when actor is a different user', async () => {
    const active = {
      id: 'a1',
      requestId: 'r1',
      userId: 'u-target',
      assignedAt: new Date('2026-05-01'),
      unassignedAt: null,
    };
    mockedAssignment.findUnique.mockResolvedValue(active);
    mockedAssignment.update.mockResolvedValue({ ...active, unassignedAt: new Date() });

    await unassign({ requestId: 'r1', userId: 'u-target', actorId: 'u-admin' });

    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });

  it('does NOT emit unassign_self on idempotent no-op', async () => {
    const alreadyUnassigned = {
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date('2026-05-01'),
      unassignedAt: new Date('2026-05-02'),
    };
    mockedAssignment.findUnique.mockResolvedValue(alreadyUnassigned);

    await unassign({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });
});

describe('Recruitment → Preparation auto-advance (Tier-2 default #3)', () => {
  function mockSelfAssignCreate() {
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(null);
    tx.assignment.create.mockResolvedValue({
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date(),
      unassignedAt: null,
    });
    tx.requestSubscription.findUnique.mockResolvedValue(null);
    tx.requestSubscription.create.mockResolvedValue({});
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));
  }

  it('moves the card to the next column on self-assign while on Recruitment', async () => {
    mockSelfAssignCreate();
    mockedRequest.findUnique.mockResolvedValue({ columnId: 'c-recruitment' });
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g1',
      ordinal: 0,
      displayName: 'Recruitment',
      deletedAt: null,
    });
    mockedBoardColumn.findFirst.mockResolvedValue({ id: 'c-preparation' });

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedBoardColumn.findFirst).toHaveBeenCalledWith({
      where: { groupId: 'g1', ordinal: 1, deletedAt: null },
      select: { id: true },
    });
    expect(mockedMoveCard).toHaveBeenCalledWith({
      requestId: 'r1',
      groupId: 'g1',
      destination: { lane: 'active', columnId: 'c-preparation' },
      actorId: 'u1',
    });
  });

  it('matches Recruitment case-insensitively (admin renamed casing)', async () => {
    mockSelfAssignCreate();
    mockedRequest.findUnique.mockResolvedValue({ columnId: 'c-recruitment' });
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g1',
      ordinal: 0,
      displayName: '  recruitment  ',
      deletedAt: null,
    });
    mockedBoardColumn.findFirst.mockResolvedValue({ id: 'c-preparation' });

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedMoveCard).toHaveBeenCalled();
  });

  it('does NOT advance when on a non-Recruitment column', async () => {
    mockSelfAssignCreate();
    mockedRequest.findUnique.mockResolvedValue({ columnId: 'c-prep' });
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g1',
      ordinal: 1,
      displayName: 'Preparation',
      deletedAt: null,
    });

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedBoardColumn.findFirst).not.toHaveBeenCalled();
    expect(mockedMoveCard).not.toHaveBeenCalled();
  });

  it('does NOT advance when an admin assigns someone else (not self-assign)', async () => {
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(null);
    tx.assignment.create.mockResolvedValue({
      id: 'a1',
      requestId: 'r1',
      userId: 'u-target',
      assignedAt: new Date(),
      unassignedAt: null,
    });
    tx.requestSubscription.findUnique.mockResolvedValue(null);
    tx.requestSubscription.create.mockResolvedValue({});
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await assignToRequest({ requestId: 'r1', userId: 'u-target', actorId: 'u-admin' });

    expect(mockedRequest.findUnique).not.toHaveBeenCalled();
    expect(mockedMoveCard).not.toHaveBeenCalled();
  });

  it('does NOT advance when the ticket is off-board (columnId null)', async () => {
    mockSelfAssignCreate();
    mockedRequest.findUnique.mockResolvedValue({ columnId: null });

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedBoardColumn.findUnique).not.toHaveBeenCalled();
    expect(mockedMoveCard).not.toHaveBeenCalled();
  });

  it('does NOT advance when the originating column has been soft-deleted', async () => {
    mockSelfAssignCreate();
    mockedRequest.findUnique.mockResolvedValue({ columnId: 'c-recruitment' });
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g1',
      ordinal: 0,
      displayName: 'Recruitment',
      deletedAt: new Date(),
    });

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedBoardColumn.findFirst).not.toHaveBeenCalled();
    expect(mockedMoveCard).not.toHaveBeenCalled();
  });

  it('does NOT advance when there is no next column (Recruitment is last)', async () => {
    mockSelfAssignCreate();
    mockedRequest.findUnique.mockResolvedValue({ columnId: 'c-recruitment' });
    mockedBoardColumn.findUnique.mockResolvedValue({
      groupId: 'g1',
      ordinal: 0,
      displayName: 'Recruitment',
      deletedAt: null,
    });
    mockedBoardColumn.findFirst.mockResolvedValue(null);

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedMoveCard).not.toHaveBeenCalled();
  });

  it('does NOT advance on idempotent re-assign of an already-active user', async () => {
    const existing = {
      id: 'a1',
      requestId: 'r1',
      userId: 'u1',
      assignedAt: new Date('2026-05-01'),
      unassignedAt: null,
    };
    const tx = makeTxStub();
    tx.assignment.findUnique.mockResolvedValue(existing);
    tx.requestSubscription.findUnique.mockResolvedValue({
      id: 's1',
      source: 'auto_assignee',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(mockedRequest.findUnique).not.toHaveBeenCalled();
    expect(mockedMoveCard).not.toHaveBeenCalled();
  });
});

describe('isAssigneeActive', () => {
  it('returns true for an active assignee', async () => {
    mockedAssignment.findUnique.mockResolvedValue({ unassignedAt: null } as never);
    expect(await isAssigneeActive('r1', 'u1')).toBe(true);
  });

  it('returns false for an unassigned row', async () => {
    mockedAssignment.findUnique.mockResolvedValue({
      unassignedAt: new Date('2026-05-02'),
    } as never);
    expect(await isAssigneeActive('r1', 'u1')).toBe(false);
  });

  it('returns false when no row exists', async () => {
    mockedAssignment.findUnique.mockResolvedValue(null);
    expect(await isAssigneeActive('r1', 'u1')).toBe(false);
  });
});
