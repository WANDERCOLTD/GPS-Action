/**
 * Integration tests for listBoardCardsForGroup (PR #4d).
 *
 * Mocks the Prisma client; asserts:
 *   - filters by groupId, deletedAt null, columnId not null,
 *     request.deletedAt null, request.status active.
 *   - sorts by columnId, then boardPosition asc.
 *   - per-link state (columnId, boardPosition, isUrgent) drives the
 *     card; Request.status flows through unchanged.
 *   - title resolves from request.context.title with a sane fallback.
 *   - assignees come through ordered + mapped to the BoardCardAssignee
 *     shape.
 *   - boardPosition is serialised to string at the boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/server/db/client', () => ({
  prisma: {
    requestGroup: {
      findMany: vi.fn(),
    },
  },
}));

import { listBoardCardsForGroup } from '@/server/services/board';
import { prisma } from '@/server/db/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockedRequestGroup = vi.mocked(prisma.requestGroup) as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listBoardCardsForGroup', () => {
  it('issues the right where + orderBy filter', async () => {
    mockedRequestGroup.findMany.mockResolvedValue([]);
    await listBoardCardsForGroup('g1');
    expect(mockedRequestGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          groupId: 'g1',
          deletedAt: null,
          columnId: { not: null },
          request: { deletedAt: null, status: 'active' },
        },
        orderBy: [{ columnId: 'asc' }, { boardPosition: 'asc' }],
      }),
    );
  });

  it('maps per-link state + request fields into the BoardCard shape', async () => {
    mockedRequestGroup.findMany.mockResolvedValue([
      {
        columnId: 'c1',
        boardPosition: new Prisma.Decimal(512),
        isUrgent: true,
        request: {
          id: 'r1',
          status: 'active',
          context: { title: 'Write press release' },
          createdAt: new Date('2026-05-01'),
          updatedAt: new Date('2026-05-04'),
          kind: { slug: 'task', displayName: 'Task' },
          assignments: [
            {
              user: { id: 'u1', displayName: 'Alice', avatarUrl: null },
            },
          ],
        },
      },
    ]);

    const cards = await listBoardCardsForGroup('g1');
    expect(cards).toEqual([
      {
        id: 'r1',
        title: 'Write press release',
        kindSlug: 'task',
        kindDisplayName: 'Task',
        isUrgent: true,
        status: 'active',
        columnId: 'c1',
        boardPosition: '512',
        assignees: [{ userId: 'u1', displayName: 'Alice', avatarUrl: null }],
        createdAt: new Date('2026-05-01'),
        updatedAt: new Date('2026-05-04'),
      },
    ]);
  });

  it("falls back to '(Untitled)' when context.title is missing or non-string", async () => {
    mockedRequestGroup.findMany.mockResolvedValue([
      {
        columnId: 'c1',
        boardPosition: new Prisma.Decimal(0),
        isUrgent: false,
        request: {
          id: 'r1',
          status: 'active',
          context: { other: 'no title here' },
          createdAt: new Date(),
          updatedAt: new Date(),
          kind: null,
          assignments: [],
        },
      },
      {
        columnId: 'c1',
        boardPosition: new Prisma.Decimal(1),
        isUrgent: false,
        request: {
          id: 'r2',
          status: 'active',
          context: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          kind: null,
          assignments: [],
        },
      },
      {
        columnId: 'c1',
        boardPosition: new Prisma.Decimal(2),
        isUrgent: false,
        request: {
          id: 'r3',
          status: 'active',
          context: { title: 42 },
          createdAt: new Date(),
          updatedAt: new Date(),
          kind: null,
          assignments: [],
        },
      },
    ]);

    const cards = await listBoardCardsForGroup('g1');
    expect(cards.map((c) => c.title)).toEqual(['(Untitled)', '(Untitled)', '(Untitled)']);
  });

  it('returns boardPosition as a string for client serialisation safety', async () => {
    mockedRequestGroup.findMany.mockResolvedValue([
      {
        columnId: 'c1',
        boardPosition: new Prisma.Decimal('123.5'),
        isUrgent: false,
        request: {
          id: 'r1',
          status: 'active',
          context: { title: 'X' },
          createdAt: new Date(),
          updatedAt: new Date(),
          kind: null,
          assignments: [],
        },
      },
    ]);
    const cards = await listBoardCardsForGroup('g1');
    expect(typeof cards[0]?.boardPosition).toBe('string');
    expect(cards[0]?.boardPosition).toBe('123.5');
  });
});
