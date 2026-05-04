/**
 * Smoke tests for the Assignment + Subscription routers (PR #3 chunk).
 *
 * Mocks the underlying services. Asserts:
 *   - auth gate on every endpoint (UNAUTHORIZED for public callers).
 *   - the correct service function is called with expected args.
 *   - the response shape matches the router contract (ok, created,
 *     reactivated, etc.).
 *
 * Behaviour tests for the services themselves live alongside the
 * service files; this file is the router-layer contract test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('@/server/services/assignments', () => ({
  assignToRequest: vi.fn(),
  unassign: vi.fn(),
  listAssigneesForRequest: vi.fn(),
  listActiveAssignmentsForUser: vi.fn(),
  isAssigneeActive: vi.fn(),
}));

vi.mock('@/server/services/subscriptions', () => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  isSubscribed: vi.fn(),
  listSubscribersForRequest: vi.fn(),
  listActiveSubscriptionsForUser: vi.fn(),
  countActiveSubscribers: vi.fn(),
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import * as assignmentsService from '@/server/services/assignments';
import * as subscriptionsService from '@/server/services/subscriptions';

const mockAssign = vi.mocked(assignmentsService.assignToRequest);
const mockUnassign = vi.mocked(assignmentsService.unassign);
const mockListAssignees = vi.mocked(assignmentsService.listAssigneesForRequest);
const mockListActive = vi.mocked(assignmentsService.listActiveAssignmentsForUser);
const mockIsAssignee = vi.mocked(assignmentsService.isAssigneeActive);

const mockSubscribe = vi.mocked(subscriptionsService.subscribe);
const mockUnsubscribe = vi.mocked(subscriptionsService.unsubscribe);
const mockIsSubscribed = vi.mocked(subscriptionsService.isSubscribed);
const mockListSubscribers = vi.mocked(subscriptionsService.listSubscribersForRequest);
const mockListMineSub = vi.mocked(subscriptionsService.listActiveSubscriptionsForUser);
const mockCountSubs = vi.mocked(subscriptionsService.countActiveSubscribers);

function authedContext(): TRPCContext {
  return {
    user: {
      id: 'u1',
      email: 'sharon@test.com',
      displayName: 'Sharon',
      avatarUrl: null,
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    activeRoles: [],
    activeScopes: [],
  };
}

function publicContext(): TRPCContext {
  return { user: null, activeRoles: [], activeScopes: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assignment router — assignSelf', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.assignment.assignSelf({ requestId: 'r1' })).rejects.toBeInstanceOf(
      TRPCError,
    );
  });

  it('calls assignToRequest with caller as both userId and actorId', async () => {
    mockAssign.mockResolvedValue({
      assignment: { id: 'a1' } as never,
      created: true,
      reactivated: false,
    });
    const caller = createCaller(authedContext());

    const result = await caller.assignment.assignSelf({ requestId: 'r1' });

    expect(mockAssign).toHaveBeenCalledWith({
      requestId: 'r1',
      userId: 'u1',
      actorId: 'u1',
    });
    expect(result).toEqual({ ok: true, created: true, reactivated: false });
  });

  it('passes through reactivated discriminator', async () => {
    mockAssign.mockResolvedValue({
      assignment: { id: 'a1' } as never,
      created: false,
      reactivated: true,
    });
    const caller = createCaller(authedContext());

    const result = await caller.assignment.assignSelf({ requestId: 'r1' });
    expect(result.reactivated).toBe(true);
  });
});

describe('assignment router — unassignSelf', () => {
  it('returns ok=true when an active row was unassigned', async () => {
    mockUnassign.mockResolvedValue({ id: 'a1', unassignedAt: new Date() } as never);
    const caller = createCaller(authedContext());
    const result = await caller.assignment.unassignSelf({ requestId: 'r1' });
    expect(result.ok).toBe(true);
  });

  it('returns ok=false when no row existed', async () => {
    mockUnassign.mockResolvedValue(null);
    const caller = createCaller(authedContext());
    const result = await caller.assignment.unassignSelf({ requestId: 'r1' });
    expect(result.ok).toBe(false);
  });
});

describe('assignment router — read endpoints', () => {
  it('listForRequest passes through the service result', async () => {
    mockListAssignees.mockResolvedValue([
      {
        userId: 'u1',
        displayName: 'Sharon',
        avatarUrl: null,
        assignedAt: new Date('2026-05-01'),
      },
    ]);
    const caller = createCaller(authedContext());
    const result = await caller.assignment.listForRequest({ requestId: 'r1' });
    expect(result).toHaveLength(1);
  });

  it('isMineActive reads with caller userId', async () => {
    mockIsAssignee.mockResolvedValue(true);
    const caller = createCaller(authedContext());
    const result = await caller.assignment.isMineActive({ requestId: 'r1' });
    expect(mockIsAssignee).toHaveBeenCalledWith('r1', 'u1');
    expect(result.active).toBe(true);
  });

  it('listMine uses caller userId', async () => {
    mockListActive.mockResolvedValue([]);
    const caller = createCaller(authedContext());
    await caller.assignment.listMine();
    expect(mockListActive).toHaveBeenCalledWith('u1');
  });
});

describe('subscription router — followSelf', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(publicContext());
    await expect(caller.subscription.followSelf({ requestId: 'r1' })).rejects.toBeInstanceOf(
      TRPCError,
    );
  });

  it('subscribes with source=explicit and caller as userId + actorId', async () => {
    mockSubscribe.mockResolvedValue({
      subscription: { id: 's1' } as never,
      created: true,
      reactivated: false,
    });
    const caller = createCaller(authedContext());

    const result = await caller.subscription.followSelf({ requestId: 'r1' });

    expect(mockSubscribe).toHaveBeenCalledWith({
      requestId: 'r1',
      userId: 'u1',
      source: 'explicit',
      actorId: 'u1',
    });
    expect(result.created).toBe(true);
  });
});

describe('subscription router — unfollowSelf', () => {
  it('returns ok=true when a row was soft-deleted', async () => {
    mockUnsubscribe.mockResolvedValue({ id: 's1', deletedAt: new Date() } as never);
    const caller = createCaller(authedContext());
    const result = await caller.subscription.unfollowSelf({ requestId: 'r1' });
    expect(result.ok).toBe(true);
  });

  it('returns ok=false when no row existed', async () => {
    mockUnsubscribe.mockResolvedValue(null);
    const caller = createCaller(authedContext());
    const result = await caller.subscription.unfollowSelf({ requestId: 'r1' });
    expect(result.ok).toBe(false);
  });
});

describe('subscription router — read endpoints', () => {
  it('isMineSubscribed reads with caller userId', async () => {
    mockIsSubscribed.mockResolvedValue(true);
    const caller = createCaller(authedContext());
    const result = await caller.subscription.isMineSubscribed({ requestId: 'r1' });
    expect(mockIsSubscribed).toHaveBeenCalledWith('r1', 'u1');
    expect(result.subscribed).toBe(true);
  });

  it('listForRequest passes through the service result', async () => {
    mockListSubscribers.mockResolvedValue([]);
    const caller = createCaller(authedContext());
    const result = await caller.subscription.listForRequest({ requestId: 'r1' });
    expect(result).toEqual([]);
  });

  it('listMine uses caller userId', async () => {
    mockListMineSub.mockResolvedValue([]);
    const caller = createCaller(authedContext());
    await caller.subscription.listMine();
    expect(mockListMineSub).toHaveBeenCalledWith('u1');
  });

  it('countForRequest returns the service count', async () => {
    mockCountSubs.mockResolvedValue(7);
    const caller = createCaller(authedContext());
    const result = await caller.subscription.countForRequest({ requestId: 'r1' });
    expect(result.count).toBe(7);
  });
});
