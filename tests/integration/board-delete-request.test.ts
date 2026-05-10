/**
 * Integration tests for `deleteRequest` (bu-ticket-view-fixes /
 * Sub-build B — Item 13).
 *
 * Mocks the Prisma client + audit; asserts:
 *   - 'request_not_found' when the row is missing or soft-deleted.
 *   - 'forbidden' when caller is neither originator nor sysadmin.
 *   - originator passes the gate.
 *   - sysadmin passes the gate even when not originator.
 *   - hard delete is invoked (`prisma.request.delete`).
 *   - audit row carries title + originatingGroupId + status + isOriginator.
 *   - returns `{ title, originatingGroupId, status }` shape.
 *   - `lastActivityAt` bump helper is NOT called (row is gone).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    request: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/services/request-activity', () => ({
  touchRequestActivity: vi.fn(),
}));

import { deleteRequest, DeleteRequestError } from '@/server/services/board';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { touchRequestActivity } from '@/server/services/request-activity';

const mockedRequest = vi.mocked(prisma.request);
const mockedAudit = vi.mocked(auditLog);
const mockedTouch = vi.mocked(touchRequestActivity);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deleteRequest — gate', () => {
  it("throws 'request_not_found' when the row is missing", async () => {
    mockedRequest.findFirst.mockResolvedValue(null);
    await expect(
      deleteRequest({ requestId: 'r1', actorId: 'u1', isSystemAdmin: false }),
    ).rejects.toMatchObject({ name: 'DeleteRequestError', kind: 'request_not_found' });
    expect(mockedRequest.delete).not.toHaveBeenCalled();
  });

  it("throws 'forbidden' for a non-originator non-admin", async () => {
    mockedRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: 't',
      status: 'active',
      createdByUserId: 'someone-else',
      requestGroups: [{ groupId: 'g1' }],
    } as never);

    await expect(
      deleteRequest({ requestId: 'r1', actorId: 'u1', isSystemAdmin: false }),
    ).rejects.toMatchObject({ kind: 'forbidden' });
    expect(mockedRequest.delete).not.toHaveBeenCalled();
  });

  it('originator passes the gate', async () => {
    mockedRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: 'Important ticket',
      status: 'active',
      createdByUserId: 'u1',
      requestGroups: [{ groupId: 'g1' }],
    } as never);
    mockedRequest.delete.mockResolvedValue({ id: 'r1' } as never);

    const result = await deleteRequest({
      requestId: 'r1',
      actorId: 'u1',
      isSystemAdmin: false,
    });

    expect(mockedRequest.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(result).toEqual({
      title: 'Important ticket',
      originatingGroupId: 'g1',
      status: 'active',
    });
  });

  it('system admin passes the gate even when not the originator', async () => {
    mockedRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: 't',
      status: 'backlog',
      createdByUserId: 'someone-else',
      requestGroups: [{ groupId: 'g1' }],
    } as never);
    mockedRequest.delete.mockResolvedValue({ id: 'r1' } as never);

    const result = await deleteRequest({
      requestId: 'r1',
      actorId: 'u1',
      isSystemAdmin: true,
    });

    expect(mockedRequest.delete).toHaveBeenCalled();
    expect(result.status).toBe('backlog');
  });
});

describe('deleteRequest — side effects', () => {
  beforeEach(() => {
    mockedRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: 'Important ticket',
      status: 'done',
      createdByUserId: 'u1',
      requestGroups: [{ groupId: 'g1' }],
    } as never);
    mockedRequest.delete.mockResolvedValue({ id: 'r1' } as never);
  });

  it('writes an audit row with title + originatingGroupId + status', async () => {
    await deleteRequest({ requestId: 'r1', actorId: 'u1', isSystemAdmin: false });

    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'request_deleted',
        entityType: 'Request',
        entityId: 'r1',
        userId: 'u1',
        changes: { title: 'Important ticket' },
        context: expect.objectContaining({
          originatingGroupId: 'g1',
          status: 'done',
          isOriginator: true,
        }),
      }),
    );
  });

  it('does NOT bump `lastActivityAt` (row is gone)', async () => {
    await deleteRequest({ requestId: 'r1', actorId: 'u1', isSystemAdmin: false });
    expect(mockedTouch).not.toHaveBeenCalled();
  });

  it('handles missing originating link gracefully (returns null id)', async () => {
    mockedRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: 'Orphan',
      status: 'active',
      createdByUserId: 'u1',
      requestGroups: [],
    } as never);

    const result = await deleteRequest({
      requestId: 'r1',
      actorId: 'u1',
      isSystemAdmin: false,
    });

    expect(result.originatingGroupId).toBeNull();
  });
});

describe('DeleteRequestError', () => {
  it('exposes kind for routers to convert to TRPCError codes', () => {
    const e = new DeleteRequestError('forbidden', 'no');
    expect(e.kind).toBe('forbidden');
    expect(e.name).toBe('DeleteRequestError');
  });
});
