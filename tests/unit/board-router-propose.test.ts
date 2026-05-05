/**
 * Unit tests for board.propose tRPC mutation (Surface 1 — propose-to-backlog).
 *
 * Asserts the permission gate (any group viewer or sysadmin), input
 * validation via zod, and the BAD_REQUEST passthrough for service
 * validation errors.
 *
 * @build-unit bu-coordination-board
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => {
  const tx = {
    request: { create: vi.fn() },
    requestGroup: { create: vi.fn() },
    requestSubscription: { create: vi.fn() },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      __tx: tx,
      auditLog: { create: vi.fn() },
      group: { findFirst: vi.fn() },
      groupMembership: { findFirst: vi.fn() },
    },
  };
});

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const tx = (
  prisma as unknown as {
    __tx: {
      request: { create: ReturnType<typeof vi.fn> };
      requestGroup: { create: ReturnType<typeof vi.fn> };
      requestSubscription: { create: ReturnType<typeof vi.fn> };
    };
  }
).__tx;

const mockGroupFindFirst = vi.mocked(prisma.group.findFirst);
const mockMembershipFindFirst = vi.mocked(prisma.groupMembership.findFirst);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);

function ctx(role: 'member' | 'admin' = 'member'): TRPCContext {
  return {
    user: {
      id: 'u-1',
      email: 't@t.com',
      displayName: 'T',
      avatarUrl: null,
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    activeRoles: role === 'admin' ? ['admin'] : [],
    activeScopes: [],
  };
}

function publicCtx(): TRPCContext {
  return { user: null, activeRoles: [], activeScopes: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditCreate.mockResolvedValue({} as never);
  tx.request.create.mockResolvedValue({ id: 'r-new' } as never);
  tx.requestGroup.create.mockResolvedValue({ id: 'rg-new' } as never);
  tx.requestSubscription.create.mockResolvedValue({} as never);
});

describe('board.propose — permission gate', () => {
  it('UNAUTHORIZED when no user', async () => {
    const caller = createCaller(publicCtx());
    await expect(
      caller.board.propose({ groupId: 'g-1', title: 'Hi', body: null }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('NOT_FOUND when caller is not a member of the group', async () => {
    mockGroupFindFirst.mockResolvedValueOnce({ id: 'g-1' } as never);
    mockMembershipFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctx());
    await expect(
      caller.board.propose({ groupId: 'g-1', title: 'Hi', body: null }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tx.request.create).not.toHaveBeenCalled();
  });

  it('writes the ticket when caller is a group member', async () => {
    mockGroupFindFirst.mockResolvedValueOnce({ id: 'g-1' } as never);
    mockMembershipFindFirst.mockResolvedValueOnce({ role: 'member' } as never);

    const caller = createCaller(ctx());
    const result = await caller.board.propose({
      groupId: 'g-1',
      title: 'New banner pitch',
      body: 'context here',
    });
    expect(result).toEqual({ ok: true, requestId: 'r-new' });
    expect(tx.request.create).toHaveBeenCalledOnce();
  });

  it('sysadmin bypasses membership check', async () => {
    mockGroupFindFirst.mockResolvedValueOnce({ id: 'g-1' } as never);
    mockMembershipFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctx('admin'));
    const result = await caller.board.propose({
      groupId: 'g-1',
      title: 'Admin propose',
      body: null,
    });
    expect(result).toEqual({ ok: true, requestId: 'r-new' });
  });
});

describe('board.propose — validation', () => {
  it('rejects empty title via zod (BAD_REQUEST)', async () => {
    const caller = createCaller(ctx());
    await expect(
      caller.board.propose({ groupId: 'g-1', title: '', body: null }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
