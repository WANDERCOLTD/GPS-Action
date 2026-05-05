/**
 * Integration tests for listBoardCardsForGroup (PR #4d, updated PR #5a).
 *
 * Mocks the Prisma client; asserts:
 *   - filters by groupId, deletedAt null, columnId not null,
 *     request.deletedAt null, request.status active.
 *   - sorts by columnId, then boardPosition asc.
 *   - per-link state (columnId, boardPosition, isUrgent) drives the
 *     card; Request.status flows through unchanged.
 *   - title flows from typed Request.title (ADR-0013 / D079; no
 *     runtime fallback — DB-level sentinel default covers missing
 *     rows).
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
          title: 'Write press release',
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

  it("propagates the typed Request.title — DB sentinel '(Untitled)' covers missing rows", async () => {
    // ADR-0013 / D079: with the typed column + DB-level default, the
    // service no longer applies a runtime fallback. Rows that slipped
    // past the back-fill arrive here already carrying '(Untitled)'.
    mockedRequestGroup.findMany.mockResolvedValue([
      {
        columnId: 'c1',
        boardPosition: new Prisma.Decimal(0),
        isUrgent: false,
        request: {
          id: 'r1',
          status: 'active',
          title: '(Untitled)',
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
          title: 'Real title',
          createdAt: new Date(),
          updatedAt: new Date(),
          kind: null,
          assignments: [],
        },
      },
    ]);

    const cards = await listBoardCardsForGroup('g1');
    expect(cards.map((c) => c.title)).toEqual(['(Untitled)', 'Real title']);
  });

  it("filters by Request.status when status='backlog' is passed (off-board)", async () => {
    mockedRequestGroup.findMany.mockResolvedValue([]);
    await listBoardCardsForGroup('g1', { status: 'backlog' });
    expect(mockedRequestGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          groupId: 'g1',
          deletedAt: null,
          columnId: null,
          request: { deletedAt: null, status: 'backlog' },
        },
        orderBy: [{ boardPosition: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  });

  it("filters by Request.status when status='done' is passed (off-board)", async () => {
    mockedRequestGroup.findMany.mockResolvedValue([]);
    await listBoardCardsForGroup('g1', { status: 'done' });
    expect(mockedRequestGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          columnId: null,
          request: { deletedAt: null, status: 'done' },
        }),
      }),
    );
  });

  it('preserves columnId null in the BoardCard shape for off-board cards', async () => {
    mockedRequestGroup.findMany.mockResolvedValue([
      {
        columnId: null,
        boardPosition: new Prisma.Decimal(0),
        isUrgent: false,
        request: {
          id: 'r1',
          status: 'backlog',
          title: 'Pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          kind: null,
          assignments: [],
        },
      },
    ]);
    const cards = await listBoardCardsForGroup('g1', { status: 'backlog' });
    expect(cards[0]?.columnId).toBeNull();
    expect(cards[0]?.status).toBe('backlog');
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
          title: 'X',
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
