/**
 * Smoke tests for the BoardColumn + Group-kanban routers (PR 3b).
 *
 * Mocks the underlying services. Asserts:
 *   - auth gate on every endpoint.
 *   - permission gate on column mutations (assertCanAdminBoard).
 *   - GroupAccessError is converted to TRPCError with the right code.
 *   - read endpoints pass the caller's isSystemAdmin flag through.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('@/server/services/board-column', () => ({
  listColumnsForGroup: vi.fn(),
  createColumn: vi.fn(),
  renameColumn: vi.fn(),
  softDeleteColumn: vi.fn(),
  reorderColumns: vi.fn(),
  getColumnGroupId: vi.fn(),
}));

vi.mock('@/server/services/group-kanban', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listAccessibleGroupsForUser: vi.fn(),
    getGroupBySlugForUser: vi.fn(),
    getGroupAccess: vi.fn(),
    assertCanViewBoard: vi.fn(),
    assertCanAdminBoard: vi.fn(),
  };
});

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import * as boardColumn from '@/server/services/board-column';
import * as groupKanban from '@/server/services/group-kanban';
import { GroupAccessError } from '@/server/services/group-kanban';

const mockList = vi.mocked(boardColumn.listColumnsForGroup);
const mockCreate = vi.mocked(boardColumn.createColumn);
const mockRename = vi.mocked(boardColumn.renameColumn);
const mockSoftDelete = vi.mocked(boardColumn.softDeleteColumn);
const mockReorder = vi.mocked(boardColumn.reorderColumns);
const mockGetGroupId = vi.mocked(boardColumn.getColumnGroupId);

const mockListMyGroups = vi.mocked(groupKanban.listAccessibleGroupsForUser);
const mockBySlug = vi.mocked(groupKanban.getGroupBySlugForUser);
const mockMyAccess = vi.mocked(groupKanban.getGroupAccess);
const mockAssertView = vi.mocked(groupKanban.assertCanViewBoard);
const mockAssertAdmin = vi.mocked(groupKanban.assertCanAdminBoard);

function authedContext(roles: string[] = []): TRPCContext {
  return {
    user: {
      id: 'u1',
      email: 'a@b.com',
      displayName: 'A',
      avatarUrl: null,
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    activeRoles: roles as never,
    activeScopes: [],
  };
}

function publicContext(): TRPCContext {
  return { user: null, activeRoles: [], activeScopes: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── boardColumn router ──────────────────────────────────────────────────────

describe('boardColumn.listForGroup', () => {
  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.boardColumn.listForGroup({ groupId: 'g1' })).rejects.toBeInstanceOf(
      TRPCError,
    );
  });

  it("converts GroupAccessError('not_found') → NOT_FOUND", async () => {
    mockAssertView.mockRejectedValue(new GroupAccessError('not_found', 'no access'));
    const caller = createCaller(authedContext());
    await expect(caller.boardColumn.listForGroup({ groupId: 'g1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('passes isSystemAdmin from active roles', async () => {
    mockAssertView.mockResolvedValue({} as never);
    mockList.mockResolvedValue([]);
    const caller = createCaller(authedContext(['admin']));
    await caller.boardColumn.listForGroup({ groupId: 'g1' });
    expect(mockAssertView).toHaveBeenCalledWith({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: true,
    });
  });
});

describe('boardColumn.create', () => {
  it("converts GroupAccessError('forbidden') → FORBIDDEN", async () => {
    mockAssertAdmin.mockRejectedValue(new GroupAccessError('forbidden', 'admin only'));
    const caller = createCaller(authedContext());
    await expect(
      caller.boardColumn.create({ groupId: 'g1', displayName: 'New' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('calls createColumn with caller actorId', async () => {
    mockAssertAdmin.mockResolvedValue({} as never);
    mockCreate.mockResolvedValue({ id: 'c1', displayName: 'New' } as never);
    const caller = createCaller(authedContext());
    await caller.boardColumn.create({ groupId: 'g1', displayName: 'New' });
    expect(mockCreate).toHaveBeenCalledWith({
      groupId: 'g1',
      displayName: 'New',
      actorId: 'u1',
    });
  });
});

describe('boardColumn.rename', () => {
  it('returns NOT_FOUND when columnId resolves to no group', async () => {
    mockGetGroupId.mockResolvedValue(null);
    const caller = createCaller(authedContext());
    await expect(
      caller.boardColumn.rename({ columnId: 'cX', displayName: 'Active' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockAssertAdmin).not.toHaveBeenCalled();
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('looks up groupId then gates on assertCanAdminBoard', async () => {
    mockGetGroupId.mockResolvedValue('g1');
    mockAssertAdmin.mockResolvedValue({} as never);
    mockRename.mockResolvedValue({ id: 'c1' } as never);
    const caller = createCaller(authedContext());
    await caller.boardColumn.rename({ columnId: 'c1', displayName: 'Active' });
    expect(mockAssertAdmin).toHaveBeenCalledWith({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: false,
    });
  });
});

describe('boardColumn.reorder', () => {
  it('passes orderedIds + actorId to the service', async () => {
    mockAssertAdmin.mockResolvedValue({} as never);
    mockReorder.mockResolvedValue([]);
    const caller = createCaller(authedContext());
    await caller.boardColumn.reorder({ groupId: 'g1', orderedIds: ['c2', 'c1'] });
    expect(mockReorder).toHaveBeenCalledWith({
      groupId: 'g1',
      orderedIds: ['c2', 'c1'],
      actorId: 'u1',
    });
  });
});

describe('boardColumn.softDelete', () => {
  it('passes actorId after admin gate', async () => {
    mockGetGroupId.mockResolvedValue('g1');
    mockAssertAdmin.mockResolvedValue({} as never);
    mockSoftDelete.mockResolvedValue({ id: 'c1' } as never);
    const caller = createCaller(authedContext());
    await caller.boardColumn.softDelete({ columnId: 'c1' });
    expect(mockSoftDelete).toHaveBeenCalledWith({ columnId: 'c1', actorId: 'u1' });
  });
});

// ── groupKanban router ──────────────────────────────────────────────────────

describe('groupKanban.listMine', () => {
  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.groupKanban.listMine()).rejects.toBeInstanceOf(TRPCError);
  });

  it('passes caller userId + isSystemAdmin', async () => {
    mockListMyGroups.mockResolvedValue([]);
    const caller = createCaller(authedContext(['admin']));
    await caller.groupKanban.listMine();
    expect(mockListMyGroups).toHaveBeenCalledWith({
      userId: 'u1',
      isSystemAdmin: true,
    });
  });
});

describe('groupKanban.bySlug', () => {
  it('returns null when invisible (existence-masked)', async () => {
    mockBySlug.mockResolvedValue(null);
    const caller = createCaller(authedContext());
    const result = await caller.groupKanban.bySlug({ slug: 'unknown' });
    expect(result).toBeNull();
  });

  it('passes through the AccessibleGroup struct', async () => {
    mockBySlug.mockResolvedValue({
      group: { id: 'g1', slug: 'writers', displayName: 'Writers' } as never,
      access: {
        isMember: true,
        isGroupAdmin: false,
        isSystemAdmin: false,
        canViewBoard: true,
        canAdminBoard: false,
      },
    });
    const caller = createCaller(authedContext());
    const result = await caller.groupKanban.bySlug({ slug: 'writers' });
    expect(result?.group.slug).toBe('writers');
    expect(result?.access.canViewBoard).toBe(true);
  });
});

describe('groupKanban.myAccess', () => {
  it('returns the flags struct without throwing', async () => {
    mockMyAccess.mockResolvedValue({
      isMember: false,
      isGroupAdmin: false,
      isSystemAdmin: false,
      canViewBoard: false,
      canAdminBoard: false,
    });
    const caller = createCaller(authedContext());
    const result = await caller.groupKanban.myAccess({ groupId: 'g1' });
    expect(result.canViewBoard).toBe(false);
  });
});
