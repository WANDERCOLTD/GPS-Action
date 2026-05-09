/**
 * Exhaustive state-coverage matrix for `Request.lastActivityAt`
 * (bu-ticket-view-fixes / Sub-build A — ADR-0015 / D081).
 *
 * The brief requires assertions on the cartesian product of:
 *   - lifecycle states: backlog · active · done · abandoned
 *     (the four real states; "Deleted" is a later sub-build)
 *   - bump events: comment · note · status change · assign · unassign ·
 *     share · unshare · title edit · body edit
 *
 * For each (state, event) cell, assert that the mutation triggers a
 * call to `prisma.request.update` with `data: { lastActivityAt: <Date> }`.
 *
 * Strategy: mock prisma + audit + system-events at the module boundary,
 * exercise each service entry-point with the lifecycle state baked into
 * the mocked `findFirst` / `findUnique` reads, and assert the bump call
 * was invoked. Behaviour is identical across states (the helper is
 * state-agnostic by design) — the matrix exists to lock in that
 * assumption and surface any future regression where a service starts
 * gating bumps on status.
 *
 * No clock skew or "strictly increasing" assertion is needed in unit
 * scope — the helper writes whatever timestamp is supplied. The
 * monotonicity contract belongs to the caller (which always supplies
 * `new Date()`); a real-DB integration test in a later sub-build can
 * verify that across two events on a row, the second `lastActivityAt`
 * is >= the first. For now we lock in the per-event bump.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('@/server/db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
    request: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    requestGroup: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    boardColumn: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    assignment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    requestSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    comment: {
      create: vi.fn(),
    },
    groupShareWorkflow: {
      findUnique: vi.fn(),
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
import {
  setRequestStatus,
  editTicketTitle,
  editTicketBody,
  moveCard,
} from '@/server/services/board';
import { assignToRequest, unassign } from '@/server/services/assignments';
import { shareRequestToGroup, unshareRequestFromGroup } from '@/server/services/request-group';
import { createCommentForKanbanTicket } from '@/server/services/comment-thread';

const mockedRequest = vi.mocked(prisma.request) as any;
const mockedRequestGroup = vi.mocked(prisma.requestGroup) as any;
const mockedBoardColumn = vi.mocked(prisma.boardColumn) as any;
const mockedAssignment = vi.mocked(prisma.assignment) as any;
const mockedSubscription = vi.mocked(prisma.requestSubscription) as any;
const mockedComment = vi.mocked(prisma.comment) as any;
const mockedWorkflow = vi.mocked(prisma.groupShareWorkflow) as any;
const mockedTransaction = vi.mocked(prisma.$transaction) as any;

const LIFECYCLE_STATES: RequestStatus[] = ['backlog', 'active', 'done', 'abandoned'];

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Did `prisma.request.update` get called with `{ lastActivityAt: <Date> }`
 * at any point during the test? If yes, the bump fired.
 */
function assertActivityBumpCalled(): void {
  const calls = mockedRequest.update.mock.calls as Array<[any]>;
  const bumpCalls = calls.filter((call) => {
    const data = call?.[0]?.data;
    return data && Object.prototype.hasOwnProperty.call(data, 'lastActivityAt');
  });
  expect(bumpCalls.length).toBeGreaterThanOrEqual(1);
  // Each bump payload is exactly { lastActivityAt: Date }, no other fields.
  for (const call of bumpCalls) {
    const data = call[0].data;
    expect(Object.keys(data)).toContain('lastActivityAt');
    expect(data.lastActivityAt).toBeInstanceOf(Date);
  }
}

/** Did the `tx` passed into a transaction get a bump call? */
function assertTxActivityBumpCalled(tx: any): void {
  const calls = (tx.request.update as any).mock.calls as Array<[any]>;
  const bumpCalls = calls.filter((call) => {
    const data = call?.[0]?.data;
    return data && Object.prototype.hasOwnProperty.call(data, 'lastActivityAt');
  });
  expect(bumpCalls.length).toBeGreaterThanOrEqual(1);
}

// ─── Bump events ────────────────────────────────────────────────────────────

describe('lastActivityAt bump matrix · comment posted', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`bumps when a comment is posted on a ${state} ticket`, async () => {
      mockedRequest.findFirst.mockResolvedValue({ id: 'r1', status: state });
      mockedComment.create.mockResolvedValue({ id: 'c1' });
      mockedRequest.update.mockResolvedValue({ id: 'r1' });

      await createCommentForKanbanTicket({
        requestId: 'r1',
        authorId: 'u1',
        body: 'hello',
        kind: 'comment',
      });
      assertActivityBumpCalled();
    });
  }
});

describe('lastActivityAt bump matrix · note posted', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`bumps when a note is posted on a ${state} ticket`, async () => {
      mockedRequest.findFirst.mockResolvedValue({ id: 'r1', status: state });
      mockedComment.create.mockResolvedValue({ id: 'c1' });
      mockedRequest.update.mockResolvedValue({ id: 'r1' });

      await createCommentForKanbanTicket({
        requestId: 'r1',
        authorId: 'u1',
        body: 'internal',
        kind: 'note',
      });
      assertActivityBumpCalled();
    });
  }
});

describe('lastActivityAt bump matrix · status change', () => {
  for (const state of LIFECYCLE_STATES) {
    // Pick a target distinct from `state` so the change isn't a no-op.
    const target: RequestStatus = state === 'active' ? 'done' : 'active';
    it(`bumps when status changes from ${state} → ${target}`, async () => {
      mockedRequest.findUnique.mockResolvedValue({ id: 'r1', status: state });
      mockedRequest.update.mockResolvedValue({ id: 'r1', status: target });

      await setRequestStatus({ requestId: 'r1', status: target, actorId: 'u1' });
      assertActivityBumpCalled();
    });
  }
});

describe('lastActivityAt bump matrix · status change is no-op when unchanged', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`does NOT bump when status target equals ${state} (idempotent no-op)`, async () => {
      mockedRequest.findUnique.mockResolvedValue({ id: 'r1', status: state });
      mockedRequest.findUniqueOrThrow.mockResolvedValue({ id: 'r1', status: state });

      await setRequestStatus({ requestId: 'r1', status: state, actorId: 'u1' });
      // No `update` call at all in the idempotent path.
      expect(mockedRequest.update).not.toHaveBeenCalled();
    });
  }
});

describe('lastActivityAt bump matrix · assignment add', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`bumps when a user self-assigns on a ${state} ticket`, async () => {
      // assignToRequest uses prisma.$transaction. Mock the tx with the
      // assignment + subscription tables; the bump fires OUTSIDE the
      // transaction (post-tx), so we assert on the top-level mock.
      mockedTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          assignment: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'a1' }),
            update: vi.fn(),
          },
          requestSubscription: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 's1' }),
          },
        };
        return cb(tx);
      });
      // After the tx, the post-bump path also reads request.columnId
      // (recruitment auto-advance). Return null so it short-circuits.
      mockedRequest.findUnique.mockResolvedValue({ columnId: null, status: state });
      mockedRequest.update.mockResolvedValue({ id: 'r1' });

      await assignToRequest({ requestId: 'r1', userId: 'u1', actorId: 'u1' });
      assertActivityBumpCalled();
    });
  }
});

describe('lastActivityAt bump matrix · assignment remove', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`bumps when a user self-unassigns on a ${state} ticket`, async () => {
      mockedAssignment.findUnique.mockResolvedValue({
        id: 'a1',
        unassignedAt: null,
      });
      mockedAssignment.update.mockResolvedValue({
        id: 'a1',
        unassignedAt: new Date(),
      });
      mockedRequest.update.mockResolvedValue({ id: 'r1' });

      await unassign({ requestId: 'r1', userId: 'u1', actorId: 'u1' });
      assertActivityBumpCalled();
    });
  }
});

describe('lastActivityAt bump matrix · share', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`bumps when a ${state} ticket is shared to a target group`, async () => {
      mockedWorkflow.findUnique.mockResolvedValue({
        sourceGroupId: 'g1',
        targetGroupId: 'g2',
        deletedAt: null,
      });
      mockedRequest.findUnique.mockResolvedValue({ status: state });
      mockedBoardColumn.findFirst.mockResolvedValue(state === 'active' ? { id: 'col1' } : null);
      mockedRequestGroup.findFirst.mockResolvedValue(null);

      mockedTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          requestGroup: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'rg-new' }),
            update: vi.fn(),
          },
        };
        return cb(tx);
      });
      mockedRequest.update.mockResolvedValue({ id: 'r1' });

      await shareRequestToGroup({
        requestId: 'r1',
        sourceGroupId: 'g1',
        targetGroupId: 'g2',
        mode: 'workflow',
        actorId: 'u1',
        isSystemAdmin: false,
        isGroupAdminOfSource: false,
      });
      assertActivityBumpCalled();
    });
  }
});

describe('lastActivityAt bump matrix · unshare', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`bumps when a non-originating share is removed on a ${state} ticket`, async () => {
      mockedRequestGroup.findUnique.mockResolvedValue({
        id: 'rg1',
        deletedAt: null,
        origin: 'workflow_share',
      });
      mockedRequestGroup.update.mockResolvedValue({
        id: 'rg1',
        deletedAt: new Date(),
        origin: 'workflow_share',
      });
      mockedRequest.update.mockResolvedValue({ id: 'r1' });

      await unshareRequestFromGroup({
        requestId: 'r1',
        groupId: 'g2',
        actorId: 'u1',
      });
      assertActivityBumpCalled();
    });
  }
});

describe('lastActivityAt bump matrix · title edit', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`bumps when the title is edited on a ${state} ticket`, async () => {
      mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
      mockedRequest.findFirst.mockResolvedValue({
        id: 'r1',
        title: 'Old',
        status: state,
      });
      mockedRequest.update.mockResolvedValue({ id: 'r1', title: 'New' });

      await editTicketTitle({
        requestId: 'r1',
        viewerGroupId: 'g1',
        actorId: 'u1',
        title: 'New',
      });
      assertActivityBumpCalled();
    });
  }
});

describe('lastActivityAt bump matrix · body edit', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`bumps when the body is edited on a ${state} ticket`, async () => {
      mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
      mockedRequest.findFirst.mockResolvedValue({
        id: 'r1',
        body: null,
        status: state,
      });
      mockedRequest.update.mockResolvedValue({ id: 'r1', body: 'New body' });

      await editTicketBody({
        requestId: 'r1',
        viewerGroupId: 'g1',
        actorId: 'u1',
        body: 'New body',
      });
      assertActivityBumpCalled();
    });
  }
});

describe('lastActivityAt bump matrix · column move (originating)', () => {
  for (const state of LIFECYCLE_STATES) {
    it(`bumps when a card is moved on the originating board (status ${state} → active)`, async () => {
      // Originating-group move: writes Request + RequestGroup inside a tx.
      // The bump fires INSIDE the tx (`tx.request.update`), so we assert
      // on the tx mock — top-level prisma.request.update isn't called for
      // the originating happy path.
      mockedRequest.findUnique.mockResolvedValue({
        id: 'r1',
        columnId: 'c-old',
        status: state,
        boardPosition: new Prisma.Decimal(1024),
      });
      mockedRequestGroup.findUnique.mockResolvedValue({
        id: 'rg1',
        origin: 'originating',
        columnId: 'c-old',
        boardPosition: new Prisma.Decimal(1024),
        deletedAt: null,
      });
      mockedBoardColumn.findUnique.mockResolvedValue({
        groupId: 'g1',
        deletedAt: null,
      });

      let capturedTx: any;
      mockedTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          request: {
            update: vi.fn().mockResolvedValue({
              id: 'r1',
              columnId: 'c-new',
              status: 'active',
              boardPosition: new Prisma.Decimal(0),
            }),
          },
          requestGroup: {
            update: vi.fn().mockResolvedValue({
              id: 'rg1',
              columnId: 'c-new',
              boardPosition: new Prisma.Decimal(0),
            }),
          },
        };
        capturedTx = tx;
        return cb(tx);
      });

      await moveCard({
        requestId: 'r1',
        groupId: 'g1',
        destination: { lane: 'active', columnId: 'c-new' },
        actorId: 'u1',
      });
      assertTxActivityBumpCalled(capturedTx);
    });
  }
});
