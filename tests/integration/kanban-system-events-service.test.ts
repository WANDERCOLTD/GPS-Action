/**
 * Unit tests for `emitKanbanSystemEvent` — the shared helper introduced
 * by atom 5d-3 of bu-coordination-board.
 *
 * Mocks the Prisma client per the repo's integration-test convention.
 * Mocks `isEventEnabled` directly so each test pins the gate boolean.
 *
 * Asserts:
 *   - dispatch + phrasing + write contract for every event kind
 *   - the disabled-flag short-circuit skips the write
 *   - missing actor / column / target-group rows silently no-op
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    comment: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    boardColumn: { findUnique: vi.fn() },
    group: { findUnique: vi.fn() },
  },
}));

vi.mock('@/server/services/kanban-event-config', () => ({
  isEventEnabled: vi.fn(),
}));

import { emitKanbanSystemEvent } from '@/server/services/kanban-system-events';
import { prisma } from '@/server/db/client';
import { isEventEnabled } from '@/server/services/kanban-event-config';

/* eslint-disable @typescript-eslint/no-explicit-any */
const commentCreate = vi.mocked(prisma.comment.create) as any;
const userFindUnique = vi.mocked(prisma.user.findUnique) as any;
const columnFindUnique = vi.mocked(prisma.boardColumn.findUnique) as any;
const groupFindUnique = vi.mocked(prisma.group.findUnique) as any;
const enabledMock = vi.mocked(isEventEnabled);

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue({ displayName: 'Sharon' });
  enabledMock.mockResolvedValue(true);
});

describe('emitKanbanSystemEvent — gating', () => {
  it('skips writing when the event kind is disabled', async () => {
    enabledMock.mockResolvedValueOnce(false);
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'column_move', newColumnId: 'c1' },
    });
    expect(commentCreate).not.toHaveBeenCalled();
  });

  it('writes Comment with kind=comment, source=system when enabled', async () => {
    columnFindUnique.mockResolvedValueOnce({ displayName: 'Preparation' });
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'column_move', newColumnId: 'c1' },
    });
    expect(commentCreate).toHaveBeenCalledWith({
      data: {
        requestId: 'r1',
        authorId: 'u1',
        body: 'Sharon moved this to Preparation.',
        kind: 'comment',
        source: 'system',
      },
    });
  });

  it('checks the matching toggle for each event kind', async () => {
    enabledMock.mockResolvedValue(false);
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'title_edit' },
    });
    expect(enabledMock).toHaveBeenCalledWith('title_edit');
  });

  it('skips writing when the actor row is missing', async () => {
    userFindUnique.mockResolvedValueOnce(null);
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u-gone',
      event: { kind: 'title_edit' },
    });
    expect(commentCreate).not.toHaveBeenCalled();
  });
});

describe('emitKanbanSystemEvent — phrasing', () => {
  it('phrases column_move with actor + new column name', async () => {
    columnFindUnique.mockResolvedValueOnce({ displayName: 'Review' });
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'column_move', newColumnId: 'c1' },
    });
    expect(commentCreate.mock.calls[0][0].data.body).toBe('Sharon moved this to Review.');
  });

  it('skips column_move silently when the column row is missing', async () => {
    columnFindUnique.mockResolvedValueOnce(null);
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'column_move', newColumnId: 'gone' },
    });
    expect(commentCreate).not.toHaveBeenCalled();
  });

  it('phrases status_change with capitalised status', async () => {
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'status_change', newStatus: 'backlog' },
    });
    expect(commentCreate.mock.calls[0][0].data.body).toBe('Sharon set status to Backlog.');
  });

  it('phrases title_edit', async () => {
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'title_edit' },
    });
    expect(commentCreate.mock.calls[0][0].data.body).toBe('Sharon renamed this ticket.');
  });

  it('phrases body_edit', async () => {
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'body_edit' },
    });
    expect(commentCreate.mock.calls[0][0].data.body).toBe('Sharon updated the description.');
  });

  it('phrases share_to_team with target group displayName', async () => {
    groupFindUnique.mockResolvedValueOnce({ displayName: 'Writers' });
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'share_to_team', targetGroupId: 'g2' },
    });
    expect(commentCreate.mock.calls[0][0].data.body).toBe('Sharon shared this with Writers.');
  });

  it('skips share_to_team silently when target group is missing', async () => {
    groupFindUnique.mockResolvedValueOnce(null);
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'share_to_team', targetGroupId: 'gone' },
    });
    expect(commentCreate).not.toHaveBeenCalled();
  });

  it('phrases assign_self', async () => {
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'assign_self' },
    });
    expect(commentCreate.mock.calls[0][0].data.body).toBe('Sharon claimed this ticket.');
  });

  it('phrases unassign_self', async () => {
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'unassign_self' },
    });
    expect(commentCreate.mock.calls[0][0].data.body).toBe('Sharon unclaimed this ticket.');
  });

  it('phrases urgent_on', async () => {
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'urgent_on' },
    });
    expect(commentCreate.mock.calls[0][0].data.body).toBe('Sharon marked this Urgent.');
  });

  it('phrases urgent_off', async () => {
    await emitKanbanSystemEvent({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'urgent_off' },
    });
    expect(commentCreate.mock.calls[0][0].data.body).toBe('Sharon cleared the Urgent flag.');
  });
});
