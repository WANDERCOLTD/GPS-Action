/**
 * Integration tests for the group-kanban service (bu-coordination-board).
 * Mocks the Prisma client; asserts:
 *
 * - listAccessibleGroupsForUser:
 *   - system admin sees every non-deleted Group, with isGroupAdmin set
 *     accurately by overlaying membership rows.
 *   - regular member sees only groups they actively belong to (excludes
 *     left memberships, soft-deleted memberships, soft-deleted groups).
 *   - results sorted by displayName (verified via Prisma orderBy arg).
 * - getGroupBySlugForUser:
 *   - resolves for an active member.
 *   - returns null for a non-member non-admin (existence masked).
 *   - returns null when slug doesn't resolve.
 *   - returns null for a soft-deleted Group even for a system admin
 *     (kanban surface hides them; admin restore is elsewhere).
 *   - resolves for a system admin who is not a member.
 * - getGroupAccess:
 *   - sets isMember + isGroupAdmin from a membership row.
 *   - canAdminBoard true for group admin AND for system admin.
 *   - all-false (except isSystemAdmin) when group is soft-deleted.
 * - assertCanViewBoard / assertCanAdminBoard:
 *   - throw GroupAccessError('not_found') when invisible to caller.
 *   - throw GroupAccessError('forbidden') for member-without-admin
 *     calling assertCanAdminBoard.
 *   - return access struct on success.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    group: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    groupMembership: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import {
  listAccessibleGroupsForUser,
  getGroupBySlugForUser,
  getGroupAccess,
  assertCanViewBoard,
  assertCanAdminBoard,
  GroupAccessError,
} from '@/server/services/group-kanban';
import { prisma } from '@/server/db/client';

const mockedGroup = vi.mocked(prisma.group);
const mockedMembership = vi.mocked(prisma.groupMembership);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listAccessibleGroupsForUser — system admin', () => {
  it('returns every non-deleted Group + overlays membership flags', async () => {
    mockedGroup.findMany.mockResolvedValue([
      { id: 'g1', displayName: 'Alpha', slug: 'alpha' },
      { id: 'g2', displayName: 'Beta', slug: 'beta' },
      { id: 'g3', displayName: 'Gamma', slug: 'gamma' },
    ] as never);
    mockedMembership.findMany.mockResolvedValue([
      { groupId: 'g1', role: 'admin' },
      { groupId: 'g2', role: 'member' },
    ] as never);

    const result = await listAccessibleGroupsForUser({ userId: 'u1', isSystemAdmin: true });

    expect(mockedGroup.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { displayName: 'asc' },
    });
    expect(result).toMatchObject([
      // g1: group-admin + system-admin
      {
        group: { id: 'g1' },
        access: {
          isMember: true,
          isGroupAdmin: true,
          isSystemAdmin: true,
          canViewBoard: true,
          canAdminBoard: true,
        },
      },
      // g2: member + system-admin
      {
        group: { id: 'g2' },
        access: { isMember: true, isGroupAdmin: false, canAdminBoard: true },
      },
      // g3: non-member + system-admin
      {
        group: { id: 'g3' },
        access: { isMember: false, canViewBoard: true, canAdminBoard: true },
      },
    ]);
  });
});

describe('listAccessibleGroupsForUser — regular member', () => {
  it('returns only the groups the user actively belongs to + sorts by displayName', async () => {
    mockedMembership.findMany.mockResolvedValue([
      {
        role: 'member',
        group: { id: 'g1', displayName: 'Alpha', slug: 'alpha' },
      },
      {
        role: 'admin',
        group: { id: 'g2', displayName: 'Beta', slug: 'beta' },
      },
    ] as never);

    const result = await listAccessibleGroupsForUser({ userId: 'u1', isSystemAdmin: false });

    expect(mockedMembership.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        leftAt: null,
        deletedAt: null,
        group: { deletedAt: null },
      },
      include: { group: true },
      orderBy: { group: { displayName: 'asc' } },
    });
    expect(result).toMatchObject([
      {
        group: { id: 'g1' },
        access: { isMember: true, isGroupAdmin: false, canAdminBoard: false },
      },
      {
        group: { id: 'g2' },
        access: { isMember: true, isGroupAdmin: true, canAdminBoard: true },
      },
    ]);
  });

  it('excludes left memberships, soft-deleted memberships, soft-deleted groups via the where clause', async () => {
    // The exclusion is enforced by the where clause; just verify it's
    // there. Empty result for the test case.
    mockedMembership.findMany.mockResolvedValue([]);

    const result = await listAccessibleGroupsForUser({ userId: 'u1', isSystemAdmin: false });

    expect(result).toEqual([]);
    expect(mockedMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leftAt: null,
          deletedAt: null,
          group: { deletedAt: null },
        }),
      }),
    );
  });
});

describe('getGroupBySlugForUser', () => {
  it('resolves for an active member', async () => {
    mockedGroup.findFirst.mockResolvedValue({
      id: 'g1',
      slug: 'alpha',
      displayName: 'Alpha',
    } as never);
    mockedMembership.findFirst.mockResolvedValue({ role: 'member' } as never);

    const result = await getGroupBySlugForUser({
      slug: 'alpha',
      userId: 'u1',
      isSystemAdmin: false,
    });

    expect(result?.group.id).toBe('g1');
    expect(result?.access.isMember).toBe(true);
    expect(result?.access.canAdminBoard).toBe(false);
  });

  it('returns null for a non-member non-admin (existence masked)', async () => {
    mockedGroup.findFirst.mockResolvedValue({
      id: 'g1',
      slug: 'alpha',
      displayName: 'Alpha',
    } as never);
    mockedMembership.findFirst.mockResolvedValue(null);

    const result = await getGroupBySlugForUser({
      slug: 'alpha',
      userId: 'u1',
      isSystemAdmin: false,
    });

    expect(result).toBeNull();
  });

  it('returns null when slug does not resolve', async () => {
    mockedGroup.findFirst.mockResolvedValue(null);

    const result = await getGroupBySlugForUser({
      slug: 'nope',
      userId: 'u1',
      isSystemAdmin: true,
    });

    expect(result).toBeNull();
    // Membership lookup must NOT happen if group doesn't exist.
    expect(mockedMembership.findFirst).not.toHaveBeenCalled();
  });

  it('soft-deleted Group is invisible even to a system admin', async () => {
    // findFirst with `deletedAt: null` returns null when the row is
    // soft-deleted. Service treats that the same as not-found.
    mockedGroup.findFirst.mockResolvedValue(null);

    const result = await getGroupBySlugForUser({
      slug: 'alpha',
      userId: 'u1',
      isSystemAdmin: true,
    });

    expect(result).toBeNull();
    expect(mockedGroup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: 'alpha', deletedAt: null }),
      }),
    );
  });

  it('resolves for a system admin who is not a member', async () => {
    mockedGroup.findFirst.mockResolvedValue({
      id: 'g1',
      slug: 'alpha',
      displayName: 'Alpha',
    } as never);
    mockedMembership.findFirst.mockResolvedValue(null);

    const result = await getGroupBySlugForUser({
      slug: 'alpha',
      userId: 'u1',
      isSystemAdmin: true,
    });

    expect(result?.group.id).toBe('g1');
    expect(result?.access.isMember).toBe(false);
    expect(result?.access.isSystemAdmin).toBe(true);
    expect(result?.access.canViewBoard).toBe(true);
    expect(result?.access.canAdminBoard).toBe(true);
  });
});

describe('getGroupAccess', () => {
  it('sets isMember + isGroupAdmin from the membership row', async () => {
    mockedGroup.findFirst.mockResolvedValue({ id: 'g1' } as never);
    mockedMembership.findFirst.mockResolvedValue({ role: 'admin' } as never);

    const access = await getGroupAccess({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: false,
    });

    expect(access.isMember).toBe(true);
    expect(access.isGroupAdmin).toBe(true);
    expect(access.canAdminBoard).toBe(true);
  });

  it('canAdminBoard is true for a system admin even without membership', async () => {
    mockedGroup.findFirst.mockResolvedValue({ id: 'g1' } as never);
    mockedMembership.findFirst.mockResolvedValue(null);

    const access = await getGroupAccess({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: true,
    });

    expect(access.isMember).toBe(false);
    expect(access.isGroupAdmin).toBe(false);
    expect(access.canAdminBoard).toBe(true);
  });

  it('returns the zero-access struct when the group is soft-deleted / missing', async () => {
    mockedGroup.findFirst.mockResolvedValue(null);

    const access = await getGroupAccess({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: true,
    });

    expect(access.canViewBoard).toBe(false);
    expect(access.canAdminBoard).toBe(false);
    expect(access.isSystemAdmin).toBe(true);
    // Membership lookup must NOT happen.
    expect(mockedMembership.findFirst).not.toHaveBeenCalled();
  });
});

describe('assertCanViewBoard', () => {
  it('returns the access struct for a member', async () => {
    mockedGroup.findFirst.mockResolvedValue({ id: 'g1' } as never);
    mockedMembership.findFirst.mockResolvedValue({ role: 'member' } as never);

    const access = await assertCanViewBoard({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: false,
    });
    expect(access.isMember).toBe(true);
  });

  it("throws GroupAccessError('not_found') when caller cannot view", async () => {
    mockedGroup.findFirst.mockResolvedValue({ id: 'g1' } as never);
    mockedMembership.findFirst.mockResolvedValue(null);

    await expect(
      assertCanViewBoard({ groupId: 'g1', userId: 'u1', isSystemAdmin: false }),
    ).rejects.toMatchObject({
      name: 'GroupAccessError',
      kind: 'not_found',
    });
  });
});

describe('assertCanAdminBoard', () => {
  it('returns the access struct for a group admin', async () => {
    mockedGroup.findFirst.mockResolvedValue({ id: 'g1' } as never);
    mockedMembership.findFirst.mockResolvedValue({ role: 'admin' } as never);

    const access = await assertCanAdminBoard({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: false,
    });
    expect(access.canAdminBoard).toBe(true);
  });

  it("throws 'forbidden' for a member who is not a group admin", async () => {
    mockedGroup.findFirst.mockResolvedValue({ id: 'g1' } as never);
    mockedMembership.findFirst.mockResolvedValue({ role: 'member' } as never);

    await expect(
      assertCanAdminBoard({ groupId: 'g1', userId: 'u1', isSystemAdmin: false }),
    ).rejects.toMatchObject({
      name: 'GroupAccessError',
      kind: 'forbidden',
    });
  });

  it("throws 'not_found' when caller cannot even view the group", async () => {
    mockedGroup.findFirst.mockResolvedValue(null);

    await expect(
      assertCanAdminBoard({ groupId: 'g1', userId: 'u1', isSystemAdmin: false }),
    ).rejects.toMatchObject({
      name: 'GroupAccessError',
      kind: 'not_found',
    });
  });

  it('passes for a system admin even with no membership row', async () => {
    mockedGroup.findFirst.mockResolvedValue({ id: 'g1' } as never);
    mockedMembership.findFirst.mockResolvedValue(null);

    const access = await assertCanAdminBoard({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: true,
    });
    expect(access.canAdminBoard).toBe(true);
  });
});

describe('GroupAccessError', () => {
  it('exposes kind for routers to convert to TRPCError codes', () => {
    const e = new GroupAccessError('forbidden', 'msg');
    expect(e.kind).toBe('forbidden');
    expect(e.name).toBe('GroupAccessError');
    expect(e.message).toBe('msg');
  });
});
