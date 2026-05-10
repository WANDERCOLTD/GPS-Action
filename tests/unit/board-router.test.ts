/**
 * Smoke tests for the board router (PR #4b).
 *
 * Mocks the underlying services. Asserts:
 *   - auth gate (UNAUTHORIZED) on every endpoint.
 *   - GroupAccessError → TRPCError NOT_FOUND / FORBIDDEN.
 *   - Permission rule: plain member without an assignment is FORBIDDEN.
 *   - Group admin / system admin / active assignee all pass.
 *   - BoardError kinds map to the right TRPCError code.
 *   - Successful mutations invoke the underlying service with the
 *     caller's actorId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('@/server/services/board', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    moveCard: vi.fn(),
    setRequestStatus: vi.fn(),
    listBoardCardsForGroup: vi.fn(),
    getTicketDetail: vi.fn(),
    deleteRequest: vi.fn(),
  };
});

vi.mock('@/server/services/assignments', () => ({
  isAssigneeActive: vi.fn(),
}));

vi.mock('@/server/services/group-kanban', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    assertCanViewBoard: vi.fn(),
  };
});

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import * as boardSvc from '@/server/services/board';
import { BoardError, DeleteRequestError } from '@/server/services/board';
import * as assignmentsSvc from '@/server/services/assignments';
import * as groupKanbanSvc from '@/server/services/group-kanban';
import { GroupAccessError } from '@/server/services/group-kanban';

const mockMoveCard = vi.mocked(boardSvc.moveCard);
const mockSetStatus = vi.mocked(boardSvc.setRequestStatus);
const mockListCards = vi.mocked(boardSvc.listBoardCardsForGroup);
const mockGetTicket = vi.mocked(boardSvc.getTicketDetail);
const mockDeleteRequest = vi.mocked(boardSvc.deleteRequest);
const mockIsAssignee = vi.mocked(assignmentsSvc.isAssigneeActive);
const mockAssertView = vi.mocked(groupKanbanSvc.assertCanViewBoard);

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

const memberAccess = {
  isMember: true,
  isGroupAdmin: false,
  isSystemAdmin: false,
  canViewBoard: true,
  canAdminBoard: false,
};
const adminAccess = {
  isMember: true,
  isGroupAdmin: true,
  isSystemAdmin: false,
  canViewBoard: true,
  canAdminBoard: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

const moveInput = {
  requestId: 'r1',
  groupId: 'g1',
  destination: { lane: 'active' as const, columnId: 'c1' },
};

describe('board.listCards', () => {
  const listInput = { groupId: 'g1' };

  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.board.listCards(listInput)).rejects.toBeInstanceOf(TRPCError);
  });

  it("converts GroupAccessError('not_found') → NOT_FOUND", async () => {
    mockAssertView.mockRejectedValue(new GroupAccessError('not_found', 'no access'));
    const caller = createCaller(authedContext());
    await expect(caller.board.listCards(listInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns the card list for an authorised viewer', async () => {
    mockAssertView.mockResolvedValue(memberAccess);
    mockListCards.mockResolvedValue([
      {
        id: 'r1',
        title: 'X',
        kindSlug: null,
        kindDisplayName: null,
        isUrgent: false,
        status: 'active',
        columnId: 'c1',
        boardPosition: '0',
        assignees: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const caller = createCaller(authedContext());
    const result = await caller.board.listCards(listInput);
    expect(result).toHaveLength(1);
    expect(mockListCards).toHaveBeenCalledWith('g1', { status: undefined });
  });
});

describe('board.getTicket', () => {
  const ticketInput = { requestId: 'r1', groupId: 'g1' };
  const stubTicket = {
    id: 'r1',
    title: 'Write press release',
    body: null,
    status: 'active' as const,
    urgency: false,
    kindSlug: null,
    kindDisplayName: null,
    createdByUserId: 'u-author',
    assignees: [],
    subscribers: [],
    groups: [
      {
        groupId: 'g1',
        slug: 'writers',
        displayName: 'Writers',
        origin: 'originating' as const,
        isUrgent: false,
        columnId: 'c1',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
  };

  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.board.getTicket(ticketInput)).rejects.toBeInstanceOf(TRPCError);
  });

  it("converts GroupAccessError('not_found') → NOT_FOUND", async () => {
    mockAssertView.mockRejectedValue(new GroupAccessError('not_found', 'no access'));
    const caller = createCaller(authedContext());
    await expect(caller.board.getTicket(ticketInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockGetTicket).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the ticket is not linked to the viewer group', async () => {
    mockAssertView.mockResolvedValue(memberAccess);
    mockGetTicket.mockResolvedValue(null);
    const caller = createCaller(authedContext());
    await expect(caller.board.getTicket(ticketInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns the ticket detail when authorised + linked', async () => {
    mockAssertView.mockResolvedValue(memberAccess);
    mockGetTicket.mockResolvedValue(stubTicket);
    const caller = createCaller(authedContext());
    const result = await caller.board.getTicket(ticketInput);
    expect(result.id).toBe('r1');
    expect(result.title).toBe('Write press release');
    expect(mockGetTicket).toHaveBeenCalledWith({ requestId: 'r1', viewerGroupId: 'g1' });
  });

  it('passes isSystemAdmin from active roles', async () => {
    mockAssertView.mockResolvedValue({ ...memberAccess, isSystemAdmin: true });
    mockGetTicket.mockResolvedValue(stubTicket);
    const caller = createCaller(authedContext(['admin']));
    await caller.board.getTicket(ticketInput);
    expect(mockAssertView).toHaveBeenCalledWith({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: true,
    });
  });
});

describe('board.moveCard', () => {
  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.board.moveCard(moveInput)).rejects.toBeInstanceOf(TRPCError);
  });

  it("converts GroupAccessError('not_found') → NOT_FOUND", async () => {
    mockAssertView.mockRejectedValue(new GroupAccessError('not_found', 'no access'));
    const caller = createCaller(authedContext());
    await expect(caller.board.moveCard(moveInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a plain member without an active assignment', async () => {
    mockAssertView.mockResolvedValue(memberAccess);
    mockIsAssignee.mockResolvedValue(false);
    const caller = createCaller(authedContext());
    await expect(caller.board.moveCard(moveInput)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockMoveCard).not.toHaveBeenCalled();
  });

  it('allows a member who has an active assignment', async () => {
    mockAssertView.mockResolvedValue(memberAccess);
    mockIsAssignee.mockResolvedValue(true);
    mockMoveCard.mockResolvedValue({
      request: { id: 'r1' },
      requestGroup: { id: 'rg1' },
      isOriginating: true,
      status: 'active',
    } as never);
    const caller = createCaller(authedContext());
    const result = await caller.board.moveCard(moveInput);
    expect(result.isOriginating).toBe(true);
    expect(mockMoveCard).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u1' }));
  });

  it('allows a group admin without checking assignment', async () => {
    mockAssertView.mockResolvedValue(adminAccess);
    mockMoveCard.mockResolvedValue({
      request: { id: 'r1' },
      requestGroup: { id: 'rg1' },
      isOriginating: true,
      status: 'active',
    } as never);
    const caller = createCaller(authedContext());
    await caller.board.moveCard(moveInput);
    expect(mockIsAssignee).not.toHaveBeenCalled();
    expect(mockMoveCard).toHaveBeenCalled();
  });

  it('passes isSystemAdmin from active roles', async () => {
    mockAssertView.mockResolvedValue({
      ...adminAccess,
      isGroupAdmin: false,
      isSystemAdmin: true,
    });
    mockMoveCard.mockResolvedValue({} as never);
    const caller = createCaller(authedContext(['admin']));
    await caller.board.moveCard(moveInput);
    expect(mockAssertView).toHaveBeenCalledWith({
      groupId: 'g1',
      userId: 'u1',
      isSystemAdmin: true,
    });
  });

  it('coerces nullish before/after to null when calling the service', async () => {
    mockAssertView.mockResolvedValue(adminAccess);
    mockMoveCard.mockResolvedValue({} as never);
    const caller = createCaller(authedContext());
    await caller.board.moveCard(moveInput);
    expect(mockMoveCard).toHaveBeenCalledWith(
      expect.objectContaining({ beforeRequestId: null, afterRequestId: null }),
    );
  });

  it("maps BoardError('request_not_found') → NOT_FOUND", async () => {
    mockAssertView.mockResolvedValue(adminAccess);
    mockMoveCard.mockRejectedValue(new BoardError('request_not_found', 'gone'));
    const caller = createCaller(authedContext());
    await expect(caller.board.moveCard(moveInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it("maps BoardError('group_link_not_found') → NOT_FOUND", async () => {
    mockAssertView.mockResolvedValue(adminAccess);
    mockMoveCard.mockRejectedValue(new BoardError('group_link_not_found', 'gone'));
    const caller = createCaller(authedContext());
    await expect(caller.board.moveCard(moveInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it("maps BoardError('shared_off_board_forbidden') → FORBIDDEN", async () => {
    mockAssertView.mockResolvedValue(adminAccess);
    mockMoveCard.mockRejectedValue(new BoardError('shared_off_board_forbidden', 'no'));
    const caller = createCaller(authedContext());
    await expect(
      caller.board.moveCard({ ...moveInput, destination: { lane: 'backlog' } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("maps BoardError('column_not_in_group') → BAD_REQUEST", async () => {
    mockAssertView.mockResolvedValue(adminAccess);
    mockMoveCard.mockRejectedValue(new BoardError('column_not_in_group', 'wrong'));
    const caller = createCaller(authedContext());
    await expect(caller.board.moveCard(moveInput)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('board.setStatus', () => {
  const setInput = { requestId: 'r1', groupId: 'g1', status: 'abandoned' as const };

  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.board.setStatus(setInput)).rejects.toBeInstanceOf(TRPCError);
  });

  it('rejects a plain member without assignment', async () => {
    mockAssertView.mockResolvedValue(memberAccess);
    mockIsAssignee.mockResolvedValue(false);
    const caller = createCaller(authedContext());
    await expect(caller.board.setStatus(setInput)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it('allows a group admin to mark abandoned', async () => {
    mockAssertView.mockResolvedValue(adminAccess);
    mockSetStatus.mockResolvedValue({ id: 'r1', status: 'abandoned' } as never);
    const caller = createCaller(authedContext());
    const result = await caller.board.setStatus(setInput);
    expect(result.status).toBe('abandoned');
    expect(mockSetStatus).toHaveBeenCalledWith({
      requestId: 'r1',
      status: 'abandoned',
      actorId: 'u1',
    });
  });

  it("maps BoardError('request_not_found') → NOT_FOUND", async () => {
    mockAssertView.mockResolvedValue(adminAccess);
    mockSetStatus.mockRejectedValue(new BoardError('request_not_found', 'missing'));
    const caller = createCaller(authedContext());
    await expect(caller.board.setStatus(setInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('board.delete (Item 13 — bu-ticket-view-fixes Sub-build B)', () => {
  const deleteInput = { requestId: 'r1' };
  const stubResult = {
    title: 'My ticket',
    originatingGroupId: 'g1',
    status: 'active' as const,
  };

  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.board.delete(deleteInput)).rejects.toBeInstanceOf(TRPCError);
  });

  it('passes actorId + isSystemAdmin to the service', async () => {
    mockDeleteRequest.mockResolvedValue(stubResult);
    const caller = createCaller(authedContext(['admin']));
    await caller.board.delete(deleteInput);
    expect(mockDeleteRequest).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      isSystemAdmin: true,
    });
  });

  it('returns the service result shape (title + originatingGroupId + status)', async () => {
    mockDeleteRequest.mockResolvedValue(stubResult);
    const caller = createCaller(authedContext());
    const result = await caller.board.delete(deleteInput);
    expect(result).toEqual(stubResult);
  });

  it("maps DeleteRequestError('forbidden') → FORBIDDEN", async () => {
    mockDeleteRequest.mockRejectedValue(new DeleteRequestError('forbidden', 'nope'));
    const caller = createCaller(authedContext());
    await expect(caller.board.delete(deleteInput)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("maps DeleteRequestError('request_not_found') → NOT_FOUND", async () => {
    mockDeleteRequest.mockRejectedValue(new DeleteRequestError('request_not_found', 'missing'));
    const caller = createCaller(authedContext());
    await expect(caller.board.delete(deleteInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
