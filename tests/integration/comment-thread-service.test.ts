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
    requestGroup: { findFirst: vi.fn() },
    comment: { findMany: vi.fn() },
  },
}));

import { listForKanbanTicket } from '@/server/services/comment-thread';
import { prisma } from '@/server/db/client';

const mockOriginatingFind = vi.mocked(prisma.requestGroup.findFirst);
const mockCommentFindMany = vi.mocked(prisma.comment.findMany);

beforeEach(() => {
  vi.clearAllMocks();
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
