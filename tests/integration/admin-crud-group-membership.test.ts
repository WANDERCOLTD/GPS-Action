/**
 * @build-unit BU-admin-group-membership
 * @spec build/session-briefs/bu-admin-group-membership.md
 *
 * Round-trip CRUD tests for the GroupMembership entity through the
 * generic admin engine. Mocks Prisma at the DB boundary; calls go
 * through the real router → service → registry chain via createCaller.
 *
 * Covers (per brief):
 *   - list filter (search) builds OR over user/group displayName
 *   - create idempotent on (userId, groupId): existing-active → no-op,
 *     existing-soft-deleted → undelete + re-stamp joinedVia=admin_added
 *   - create rejects soft-deleted user / group FK
 *   - create stamps joinedVia=admin_added on a fresh row
 *   - update only changes role; other fields ignored
 *   - softDelete sets deletedAt and does NOT touch leftAt
 *   - restore clears deletedAt
 *   - sysadmin-only: queue_manager and member forbidden
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    groupMembership: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const mFindMany = vi.mocked(prisma.groupMembership.findMany);
const mCount = vi.mocked(prisma.groupMembership.count);
const mFindUnique = vi.mocked(prisma.groupMembership.findUnique);
const mCreate = vi.mocked(prisma.groupMembership.create);
const mUpdate = vi.mocked(prisma.groupMembership.update);
const mUserFindUnique = vi.mocked(prisma.user.findUnique);
const mGroupFindUnique = vi.mocked(prisma.group.findUnique);

function fakeUser(id = 'a-1'): TRPCContext['user'] {
  return {
    id,
    email: `${id}@test.com`,
    displayName: id,
    avatarUrl: null,
    phoneNumber: null,
    verifiedAt: new Date(),
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

const adminCtx: TRPCContext = {
  user: fakeUser('admin-1'),
  activeRoles: ['admin'],
  activeScopes: [],
};
const queueCtx: TRPCContext = {
  user: fakeUser('q-1'),
  activeRoles: ['queue_manager'],
  activeScopes: [],
};
const memberCtx: TRPCContext = { user: fakeUser('m-1'), activeRoles: [], activeScopes: [] };

const USER_UUID = '11111111-1111-4111-8111-111111111111';
const GROUP_UUID = '22222222-2222-4222-8222-222222222222';
const MEM_UUID = '33333333-3333-4333-8333-333333333333';

function fakeMembershipRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: MEM_UUID,
    userId: USER_UUID,
    groupId: GROUP_UUID,
    role: 'member',
    joinedAt: now,
    joinedVia: 'admin_added',
    leftAt: null,
    leftReason: null,
    approvedByUserId: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    user: { id: USER_UUID, displayName: 'Bette' },
    group: { id: GROUP_UUID, displayName: 'Writers', slug: 'writers' },
    approvedBy: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default audit pre-fetch shape — many tests don't care about the
  // snapshot but the audit chain reads the row after every mutation.
  mFindUnique.mockResolvedValue(
    fakeMembershipRow() as Awaited<ReturnType<typeof prisma.groupMembership.findUnique>>,
  );
  mUserFindUnique.mockResolvedValue({
    id: USER_UUID,
    deletedAt: null,
  } as Awaited<ReturnType<typeof prisma.user.findUnique>>);
  mGroupFindUnique.mockResolvedValue({
    id: GROUP_UUID,
    deletedAt: null,
  } as Awaited<ReturnType<typeof prisma.group.findUnique>>);
});

// ── List ────────────────────────────────────────────────────────────────

describe('admin.list / groupMembership', () => {
  it('returns rows + total filtered by deletedAt:null, ordered joinedAt desc', async () => {
    mFindMany.mockResolvedValueOnce([fakeMembershipRow()] as Awaited<
      ReturnType<typeof prisma.groupMembership.findMany>
    >);
    mCount.mockResolvedValueOnce(1);

    const caller = createCaller(adminCtx);
    const result = await caller.admin.list({ entity: 'groupMembership' });

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.['user.displayName']).toBe('Bette');
    expect(result.rows[0]?.['group.displayName']).toBe('Writers');

    const call = mFindMany.mock.calls[0]?.[0];
    expect(call?.where?.deletedAt).toBeNull();
    expect(call?.orderBy).toEqual({ joinedAt: 'desc' });
  });

  it('search builds an OR over user.displayName and group.displayName', async () => {
    mFindMany.mockResolvedValueOnce(
      [] as Awaited<ReturnType<typeof prisma.groupMembership.findMany>>,
    );
    mCount.mockResolvedValueOnce(0);
    const caller = createCaller(adminCtx);
    await caller.admin.list({ entity: 'groupMembership', search: 'bet' });

    const where = mFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown> | undefined;
    expect(where?.OR).toEqual([
      { user: { displayName: { contains: 'bet', mode: 'insensitive' } } },
      { group: { displayName: { contains: 'bet', mode: 'insensitive' } } },
    ]);
  });
});

// ── Create ─────────────────────────────────────────────────────────────

describe('admin.create / groupMembership', () => {
  it('creates a fresh row with joinedVia=admin_added', async () => {
    // No existing (user, group) row.
    mFindUnique.mockReset();
    mFindUnique
      // findUnique on (userId_groupId) — composite — no existing row
      .mockResolvedValueOnce(null)
      // post-create re-fetch for audit `after`
      .mockResolvedValue(
        fakeMembershipRow() as Awaited<ReturnType<typeof prisma.groupMembership.findUnique>>,
      );
    mCreate.mockResolvedValueOnce({ id: MEM_UUID } as Awaited<
      ReturnType<typeof prisma.groupMembership.create>
    >);

    const caller = createCaller(adminCtx);
    const result = await caller.admin.create({
      entity: 'groupMembership',
      data: { userId: USER_UUID, groupId: GROUP_UUID, role: 'member' },
    });

    expect(result).toEqual({ id: MEM_UUID });
    expect(mCreate).toHaveBeenCalledWith({
      data: {
        userId: USER_UUID,
        groupId: GROUP_UUID,
        role: 'member',
        joinedVia: 'admin_added',
      },
      select: { id: true },
    });
  });

  it('idempotent: existing active row returns its id without modifying', async () => {
    mFindUnique.mockReset();
    mFindUnique
      // existing (userId_groupId) lookup → active row
      .mockResolvedValueOnce({ id: MEM_UUID, deletedAt: null } as Awaited<
        ReturnType<typeof prisma.groupMembership.findUnique>
      >)
      // post-create audit re-fetch
      .mockResolvedValue(
        fakeMembershipRow() as Awaited<ReturnType<typeof prisma.groupMembership.findUnique>>,
      );

    const caller = createCaller(adminCtx);
    const result = await caller.admin.create({
      entity: 'groupMembership',
      data: { userId: USER_UUID, groupId: GROUP_UUID, role: 'member' },
    });

    expect(result).toEqual({ id: MEM_UUID });
    expect(mCreate).not.toHaveBeenCalled();
    expect(mUpdate).not.toHaveBeenCalled();
  });

  it('idempotent: existing soft-deleted row is undeleted with joinedVia=admin_added', async () => {
    const oldDeletedAt = new Date('2025-01-01');
    mFindUnique.mockReset();
    mFindUnique
      // existing (userId_groupId) lookup → soft-deleted row
      .mockResolvedValueOnce({ id: MEM_UUID, deletedAt: oldDeletedAt } as Awaited<
        ReturnType<typeof prisma.groupMembership.findUnique>
      >)
      // post-create audit re-fetch
      .mockResolvedValue(
        fakeMembershipRow() as Awaited<ReturnType<typeof prisma.groupMembership.findUnique>>,
      );
    mUpdate.mockResolvedValueOnce({ id: MEM_UUID } as Awaited<
      ReturnType<typeof prisma.groupMembership.update>
    >);

    const caller = createCaller(adminCtx);
    const result = await caller.admin.create({
      entity: 'groupMembership',
      data: { userId: USER_UUID, groupId: GROUP_UUID, role: 'admin' },
    });

    expect(result).toEqual({ id: MEM_UUID });
    expect(mCreate).not.toHaveBeenCalled();
    expect(mUpdate).toHaveBeenCalledWith({
      where: { id: MEM_UUID },
      data: { deletedAt: null, joinedVia: 'admin_added', role: 'admin' },
      select: { id: true },
    });
  });

  it('rejects when user is soft-deleted', async () => {
    mUserFindUnique.mockResolvedValueOnce({
      id: USER_UUID,
      deletedAt: new Date(),
    } as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    const caller = createCaller(adminCtx);
    await expect(
      caller.admin.create({
        entity: 'groupMembership',
        data: { userId: USER_UUID, groupId: GROUP_UUID, role: 'member' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mCreate).not.toHaveBeenCalled();
  });

  it('rejects when group is soft-deleted', async () => {
    mGroupFindUnique.mockResolvedValueOnce({
      id: GROUP_UUID,
      deletedAt: new Date(),
    } as Awaited<ReturnType<typeof prisma.group.findUnique>>);

    const caller = createCaller(adminCtx);
    await expect(
      caller.admin.create({
        entity: 'groupMembership',
        data: { userId: USER_UUID, groupId: GROUP_UUID, role: 'member' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mCreate).not.toHaveBeenCalled();
  });
});

// ── Update ─────────────────────────────────────────────────────────────

describe('admin.update / groupMembership', () => {
  it('updates only role; other fields ignored by schema', async () => {
    mUpdate.mockResolvedValueOnce({ id: MEM_UUID } as Awaited<
      ReturnType<typeof prisma.groupMembership.update>
    >);

    const caller = createCaller(adminCtx);
    const result = await caller.admin.update({
      entity: 'groupMembership',
      id: MEM_UUID,
      data: { role: 'admin' },
    });

    expect(result).toEqual({ id: MEM_UUID });
    expect(mUpdate).toHaveBeenCalledWith({
      where: { id: MEM_UUID },
      data: { role: 'admin' },
      select: { id: true },
    });
  });

  it('rejects update without role (Zod)', async () => {
    const caller = createCaller(adminCtx);
    await expect(
      caller.admin.update({
        entity: 'groupMembership',
        id: MEM_UUID,
        data: {},
      }),
    ).rejects.toThrow();
  });
});

// ── Soft-delete + restore ──────────────────────────────────────────────

describe('admin.delete / groupMembership', () => {
  it('mode=soft sets deletedAt and does NOT touch leftAt', async () => {
    mUpdate.mockResolvedValueOnce({ id: MEM_UUID } as Awaited<
      ReturnType<typeof prisma.groupMembership.update>
    >);
    const caller = createCaller(adminCtx);
    await caller.admin.delete({
      entity: 'groupMembership',
      id: MEM_UUID,
      mode: 'soft',
    });
    const call = mUpdate.mock.calls[0]?.[0];
    expect(call?.data).toMatchObject({ deletedAt: expect.any(Date) });
    // leftAt MUST NOT be in the update payload — that is a different
    // domain event (member voluntary departure). Per brief.
    expect(call?.data).not.toHaveProperty('leftAt');
  });

  it('mode=restore clears deletedAt', async () => {
    mUpdate.mockResolvedValueOnce({ id: MEM_UUID } as Awaited<
      ReturnType<typeof prisma.groupMembership.update>
    >);
    const caller = createCaller(adminCtx);
    await caller.admin.delete({
      entity: 'groupMembership',
      id: MEM_UUID,
      mode: 'restore',
    });
    const call = mUpdate.mock.calls[0]?.[0];
    expect(call?.data).toEqual({ deletedAt: null });
  });

  it('mode=hard rejects (entity uses soft-delete)', async () => {
    const caller = createCaller(adminCtx);
    await expect(
      caller.admin.delete({
        entity: 'groupMembership',
        id: MEM_UUID,
        mode: 'hard',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ── Auth boundary ──────────────────────────────────────────────────────

describe('admin.* / groupMembership — sysadmin-only gate', () => {
  it('FORBIDDEN for queue_manager on list', async () => {
    const caller = createCaller(queueCtx);
    await expect(caller.admin.list({ entity: 'groupMembership' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('FORBIDDEN for plain member on list', async () => {
    const caller = createCaller(memberCtx);
    await expect(caller.admin.list({ entity: 'groupMembership' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('admin can list', async () => {
    mFindMany.mockResolvedValueOnce(
      [] as Awaited<ReturnType<typeof prisma.groupMembership.findMany>>,
    );
    mCount.mockResolvedValueOnce(0);
    const caller = createCaller(adminCtx);
    const result = await caller.admin.list({ entity: 'groupMembership' });
    expect(result.total).toBe(0);
  });
});

// ── Audit log shape ────────────────────────────────────────────────────
//
// The generic admin audit helper writes one AuditLog row per mutation
// with action `admin.<entity>.<verb>`. Verify the wiring fires for
// each verb and stamps entityType=groupMembership.

describe('admin audit / groupMembership — one row per mutation', () => {
  const auditCreate = vi.mocked(prisma.auditLog.create);

  it('create writes admin.groupMembership.create', async () => {
    mFindUnique.mockReset();
    mFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(
        fakeMembershipRow() as Awaited<ReturnType<typeof prisma.groupMembership.findUnique>>,
      );
    mCreate.mockResolvedValueOnce({ id: MEM_UUID } as Awaited<
      ReturnType<typeof prisma.groupMembership.create>
    >);

    const caller = createCaller(adminCtx);
    await caller.admin.create({
      entity: 'groupMembership',
      data: { userId: USER_UUID, groupId: GROUP_UUID, role: 'member' },
    });

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const audited = auditCreate.mock.calls[0]?.[0]?.data as Record<string, unknown> | undefined;
    expect(audited?.action).toBe('admin.groupMembership.create');
    expect(audited?.entityType).toBe('groupMembership');
    expect(audited?.entityId).toBe(MEM_UUID);
  });

  it('softDelete writes admin.groupMembership.soft-delete', async () => {
    mUpdate.mockResolvedValueOnce({ id: MEM_UUID } as Awaited<
      ReturnType<typeof prisma.groupMembership.update>
    >);
    const caller = createCaller(adminCtx);
    await caller.admin.delete({ entity: 'groupMembership', id: MEM_UUID, mode: 'soft' });

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const audited = auditCreate.mock.calls[0]?.[0]?.data as Record<string, unknown> | undefined;
    expect(audited?.action).toBe('admin.groupMembership.soft-delete');
  });

  it('restore writes admin.groupMembership.restore', async () => {
    mUpdate.mockResolvedValueOnce({ id: MEM_UUID } as Awaited<
      ReturnType<typeof prisma.groupMembership.update>
    >);
    const caller = createCaller(adminCtx);
    await caller.admin.delete({ entity: 'groupMembership', id: MEM_UUID, mode: 'restore' });

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const audited = auditCreate.mock.calls[0]?.[0]?.data as Record<string, unknown> | undefined;
    expect(audited?.action).toBe('admin.groupMembership.restore');
  });

  it('update writes admin.groupMembership.update', async () => {
    mUpdate.mockResolvedValueOnce({ id: MEM_UUID } as Awaited<
      ReturnType<typeof prisma.groupMembership.update>
    >);
    const caller = createCaller(adminCtx);
    await caller.admin.update({
      entity: 'groupMembership',
      id: MEM_UUID,
      data: { role: 'admin' },
    });

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const audited = auditCreate.mock.calls[0]?.[0]?.data as Record<string, unknown> | undefined;
    expect(audited?.action).toBe('admin.groupMembership.update');
  });
});
