/**
 * Integration tests for editTicketTitle + editTicketBody (PR #5c).
 *
 * Mocks the Prisma client + audit log; asserts:
 *   - permission gate (404 when ticket not linked to viewer group)
 *   - 404 when Request missing
 *   - validation (empty title, length caps)
 *   - audit row written on change
 *   - idempotent: no audit when value unchanged
 *   - whitespace-only body collapses to null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    requestGroup: { findUnique: vi.fn() },
    request: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn(),
}));

vi.mock('@/server/services/kanban-system-events', () => ({
  emitKanbanSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

import { editTicketTitle, editTicketBody, EditTicketError } from '@/server/services/board';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { emitKanbanSystemEvent } from '@/server/services/kanban-system-events';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockedRequestGroup = vi.mocked(prisma.requestGroup) as any;
const mockedRequest = vi.mocked(prisma.request) as any;
const mockedAudit = vi.mocked(auditLog) as any;
const mockedEmitSystemEvent = vi.mocked(emitKanbanSystemEvent);

const baseInput = {
  requestId: 'r1',
  viewerGroupId: 'g1',
  actorId: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('editTicketTitle', () => {
  it('throws group_link_not_found when the viewer group has no link', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue(null);
    await expect(editTicketTitle({ ...baseInput, title: 'New title' })).rejects.toMatchObject({
      kind: 'group_link_not_found',
    });
    expect(mockedRequest.update).not.toHaveBeenCalled();
  });

  it('throws group_link_not_found when the link is soft-deleted', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({
      id: 'rg1',
      deletedAt: new Date(),
    });
    await expect(editTicketTitle({ ...baseInput, title: 'New title' })).rejects.toMatchObject({
      kind: 'group_link_not_found',
    });
  });

  it('throws title_empty when input is whitespace only', async () => {
    await expect(editTicketTitle({ ...baseInput, title: '   ' })).rejects.toMatchObject({
      kind: 'title_empty',
    });
    expect(mockedRequestGroup.findUnique).not.toHaveBeenCalled();
  });

  it('throws title_too_long when input exceeds the cap', async () => {
    await expect(editTicketTitle({ ...baseInput, title: 'x'.repeat(201) })).rejects.toMatchObject({
      kind: 'title_too_long',
    });
  });

  it('throws request_not_found when Request is missing or soft-deleted', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue(null);
    await expect(editTicketTitle({ ...baseInput, title: 'New title' })).rejects.toBeInstanceOf(
      EditTicketError,
    );
  });

  it('updates and audits when the title changes', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', title: 'Old title' });
    mockedRequest.update.mockResolvedValue({ id: 'r1', title: 'New title' });
    const result = await editTicketTitle({ ...baseInput, title: '  New title  ' });
    expect(mockedRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { title: 'New title' },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ticket_title_edited',
        entityType: 'Request',
        entityId: 'r1',
        userId: 'u1',
        changes: { title: { from: 'Old title', to: 'New title' } },
      }),
    );
    expect(result.title).toBe('New title');
  });

  it('is idempotent when the title is unchanged — no audit, no update', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', title: 'Same' });
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', title: 'Same' });
    await editTicketTitle({ ...baseInput, title: 'Same' });
    expect(mockedRequest.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('emits a title_edit system event on actual change', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', title: 'Old' });
    mockedRequest.update.mockResolvedValue({ id: 'r1', title: 'New' });
    await editTicketTitle({ ...baseInput, title: 'New' });
    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'title_edit' },
    });
  });

  it('does not emit a title_edit system event on idempotent no-op', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', title: 'Same' });
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', title: 'Same' });
    await editTicketTitle({ ...baseInput, title: 'Same' });
    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });
});

describe('editTicketBody', () => {
  it('writes null when input is empty string', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', body: 'Old body' });
    mockedRequest.update.mockResolvedValue({ id: 'r1', body: null });
    await editTicketBody({ ...baseInput, body: '' });
    expect(mockedRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { body: null },
    });
  });

  it('writes null when input is whitespace only', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', body: 'Old body' });
    mockedRequest.update.mockResolvedValue({ id: 'r1', body: null });
    await editTicketBody({ ...baseInput, body: '   \n\t  ' });
    expect(mockedRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { body: null },
    });
  });

  it('preserves leading/internal whitespace when content is non-empty', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', body: null });
    mockedRequest.update.mockResolvedValue({ id: 'r1', body: '  Hello\n  world' });
    await editTicketBody({ ...baseInput, body: '  Hello\n  world' });
    expect(mockedRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { body: '  Hello\n  world' },
    });
  });

  it('throws body_too_long when input exceeds the cap', async () => {
    await expect(editTicketBody({ ...baseInput, body: 'x'.repeat(10001) })).rejects.toMatchObject({
      kind: 'body_too_long',
    });
  });

  it('audits the body change with from/to', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', body: 'Old' });
    mockedRequest.update.mockResolvedValue({ id: 'r1', body: 'New' });
    await editTicketBody({ ...baseInput, body: 'New' });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ticket_body_edited',
        changes: { body: { from: 'Old', to: 'New' } },
      }),
    );
  });

  it('is idempotent when the normalised body is unchanged', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', body: null });
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', body: null });
    await editTicketBody({ ...baseInput, body: '' });
    expect(mockedRequest.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('emits a body_edit system event on actual change', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', body: 'Old' });
    mockedRequest.update.mockResolvedValue({ id: 'r1', body: 'New' });
    await editTicketBody({ ...baseInput, body: 'New' });
    expect(mockedEmitSystemEvent).toHaveBeenCalledWith({
      requestId: 'r1',
      actorId: 'u1',
      event: { kind: 'body_edit' },
    });
  });

  it('does not emit a body_edit system event on idempotent no-op', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', body: null });
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', body: null });
    await editTicketBody({ ...baseInput, body: '' });
    expect(mockedEmitSystemEvent).not.toHaveBeenCalled();
  });
});
