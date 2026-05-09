/**
 * Smoke tests for the Share + Notifications-kanban routers (PR 3c).
 *
 * Mocks the underlying services. Asserts:
 *   - auth gate on every endpoint.
 *   - share router resolves caller's group access before delegating.
 *   - ShareError → TRPCError mapping (kind → code).
 *   - notification-kanban router passes caller userId / scope through.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('@/server/services/request-group', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    shareRequestToGroup: vi.fn(),
    unshareRequestFromGroup: vi.fn(),
    listGroupsForRequest: vi.fn(),
    checkAccessLossOnUnshare: vi.fn(),
    addShareWorkflow: vi.fn(),
    removeShareWorkflow: vi.fn(),
    listShareWorkflowTargets: vi.fn(),
  };
});

vi.mock('@/server/services/group-kanban', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getGroupAccess: vi.fn(),
    assertCanViewBoard: vi.fn(),
    assertCanAdminBoard: vi.fn(),
  };
});

vi.mock('@/server/services/notifications-kanban', () => ({
  acknowledgeNotification: vi.fn(),
  dismissNotification: vi.fn(),
  listKanbanInboxForUser: vi.fn(),
  countNewForUser: vi.fn(),
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import * as requestGroup from '@/server/services/request-group';
import * as groupKanban from '@/server/services/group-kanban';
import * as notifKanban from '@/server/services/notifications-kanban';
import { ShareError } from '@/server/services/request-group';
import { GroupAccessError } from '@/server/services/group-kanban';

const mockShare = vi.mocked(requestGroup.shareRequestToGroup);
const mockUnshare = vi.mocked(requestGroup.unshareRequestFromGroup);
const mockListGroups = vi.mocked(requestGroup.listGroupsForRequest);
const mockCheckAccessLoss = vi.mocked(requestGroup.checkAccessLossOnUnshare);
const mockAddWorkflow = vi.mocked(requestGroup.addShareWorkflow);
const mockRemoveWorkflow = vi.mocked(requestGroup.removeShareWorkflow);
const mockListTargets = vi.mocked(requestGroup.listShareWorkflowTargets);

const mockGetAccess = vi.mocked(groupKanban.getGroupAccess);
const mockAssertView = vi.mocked(groupKanban.assertCanViewBoard);
const mockAssertAdmin = vi.mocked(groupKanban.assertCanAdminBoard);

const mockAck = vi.mocked(notifKanban.acknowledgeNotification);
const mockDismiss = vi.mocked(notifKanban.dismissNotification);
const mockInbox = vi.mocked(notifKanban.listKanbanInboxForUser);
const mockCountNew = vi.mocked(notifKanban.countNewForUser);

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

// ── share router ──────────────────────────────────────────────────────────

describe('share.toGroup', () => {
  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(
      caller.share.toGroup({
        requestId: 'r1',
        sourceGroupId: 'g1',
        targetGroupId: 'g2',
        mode: 'workflow',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('returns NOT_FOUND when source group is invisible to caller', async () => {
    mockGetAccess.mockResolvedValue({
      isMember: false,
      isGroupAdmin: false,
      isSystemAdmin: false,
      canViewBoard: false,
      canAdminBoard: false,
    });
    const caller = createCaller(authedContext());
    await expect(
      caller.share.toGroup({
        requestId: 'r1',
        sourceGroupId: 'gX',
        targetGroupId: 'g2',
        mode: 'workflow',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('passes isGroupAdminOfSource + isSystemAdmin to the service', async () => {
    mockGetAccess.mockResolvedValue({
      isMember: true,
      isGroupAdmin: true,
      isSystemAdmin: false,
      canViewBoard: true,
      canAdminBoard: true,
    });
    mockShare.mockResolvedValue({
      row: { id: 'rg1' } as never,
      created: true,
      reactivated: false,
    });

    const caller = createCaller(authedContext());
    await caller.share.toGroup({
      requestId: 'r1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      mode: 'ad_hoc',
    });

    expect(mockShare).toHaveBeenCalledWith({
      requestId: 'r1',
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      mode: 'ad_hoc',
      actorId: 'u1',
      isSystemAdmin: false,
      isGroupAdminOfSource: true,
    });
  });

  it("ShareError('self_share') → BAD_REQUEST", async () => {
    mockGetAccess.mockResolvedValue({
      isMember: true,
      isGroupAdmin: false,
      isSystemAdmin: false,
      canViewBoard: true,
      canAdminBoard: false,
    });
    mockShare.mockRejectedValue(new ShareError('self_share', 'no'));
    const caller = createCaller(authedContext());
    await expect(
      caller.share.toGroup({
        requestId: 'r1',
        sourceGroupId: 'g1',
        targetGroupId: 'g1',
        mode: 'workflow',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it("ShareError('forbidden_ad_hoc') → FORBIDDEN", async () => {
    mockGetAccess.mockResolvedValue({
      isMember: true,
      isGroupAdmin: false,
      isSystemAdmin: false,
      canViewBoard: true,
      canAdminBoard: false,
    });
    mockShare.mockRejectedValue(new ShareError('forbidden_ad_hoc', 'admin only'));
    const caller = createCaller(authedContext());
    await expect(
      caller.share.toGroup({
        requestId: 'r1',
        sourceGroupId: 'g1',
        targetGroupId: 'g2',
        mode: 'ad_hoc',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('share.fromGroup — Item 4 unshare permissions (Q1)', () => {
  // Per Q1 of bu-ticket-view-fixes Sub-build B: unshare allowed if
  // caller is a system admin, OR a member of the *target* group ("leave
  // the share"), OR a member of the *originating* group (revoke the
  // share). Idempotent — receiving-team self-unshare must not error.
  const inviz = {
    isMember: false,
    isGroupAdmin: false,
    isSystemAdmin: false,
    canViewBoard: false,
    canAdminBoard: false,
  };
  const targetMember = {
    isMember: true,
    isGroupAdmin: false,
    isSystemAdmin: false,
    canViewBoard: true,
    canAdminBoard: false,
  };

  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.share.fromGroup({ requestId: 'r1', groupId: 'g2' })).rejects.toBeInstanceOf(
      TRPCError,
    );
  });

  it('receiving-team member (target-group member) succeeds', async () => {
    mockGetAccess.mockResolvedValue(targetMember);
    mockUnshare.mockResolvedValue({ id: 'rg1', deletedAt: new Date() } as never);
    const caller = createCaller(authedContext());
    const result = await caller.share.fromGroup({ requestId: 'r1', groupId: 'g2' });
    expect(result.ok).toBe(true);
    expect(mockUnshare).toHaveBeenCalledWith({
      requestId: 'r1',
      groupId: 'g2',
      actorId: 'u1',
    });
    // Should NOT have queried originating-group fallback when target
    // membership already grants access — keeps the common case cheap.
    expect(mockListGroups).not.toHaveBeenCalled();
  });

  it('originating-team member (not in target group) succeeds via fallback', async () => {
    // First getGroupAccess call (target group) → forbidden.
    // listGroupsForRequest exposes the originating group id.
    // Second getGroupAccess call (originating group) → permitted.
    mockGetAccess.mockResolvedValueOnce(inviz);
    mockListGroups.mockResolvedValue([
      {
        link: { id: 'rg1', origin: 'originating', deletedAt: null } as never,
        group: { id: 'gOrig', displayName: 'Writers' } as never,
      },
      {
        link: { id: 'rg2', origin: 'workflow_share', deletedAt: null } as never,
        group: { id: 'g2', displayName: 'IT' } as never,
      },
    ]);
    mockGetAccess.mockResolvedValueOnce(targetMember); // permitted on origin

    mockUnshare.mockResolvedValue({ id: 'rg2', deletedAt: new Date() } as never);
    const caller = createCaller(authedContext());

    const result = await caller.share.fromGroup({ requestId: 'r1', groupId: 'g2' });

    expect(result.ok).toBe(true);
    expect(mockGetAccess).toHaveBeenCalledTimes(2);
    expect(mockListGroups).toHaveBeenCalledWith('r1');
    expect(mockUnshare).toHaveBeenCalled();
  });

  it('uninvolved third-party member (neither team) → NOT_FOUND', async () => {
    mockGetAccess.mockResolvedValueOnce(inviz);
    mockListGroups.mockResolvedValue([
      {
        link: { id: 'rg1', origin: 'originating', deletedAt: null } as never,
        group: { id: 'gOrig', displayName: 'Writers' } as never,
      },
    ]);
    mockGetAccess.mockResolvedValueOnce(inviz);

    const caller = createCaller(authedContext());
    await expect(caller.share.fromGroup({ requestId: 'r1', groupId: 'g2' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(mockUnshare).not.toHaveBeenCalled();
  });

  it('system admin succeeds even without target membership', async () => {
    mockGetAccess.mockResolvedValue({
      ...inviz,
      isSystemAdmin: true,
      canViewBoard: true,
    });
    mockUnshare.mockResolvedValue({ id: 'rg1', deletedAt: new Date() } as never);
    const caller = createCaller(authedContext(['admin']));
    const result = await caller.share.fromGroup({ requestId: 'r1', groupId: 'g2' });
    expect(result.ok).toBe(true);
  });

  it('idempotent — returns ok=true even when share was already gone', async () => {
    // The service returns null when no row exists; our router maps that
    // to ok=true so a receiving-team member's self-unshare never errors.
    mockGetAccess.mockResolvedValue(targetMember);
    mockUnshare.mockResolvedValue(null);
    const caller = createCaller(authedContext());
    const result = await caller.share.fromGroup({ requestId: 'r1', groupId: 'g2' });
    expect(result.ok).toBe(true);
  });

  it('idempotent — returns ok=true on a second unshare (already soft-deleted)', async () => {
    mockGetAccess.mockResolvedValue(targetMember);
    // Second call: service returns the existing deleted row.
    mockUnshare.mockResolvedValue({
      id: 'rg2',
      deletedAt: new Date('2026-04-30'),
    } as never);
    const caller = createCaller(authedContext());
    const result = await caller.share.fromGroup({ requestId: 'r1', groupId: 'g2' });
    expect(result.ok).toBe(true);
  });
});

describe('share.checkAccessLoss (Item 4 — bu-ticket-view-fixes Sub-build B)', () => {
  it('passes through service result', async () => {
    mockCheckAccessLoss.mockResolvedValue({ status: 'active', accessLost: true });
    const caller = createCaller(authedContext());
    const result = await caller.share.checkAccessLoss({
      requestId: 'r1',
      groupId: 'g2',
    });
    expect(result).toEqual({ status: 'active', accessLost: true });
    expect(mockCheckAccessLoss).toHaveBeenCalledWith('r1', 'g2');
  });

  it('returns null when the request does not exist', async () => {
    mockCheckAccessLoss.mockResolvedValue(null);
    const caller = createCaller(authedContext());
    const result = await caller.share.checkAccessLoss({
      requestId: 'rX',
      groupId: 'g2',
    });
    expect(result).toBeNull();
  });
});

describe('share.listGroupsForRequest', () => {
  it('passes through service result', async () => {
    mockListGroups.mockResolvedValue([]);
    const caller = createCaller(authedContext());
    const result = await caller.share.listGroupsForRequest({ requestId: 'r1' });
    expect(result).toEqual([]);
  });
});

describe('share.addWorkflow', () => {
  it("GroupAccessError('forbidden') from admin gate → FORBIDDEN", async () => {
    mockAssertAdmin.mockRejectedValue(new GroupAccessError('forbidden', 'admin only'));
    const caller = createCaller(authedContext());
    await expect(
      caller.share.addWorkflow({ sourceGroupId: 'g1', targetGroupId: 'g2' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('calls service with caller actorId after admin gate passes', async () => {
    mockAssertAdmin.mockResolvedValue({} as never);
    mockAddWorkflow.mockResolvedValue({
      row: { id: 'w1' } as never,
      created: true,
      reactivated: false,
    });
    const caller = createCaller(authedContext());
    await caller.share.addWorkflow({ sourceGroupId: 'g1', targetGroupId: 'g2' });
    expect(mockAddWorkflow).toHaveBeenCalledWith({
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
      actorId: 'u1',
    });
  });
});

describe('share.removeWorkflow', () => {
  it('returns ok=false when no row existed', async () => {
    mockAssertAdmin.mockResolvedValue({} as never);
    mockRemoveWorkflow.mockResolvedValue(null);
    const caller = createCaller(authedContext());
    const result = await caller.share.removeWorkflow({
      sourceGroupId: 'g1',
      targetGroupId: 'g2',
    });
    expect(result.ok).toBe(false);
  });
});

describe('share.listWorkflowTargets', () => {
  it('gates on assertCanViewBoard before reading', async () => {
    mockAssertView.mockResolvedValue({} as never);
    mockListTargets.mockResolvedValue([]);
    const caller = createCaller(authedContext());
    await caller.share.listWorkflowTargets({ sourceGroupId: 'g1' });
    expect(mockAssertView).toHaveBeenCalled();
    expect(mockListTargets).toHaveBeenCalledWith('g1');
  });
});

// ── notificationKanban router ────────────────────────────────────────────

describe('notificationKanban.acknowledge', () => {
  it('rejects unauthenticated', async () => {
    const caller = createCaller(publicContext());
    await expect(
      caller.notificationKanban.acknowledge({ notificationId: 'n1' }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('passes caller userId', async () => {
    mockAck.mockResolvedValue({ ok: true });
    const caller = createCaller(authedContext());
    const result = await caller.notificationKanban.acknowledge({ notificationId: 'n1' });
    expect(mockAck).toHaveBeenCalledWith({ notificationId: 'n1', userId: 'u1' });
    expect(result.ok).toBe(true);
  });
});

describe('notificationKanban.dismiss', () => {
  it('passes caller userId', async () => {
    mockDismiss.mockResolvedValue({ ok: true });
    const caller = createCaller(authedContext());
    await caller.notificationKanban.dismiss({ notificationId: 'n1' });
    expect(mockDismiss).toHaveBeenCalledWith({ notificationId: 'n1', userId: 'u1' });
  });
});

describe('notificationKanban.inbox', () => {
  it('passes scope + limit through to the service', async () => {
    mockInbox.mockResolvedValue([]);
    const caller = createCaller(authedContext());
    await caller.notificationKanban.inbox({ scope: 'new', limit: 25 });
    expect(mockInbox).toHaveBeenCalledWith({
      userId: 'u1',
      scope: 'new',
      limit: 25,
    });
  });

  it('passes undefined scope/limit when omitted (service applies defaults)', async () => {
    mockInbox.mockResolvedValue([]);
    const caller = createCaller(authedContext());
    await caller.notificationKanban.inbox({});
    expect(mockInbox).toHaveBeenCalledWith({
      userId: 'u1',
      scope: undefined,
      limit: undefined,
    });
  });
});

describe('notificationKanban.newCount', () => {
  it('returns the service count', async () => {
    mockCountNew.mockResolvedValue(3);
    const caller = createCaller(authedContext());
    const result = await caller.notificationKanban.newCount();
    expect(result.count).toBe(3);
    expect(mockCountNew).toHaveBeenCalledWith('u1');
  });
});
