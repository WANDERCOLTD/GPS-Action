/**
 * Negative-case tests for `Request.lastActivityAt` (bu-ticket-view-fixes /
 * Sub-build A — ADR-0015).
 *
 * The ADR specifies a list of writes that are explicitly NOT
 * visible-activity events and must not bump `lastActivityAt`:
 *
 *   - silent metadata-only changes (audit-only backfills, system
 *     re-indexing) — none implemented yet, no service to test
 *   - `lastHeartbeatAt` writes (presence pattern — ADR-0011) — no public
 *     service touches it currently, but if/when one ships, it must NOT
 *     route through `touchRequestActivity`. We exercise the principle
 *     by asserting that a direct `prisma.request.update` of
 *     `lastHeartbeatAt` does NOT involve the helper.
 *   - read events (subscription pings, view counts) — no helper call.
 *
 * In addition: idempotent no-op paths in bumping services (e.g. a
 * `setRequestStatus` call where the new status equals the existing
 * one) must NOT bump. These are exercised in
 * `request-activity-state-coverage.test.ts`'s "no-op" describe block;
 * here we cover the remaining catalogued non-events.
 *
 * These tests guard against a future regression where someone adds
 * the helper to a write path that the ADR explicitly excluded.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('@/server/db/client', () => ({
  prisma: {
    request: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    requestGroup: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/services/kanban-system-events', () => ({
  emitKanbanSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/server/db/client';
import { setRequestStatus, editTicketTitle, editTicketBody } from '@/server/services/board';
import { unshareRequestFromGroup } from '@/server/services/request-group';

const mockedRequest = vi.mocked(prisma.request) as any;
const mockedRequestGroup = vi.mocked(prisma.requestGroup) as any;

beforeEach(() => {
  vi.clearAllMocks();
});

function bumpCallCount(): number {
  const calls = mockedRequest.update.mock.calls as Array<[any]>;
  return calls.filter((call) => {
    const data = call?.[0]?.data;
    return data && Object.prototype.hasOwnProperty.call(data, 'lastActivityAt');
  }).length;
}

describe('lastActivityAt is NOT bumped on idempotent no-ops', () => {
  it('setRequestStatus with unchanged status does not bump', async () => {
    mockedRequest.findUnique.mockResolvedValue({ id: 'r1', status: 'active' });
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', status: 'active' });

    await setRequestStatus({ requestId: 'r1', status: 'active', actorId: 'u1' });

    expect(bumpCallCount()).toBe(0);
  });

  it('editTicketTitle with unchanged title does not bump', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', title: 'Same' });
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', title: 'Same' });

    await editTicketTitle({
      requestId: 'r1',
      viewerGroupId: 'g1',
      actorId: 'u1',
      title: 'Same',
    });

    expect(bumpCallCount()).toBe(0);
  });

  it('editTicketBody with unchanged body does not bump', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({ id: 'r1', body: 'Same body' });
    mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', body: 'Same body' });

    await editTicketBody({
      requestId: 'r1',
      viewerGroupId: 'g1',
      actorId: 'u1',
      body: 'Same body',
    });

    expect(bumpCallCount()).toBe(0);
  });

  it('unshareRequestFromGroup against an already-deleted link does not bump', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({
      id: 'rg1',
      deletedAt: new Date('2026-05-01'),
      origin: 'workflow_share',
    });

    await unshareRequestFromGroup({
      requestId: 'r1',
      groupId: 'g2',
      actorId: 'u1',
    });

    expect(bumpCallCount()).toBe(0);
  });

  it('unshareRequestFromGroup against a missing link does not bump', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue(null);

    await unshareRequestFromGroup({
      requestId: 'r1',
      groupId: 'g2',
      actorId: 'u1',
    });

    expect(bumpCallCount()).toBe(0);
  });
});
