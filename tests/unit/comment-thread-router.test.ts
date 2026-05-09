/**
 * Unit tests for the kanban comment-thread tRPC router (atom 5d-2).
 *
 * Asserts the permission gate: postNote requires originating-team
 * membership; postComment accepts any-link membership; sysadmin gets
 * both. listForRequest reflects visibility downstream of the same gate.
 *
 * @build-unit bu-coordination-board
 * @spec docs/build/session-handoffs/parallel-stream-b-comment-thread-2026-05-05.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    request: { findFirst: vi.fn(), update: vi.fn() },
    requestGroup: { findFirst: vi.fn(), findMany: vi.fn() },
    groupMembership: { findMany: vi.fn() },
    comment: { create: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const mockRequestFindFirst = vi.mocked(prisma.request.findFirst);
const mockRequestGroupFindFirst = vi.mocked(prisma.requestGroup.findFirst);
const mockRequestGroupFindMany = vi.mocked(prisma.requestGroup.findMany);
const mockMembershipFindMany = vi.mocked(prisma.groupMembership.findMany);
const mockCommentCreate = vi.mocked(prisma.comment.create);
const mockCommentFindMany = vi.mocked(prisma.comment.findMany);
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
});

describe('commentThread.postComment', () => {
  it('UNAUTHORIZED when no user', async () => {
    const caller = createCaller(publicCtx());
    await expect(
      caller.commentThread.postComment({ requestId: 'r1', body: 'hi' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('FORBIDDEN when caller is not a member of any linked group', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([
      { groupId: 'g-writers', origin: 'originating' },
    ] as never);
    mockMembershipFindMany.mockResolvedValueOnce([] as never);

    const caller = createCaller(ctx());
    await expect(
      caller.commentThread.postComment({ requestId: 'r1', body: 'hi' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('writes a comment when caller is a shared-team member', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([
      { groupId: 'g-writers', origin: 'originating' },
      { groupId: 'g-it', origin: 'workflow_share' },
    ] as never);
    mockMembershipFindMany.mockResolvedValueOnce([{ groupId: 'g-it' }] as never);
    mockRequestFindFirst.mockResolvedValueOnce({ id: 'r1' } as never);
    mockCommentCreate.mockResolvedValueOnce({ id: 'c1' } as never);

    const caller = createCaller(ctx());
    const result = await caller.commentThread.postComment({
      requestId: 'r1',
      body: 'cross-team comment',
    });
    expect(result).toEqual({ id: 'c1' });
    expect(mockCommentCreate.mock.calls[0]![0]!.data.kind).toBe('comment');
    expect(mockCommentCreate.mock.calls[0]![0]!.data.source).toBe('human');
  });
});

describe('commentThread.postNote', () => {
  it('FORBIDDEN when caller is a shared-team member but not on originating team', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([
      { groupId: 'g-writers', origin: 'originating' },
      { groupId: 'g-it', origin: 'workflow_share' },
    ] as never);
    mockMembershipFindMany.mockResolvedValueOnce([{ groupId: 'g-it' }] as never);

    const caller = createCaller(ctx());
    await expect(
      caller.commentThread.postNote({ requestId: 'r1', body: 'note?' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('writes a note when caller is on the originating team', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([
      { groupId: 'g-writers', origin: 'originating' },
    ] as never);
    mockMembershipFindMany.mockResolvedValueOnce([{ groupId: 'g-writers' }] as never);
    mockRequestFindFirst.mockResolvedValueOnce({ id: 'r1' } as never);
    mockCommentCreate.mockResolvedValueOnce({ id: 'n1' } as never);

    const caller = createCaller(ctx());
    const result = await caller.commentThread.postNote({
      requestId: 'r1',
      body: 'team-only note',
    });
    expect(result).toEqual({ id: 'n1' });
    expect(mockCommentCreate.mock.calls[0]![0]!.data.kind).toBe('note');
  });

  it('sysadmin can post a note even with no group memberships', async () => {
    mockRequestFindFirst.mockResolvedValueOnce({ id: 'r1' } as never);
    mockCommentCreate.mockResolvedValueOnce({ id: 'n2' } as never);

    const caller = createCaller(ctx('admin'));
    const result = await caller.commentThread.postNote({
      requestId: 'r1',
      body: 'admin note',
    });
    expect(result).toEqual({ id: 'n2' });
    expect(mockRequestGroupFindMany).not.toHaveBeenCalled();
  });
});

describe('commentThread.listForRequest', () => {
  it('FORBIDDEN when caller has no linked-group membership', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([
      { groupId: 'g-writers', origin: 'originating' },
    ] as never);
    mockMembershipFindMany.mockResolvedValueOnce([] as never);

    const caller = createCaller(ctx());
    await expect(
      caller.commentThread.listForRequest({
        requestId: 'r1',
        viewerGroupId: 'g-writers',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('reads thread with note kind for originating-group viewer', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([
      { groupId: 'g-writers', origin: 'originating' },
    ] as never);
    mockMembershipFindMany.mockResolvedValueOnce([{ groupId: 'g-writers' }] as never);
    mockRequestGroupFindFirst.mockResolvedValueOnce({ groupId: 'g-writers' } as never);
    mockCommentFindMany.mockResolvedValueOnce([] as never);

    const caller = createCaller(ctx());
    await caller.commentThread.listForRequest({
      requestId: 'r1',
      viewerGroupId: 'g-writers',
    });
    expect(mockCommentFindMany.mock.calls[0]![0]!.where).toMatchObject({
      kind: { in: ['comment', 'note'] },
    });
  });
});
