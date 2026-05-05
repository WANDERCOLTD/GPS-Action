/**
 * Integration tests for the comment-thread service (kanban ticket
 * thread). Exercises the visibility filter:
 *
 *   - originating-group viewer → sees comments + notes
 *   - shared-group viewer       → sees comments only
 *   - request with no originating link → comments only (defensive)
 *
 * @build-unit bu-coordination-board (atom 5d-1)
 * @spec docs/build/session-handoffs/parallel-stream-b-comment-thread-2026-05-05.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    requestGroup: { findFirst: vi.fn(), findMany: vi.fn() },
    groupMembership: { findMany: vi.fn() },
    request: { findFirst: vi.fn() },
    comment: { findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import {
  listForKanbanTicket,
  getCommentThreadAccess,
  createCommentForKanbanTicket,
} from '@/server/services/comment-thread';
import { prisma } from '@/server/db/client';

const mockOriginatingFind = vi.mocked(prisma.requestGroup.findFirst);
const mockRequestGroupFindMany = vi.mocked(prisma.requestGroup.findMany);
const mockMembershipFindMany = vi.mocked(prisma.groupMembership.findMany);
const mockRequestFindFirst = vi.mocked(prisma.request.findFirst);
const mockCommentFindMany = vi.mocked(prisma.comment.findMany);
const mockCommentCreate = vi.mocked(prisma.comment.create);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditCreate.mockResolvedValue({} as never);
});

describe('listForKanbanTicket — visibility filter', () => {
  it('originating-group viewer sees comment + note rows interleaved oldest-first', async () => {
    mockOriginatingFind.mockResolvedValueOnce({ groupId: 'g-writers' } as never);
    mockCommentFindMany.mockResolvedValueOnce([
      {
        id: 'c1',
        body: 'shared comment',
        kind: 'comment',
        source: 'human',
        createdAt: new Date('2026-05-05T10:00:00Z'),
        author: { id: 'u1', displayName: 'Sharon', avatarUrl: null },
      },
      {
        id: 'n1',
        body: 'team-only note',
        kind: 'note',
        source: 'human',
        createdAt: new Date('2026-05-05T10:05:00Z'),
        author: { id: 'u2', displayName: 'Bette', avatarUrl: 'https://x/a.png' },
      },
    ] as never);

    const rows = await listForKanbanTicket({
      requestId: 'r1',
      viewerGroupId: 'g-writers',
      viewerId: 'u-viewer',
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.kind).toBe('comment');
    expect(rows[1]?.kind).toBe('note');

    const findManyArgs = mockCommentFindMany.mock.calls[0]![0]!;
    expect(findManyArgs.where).toMatchObject({
      requestId: 'r1',
      deletedAt: null,
      kind: { in: ['comment', 'note'] },
    });
    expect(findManyArgs.orderBy).toEqual({ createdAt: 'asc' });
  });

  it('shared-group viewer sees comments only — note kind excluded from filter', async () => {
    mockOriginatingFind.mockResolvedValueOnce({ groupId: 'g-writers' } as never);
    mockCommentFindMany.mockResolvedValueOnce([] as never);

    await listForKanbanTicket({
      requestId: 'r1',
      viewerGroupId: 'g-it',
      viewerId: 'u-viewer',
    });

    const findManyArgs = mockCommentFindMany.mock.calls[0]![0]!;
    expect(findManyArgs.where).toMatchObject({
      kind: { in: ['comment'] },
    });
  });

  it('falls back to comments only when the request has no originating link (defensive)', async () => {
    mockOriginatingFind.mockResolvedValueOnce(null);
    mockCommentFindMany.mockResolvedValueOnce([] as never);

    await listForKanbanTicket({
      requestId: 'r1',
      viewerGroupId: 'g-writers',
      viewerId: 'u-viewer',
    });

    const findManyArgs = mockCommentFindMany.mock.calls[0]![0]!;
    expect(findManyArgs.where).toMatchObject({
      kind: { in: ['comment'] },
    });
  });

  it('maps Prisma row → CommentThreadRow shape (author projection + kind/source)', async () => {
    mockOriginatingFind.mockResolvedValueOnce({ groupId: 'g-writers' } as never);
    mockCommentFindMany.mockResolvedValueOnce([
      {
        id: 'c1',
        body: 'hi',
        kind: 'comment',
        source: 'human',
        createdAt: new Date('2026-05-05T10:00:00Z'),
        author: { id: 'u1', displayName: 'Sharon', avatarUrl: 'https://x/a.png' },
      },
    ] as never);

    const rows = await listForKanbanTicket({
      requestId: 'r1',
      viewerGroupId: 'g-writers',
      viewerId: 'u-viewer',
    });

    expect(rows[0]).toEqual({
      id: 'c1',
      body: 'hi',
      kind: 'comment',
      source: 'human',
      createdAt: new Date('2026-05-05T10:00:00Z'),
      author: { id: 'u1', displayName: 'Sharon', avatarUrl: 'https://x/a.png' },
    });
  });
});

describe('getCommentThreadAccess', () => {
  it('sysadmin gets canComment + canPostNote without DB lookups', async () => {
    const access = await getCommentThreadAccess({
      requestId: 'r1',
      userId: 'u-admin',
      isSystemAdmin: true,
    });
    expect(access).toEqual({ canComment: true, canPostNote: true });
    expect(mockRequestGroupFindMany).not.toHaveBeenCalled();
    expect(mockMembershipFindMany).not.toHaveBeenCalled();
  });

  it('non-member of any link → both gates false', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([
      { groupId: 'g-writers', origin: 'originating' },
      { groupId: 'g-it', origin: 'workflow_share' },
    ] as never);
    mockMembershipFindMany.mockResolvedValueOnce([] as never);

    const access = await getCommentThreadAccess({
      requestId: 'r1',
      userId: 'u-outsider',
      isSystemAdmin: false,
    });
    expect(access).toEqual({ canComment: false, canPostNote: false });
  });

  it('shared-group member → canComment but not canPostNote', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([
      { groupId: 'g-writers', origin: 'originating' },
      { groupId: 'g-it', origin: 'workflow_share' },
    ] as never);
    mockMembershipFindMany.mockResolvedValueOnce([{ groupId: 'g-it' }] as never);

    const access = await getCommentThreadAccess({
      requestId: 'r1',
      userId: 'u-it',
      isSystemAdmin: false,
    });
    expect(access).toEqual({ canComment: true, canPostNote: false });
  });

  it('originating-group member → both gates true', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([
      { groupId: 'g-writers', origin: 'originating' },
      { groupId: 'g-it', origin: 'workflow_share' },
    ] as never);
    mockMembershipFindMany.mockResolvedValueOnce([{ groupId: 'g-writers' }] as never);

    const access = await getCommentThreadAccess({
      requestId: 'r1',
      userId: 'u-writer',
      isSystemAdmin: false,
    });
    expect(access).toEqual({ canComment: true, canPostNote: true });
  });

  it('request with zero links → both gates false', async () => {
    mockRequestGroupFindMany.mockResolvedValueOnce([] as never);

    const access = await getCommentThreadAccess({
      requestId: 'r-orphan',
      userId: 'u1',
      isSystemAdmin: false,
    });
    expect(access).toEqual({ canComment: false, canPostNote: false });
    expect(mockMembershipFindMany).not.toHaveBeenCalled();
  });
});

describe('createCommentForKanbanTicket', () => {
  it('writes comment with kind/source and trims body', async () => {
    mockRequestFindFirst.mockResolvedValueOnce({ id: 'r1' } as never);
    mockCommentCreate.mockResolvedValueOnce({ id: 'c1' } as never);

    const result = await createCommentForKanbanTicket({
      requestId: 'r1',
      authorId: 'u1',
      body: '  hello team  ',
      kind: 'comment',
    });

    expect(result).toEqual({ id: 'c1' });
    expect(mockCommentCreate).toHaveBeenCalledWith({
      data: {
        requestId: 'r1',
        authorId: 'u1',
        body: 'hello team',
        kind: 'comment',
        source: 'human',
      },
      select: { id: true },
    });
    expect(mockAuditCreate).toHaveBeenCalledOnce();
  });

  it('writes note with kind=note + audit action kanban_note.add', async () => {
    mockRequestFindFirst.mockResolvedValueOnce({ id: 'r1' } as never);
    mockCommentCreate.mockResolvedValueOnce({ id: 'c2' } as never);

    await createCommentForKanbanTicket({
      requestId: 'r1',
      authorId: 'u-writer',
      body: 'internal note',
      kind: 'note',
    });

    expect(mockCommentCreate.mock.calls[0]![0]!.data.kind).toBe('note');
    expect(mockAuditCreate.mock.calls[0]![0]!.data.action).toBe('kanban_note.add');
  });

  it('throws when request is missing or soft-deleted', async () => {
    mockRequestFindFirst.mockResolvedValueOnce(null);

    await expect(
      createCommentForKanbanTicket({
        requestId: 'r-gone',
        authorId: 'u1',
        body: 'hi',
        kind: 'comment',
      }),
    ).rejects.toThrow('Request not found');
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });
});
