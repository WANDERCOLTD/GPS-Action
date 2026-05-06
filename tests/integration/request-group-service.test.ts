/**
 * Integration tests for the request-group service (bu-coordination-board /
 * ADR-0009). Mocks the Prisma client; asserts:
 *
 * - createOriginatingRequestGroup: idempotent on existing originating row.
 * - shareRequestToGroup:
 *   - 'workflow' mode requires an active GroupShareWorkflow row; throws
 *     'workflow_required' otherwise.
 *   - 'ad_hoc' mode requires isGroupAdminOfSource OR isSystemAdmin;
 *     throws 'forbidden_ad_hoc' otherwise.
 *   - 'self_share' rejection regardless of mode / role.
 *   - re-share on a soft-deleted row undeletes + audits 'reshared'.
 *   - already-active row is no-op (no audit).
 * - unshareRequestFromGroup:
 *   - refuses to unshare the originating row.
 *   - idempotent on already-deleted; null on missing row.
 * - listGroupsForRequest excludes soft-deleted links + soft-deleted groups.
 * - addShareWorkflow:
 *   - rejects self-share (sourceGroupId === targetGroupId).
 *   - undeletes a soft-deleted row + audits 'readded'.
 * - removeShareWorkflow soft-deletes; idempotent; null on missing.
 * - listShareWorkflowTargets reads the join with target-group filter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
    requestGroup: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    groupShareWorkflow: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  createOriginatingRequestGroup,
  shareRequestToGroup,
  unshareRequestFromGroup,
  listGroupsForRequest,
  addShareWorkflow,
  removeShareWorkflow,
  listShareWorkflowTargets,
  ShareError,
} from '@/server/services/request-group';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { emitKanbanSystemEvent } from '@/server/services/kanban-system-events';

const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedRequestGroup = vi.mocked(prisma.requestGroup);
const mockedWorkflow = vi.mocked(prisma.groupShareWorkflow);
const mockedAudit = vi.mocked(auditLog);
const mockedEmitSystemEvent = vi.mocked(emitKanbanSystemEvent);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeTxStub() {
  return {
    requestGroup: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    groupShareWorkflow: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('createOriginatingRequestGroup', () => {
  it('creates the originating row when none exists', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue(null);
    mockedRequestGroup.create.mockResolvedValue({
      id: 'rg1',
      requestId: 'r1',
      groupId: 'g1',
      origin: 'originating',
      deletedAt: null,
    } as never);

    const row = await createOriginatingRequestGroup({
      requestId: 'r1',
      groupId: 'g1',
      actorId: 'u1',
    });

    expect(row.origin).toBe('originating');
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'request_group_originating_created' }),
    );
  });

  it('is idempotent on an existing row (no audit)', async () => {
    const existing = {
      id: 'rg1',
      requestId: 'r1',
      groupId: 'g1',
      origin: 'originating',
      deletedAt: null,
    };
    mockedRequestGroup.findUnique.mockResolvedValue(existing as never);

    const row = await createOriginatingRequestGroup({
      requestId: 'r1',
      groupId: 'g1',
      actorId: 'u1',
    });

    expect(row).toBe(existing);
    expect(mockedRequestGroup.create).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});

describe('shareRequestToGroup — validation', () => {
  it('rejects self-share (sourceGroupId === targetGroupId)', async () => {
    await expect(
      shareRequestToGroup({
        requestId: 'r1',
        sourceGroupId: 'g1',
        targetGroupId: 'g1',
        mode: 'workflow',
        actorId: 'u1',
        isSystemAdmin: false,
        isGroupAdminOfSource: true,
      }),
    ).rejects.toMatchObject({ name: 'ShareError', kind: 'self_share' });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("'workflow' mode throws 'workflow_required' when no allow-list row exists", async () => {
    mockedWorkflow.findUnique.mockResolvedValue(null);

    await expect(
      shareRequestToGroup({
        requestId: 'r1',
        sourceGroupId: 'g1',
        targetGroupId: 'g2',
        mode: 'workflow',
        actorId: 'u1',
        isSystemAdmin: false,
        isGroupAdminOfSource: false,
      }),
    ).rejects.toMatchObject({ kind: 'workflow_required' });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("'workflow' mode throws when the allow-list row is soft-deleted", async () => {
    mockedWorkflow.findUnique.mockResolvedValue({
      id: 'w1',
      deletedAt: new Date(),
    } as never);

    await expect(
      shareRequestToGroup({
        requestId: 'r1',
        sourceGroupId: 'g1',
        targetGroupId: 'g2',
        mode: 'workflow',
        actorId: 'u1',
        isSystemAdmin: false,
        isGroupAdminOfSource: false,
      }),
    ).rejects.toMatchObject({ kind: 'workflow_required' });
  });

  it("'ad_hoc' mode throws 'forbidden_ad_hoc' for non-admin", async () => {
    await expect(
      shareRequestToGroup({
        requestId: 'r1',
        sourceGroupId: 'g1',
        targetGroupId: 'g2',
        mode: 'ad_hoc',
        actorId: 'u1',
        isSystemAdmin: false,
        isGroupAdminOfSource: false,
      }),
    ).rejects.toMatchObject({ kind: 'forbidden_ad_hoc' });
  });

  it("'ad_hoc' mode passes for system admin without group admin role", async () => {
    const tx = makeTxStub();
    tx.requestGroup.findUnique.mockResolvedValue(null);
    tx.requestGroup.create.mockResolvedValue({
      id: 'rg1',
      origin: 'ad_hoc_share',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await shareRequestToGroup({
      requestId: 'r1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      mode: 'ad_hoc',
      actorId: 'u1',
      isSystemAdmin: true,
      isGroupAdminOfSource: false,
    });

    expect(result.created).toBe(true);
    expect(tx.requestGroup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ origin: 'ad_hoc_share' }),
    });
  });
});

describe('shareRequestToGroup — create / reactivate / no-op', () => {
  beforeEach(() => {
    mockedWorkflow.findUnique.mockResolvedValue({
      id: 'w1',
      deletedAt: null,
    } as never);
  });

  it('creates a new RequestGroup row on first share (workflow mode)', async () => {
    const tx = makeTxStub();
    tx.requestGroup.findUnique.mockResolvedValue(null);
    tx.requestGroup.create.mockResolvedValue({
      id: 'rg1',
      origin: 'workflow_share',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await shareRequestToGroup({
      requestId: 'r1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      mode: 'workflow',
      actorId: 'u1',
      isSystemAdmin: false,
      isGroupAdminOfSource: false,
    });

    expect(result.created).toBe(true);
    expect(result.reactivated).toBe(false);
    expect(tx.requestGroup.create).toHaveBeenCalledWith({
      data: {
        requestId: 'r1',
        groupId: 'g2',
        origin: 'workflow_share',
        sharedByUserId: 'u1',
      },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'request_group_shared' }),
    );
  });

  it('reactivates a soft-deleted row + audits "reshared"', async () => {
    const tx = makeTxStub();
    tx.requestGroup.findUnique.mockResolvedValue({
      id: 'rg1',
      requestId: 'r1',
      groupId: 'g2',
      deletedAt: new Date('2026-04-30'),
    });
    tx.requestGroup.update.mockResolvedValue({
      id: 'rg1',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await shareRequestToGroup({
      requestId: 'r1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      mode: 'workflow',
      actorId: 'u1',
      isSystemAdmin: false,
      isGroupAdminOfSource: false,
    });

    expect(result.reactivated).toBe(true);
    expect(tx.requestGroup.update).toHaveBeenCalledWith({
      where: { id: 'rg1' },
      data: expect.objectContaining({
        deletedAt: null,
        origin: 'workflow_share',
        sharedByUserId: 'u1',
      }),
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'request_group_reshared' }),
    );
  });

  it('is a no-op on an already-active row (no audit)', async () => {
    const tx = makeTxStub();
    const active = { id: 'rg1', requestId: 'r1', groupId: 'g2', deletedAt: null };
    tx.requestGroup.findUnique.mockResolvedValue(active);
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await shareRequestToGroup({
      requestId: 'r1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      mode: 'workflow',
      actorId: 'u1',
      isSystemAdmin: false,
      isGroupAdminOfSource: false,
    });

    expect(result.created).toBe(false);
    expect(result.reactivated).toBe(false);
    expect(result.row).toBe(active);
    expect(tx.requestGroup.create).not.toHaveBeenCalled();
    expect(tx.requestGroup.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('emits a share_to_team system event on first share (atom 5d-3)', async () => {
    const tx = makeTxStub();
    tx.requestGroup.findUnique.mockResolvedValue(null);
    tx.requestGroup.create.mockResolvedValue({
      id: 'rg1',
      origin: 'workflow_share',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await shareRequestToGroup({
      requestId: 'r1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      mode: 'workflow',
      actorId: 'u1',
      isSystemAdmin: false,
      isGroupAdminOfSource: false,
    });

    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'share_to_team', targetGroupId: 'g2' },
    });
  });

  it('emits a share_to_team system event on reshare of a soft-deleted row', async () => {
    const tx = makeTxStub();
    tx.requestGroup.findUnique.mockResolvedValue({
      id: 'rg1',
      requestId: 'r1',
      groupId: 'g2',
      deletedAt: new Date('2026-04-30'),
    });
    tx.requestGroup.update.mockResolvedValue({
      id: 'rg1',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await shareRequestToGroup({
      requestId: 'r1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      mode: 'workflow',
      actorId: 'u1',
      isSystemAdmin: false,
      isGroupAdminOfSource: false,
    });

    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'share_to_team', targetGroupId: 'g2' },
    });
  });

  it('does NOT emit a share_to_team system event on no-op (already-active row)', async () => {
    const tx = makeTxStub();
    const active = { id: 'rg1', requestId: 'r1', groupId: 'g2', deletedAt: null };
    tx.requestGroup.findUnique.mockResolvedValue(active);
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await shareRequestToGroup({
      requestId: 'r1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      mode: 'workflow',
      actorId: 'u1',
      isSystemAdmin: false,
      isGroupAdminOfSource: false,
    });

    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });
});

describe('unshareRequestFromGroup', () => {
  it('refuses to unshare the originating row', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({
      id: 'rg1',
      origin: 'originating',
      deletedAt: null,
    } as never);

    await expect(
      unshareRequestFromGroup({ requestId: 'r1', groupId: 'g1', actorId: 'u1' }),
    ).rejects.toMatchObject({ name: 'ShareError' });
    expect(mockedRequestGroup.update).not.toHaveBeenCalled();
  });

  it('soft-deletes a shared row + audits', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({
      id: 'rg2',
      origin: 'workflow_share',
      deletedAt: null,
    } as never);
    mockedRequestGroup.update.mockResolvedValue({
      id: 'rg2',
      deletedAt: new Date(),
    } as never);

    await unshareRequestFromGroup({ requestId: 'r1', groupId: 'g2', actorId: 'u1' });

    expect(mockedRequestGroup.update).toHaveBeenCalledWith({
      where: { id: 'rg2' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'request_group_unshared' }),
    );
  });

  it('is idempotent on already-deleted row', async () => {
    const deleted = {
      id: 'rg2',
      origin: 'workflow_share',
      deletedAt: new Date('2026-04-30'),
    };
    mockedRequestGroup.findUnique.mockResolvedValue(deleted as never);

    const result = await unshareRequestFromGroup({
      requestId: 'r1',
      groupId: 'g2',
      actorId: 'u1',
    });

    expect(result).toBe(deleted);
    expect(mockedRequestGroup.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('returns null when no row exists', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue(null);

    const result = await unshareRequestFromGroup({
      requestId: 'r1',
      groupId: 'g2',
      actorId: 'u1',
    });

    expect(result).toBeNull();
  });
});

describe('listGroupsForRequest', () => {
  it('returns active links with their groups, ordered by createdAt', async () => {
    mockedRequestGroup.findMany.mockResolvedValue([
      {
        id: 'rg1',
        requestId: 'r1',
        origin: 'originating',
        group: { id: 'g1', displayName: 'Writers' },
      },
      {
        id: 'rg2',
        requestId: 'r1',
        origin: 'workflow_share',
        group: { id: 'g2', displayName: 'IT' },
      },
    ] as never);

    const result = await listGroupsForRequest('r1');

    expect(mockedRequestGroup.findMany).toHaveBeenCalledWith({
      where: { requestId: 'r1', deletedAt: null, group: { deletedAt: null } },
      include: { group: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toMatchObject([
      { group: { id: 'g1' }, link: { id: 'rg1', origin: 'originating' } },
      { group: { id: 'g2' }, link: { id: 'rg2', origin: 'workflow_share' } },
    ]);
  });
});

describe('addShareWorkflow', () => {
  it('rejects self-share (source === target)', async () => {
    await expect(
      addShareWorkflow({ sourceGroupId: 'g1', targetGroupId: 'g1', actorId: 'u1' }),
    ).rejects.toMatchObject({ kind: 'self_share' });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it('creates a new workflow row when none exists', async () => {
    const tx = makeTxStub();
    tx.groupShareWorkflow.findUnique.mockResolvedValue(null);
    tx.groupShareWorkflow.create.mockResolvedValue({
      id: 'w1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await addShareWorkflow({
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      actorId: 'u1',
    });

    expect(result.created).toBe(true);
    expect(tx.groupShareWorkflow.create).toHaveBeenCalledWith({
      data: { sourceGroupId: 'g1', targetGroupId: 'g2', addedByUserId: 'u1' },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'group_share_workflow_added' }),
    );
  });

  it('undeletes a soft-deleted row + audits "readded"', async () => {
    const tx = makeTxStub();
    tx.groupShareWorkflow.findUnique.mockResolvedValue({
      id: 'w1',
      deletedAt: new Date('2026-04-30'),
    });
    tx.groupShareWorkflow.update.mockResolvedValue({
      id: 'w1',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await addShareWorkflow({
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      actorId: 'u1',
    });

    expect(result.reactivated).toBe(true);
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'group_share_workflow_readded' }),
    );
  });

  it('is a no-op on already-active row', async () => {
    const tx = makeTxStub();
    const active = { id: 'w1', deletedAt: null };
    tx.groupShareWorkflow.findUnique.mockResolvedValue(active);
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await addShareWorkflow({
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      actorId: 'u1',
    });

    expect(result.created).toBe(false);
    expect(result.reactivated).toBe(false);
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});

describe('removeShareWorkflow', () => {
  it('soft-deletes an active row + audits', async () => {
    mockedWorkflow.findUnique.mockResolvedValue({
      id: 'w1',
      deletedAt: null,
    } as never);
    mockedWorkflow.update.mockResolvedValue({
      id: 'w1',
      deletedAt: new Date(),
    } as never);

    await removeShareWorkflow({
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      actorId: 'u1',
    });

    expect(mockedWorkflow.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'group_share_workflow_removed' }),
    );
  });

  it('is idempotent on already-deleted', async () => {
    const deleted = { id: 'w1', deletedAt: new Date('2026-04-30') };
    mockedWorkflow.findUnique.mockResolvedValue(deleted as never);

    const result = await removeShareWorkflow({
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      actorId: 'u1',
    });

    expect(result).toBe(deleted);
    expect(mockedWorkflow.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('returns null when no row exists', async () => {
    mockedWorkflow.findUnique.mockResolvedValue(null);

    const result = await removeShareWorkflow({
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      actorId: 'u1',
    });

    expect(result).toBeNull();
  });
});

describe('listShareWorkflowTargets', () => {
  it('returns active workflow rows with target groups, ordered by displayName', async () => {
    mockedWorkflow.findMany.mockResolvedValue([
      { id: 'w1', sourceGroupId: 'g1', targetGroup: { id: 'g2', displayName: 'IT' } },
      {
        id: 'w2',
        sourceGroupId: 'g1',
        targetGroup: { id: 'g3', displayName: 'Radio' },
      },
    ] as never);

    const result = await listShareWorkflowTargets('g1');

    expect(mockedWorkflow.findMany).toHaveBeenCalledWith({
      where: {
        sourceGroupId: 'g1',
        deletedAt: null,
        targetGroup: { deletedAt: null },
      },
      include: { targetGroup: true },
      orderBy: { targetGroup: { displayName: 'asc' } },
    });
    expect(result).toMatchObject([
      { group: { id: 'g2' }, workflow: { id: 'w1' } },
      { group: { id: 'g3' }, workflow: { id: 'w2' } },
    ]);
  });
});

describe('ShareError', () => {
  it('exposes kind for routers to convert to TRPCError codes', () => {
    const e = new ShareError('workflow_required', 'msg');
    expect(e.kind).toBe('workflow_required');
    expect(e.name).toBe('ShareError');
  });
});
