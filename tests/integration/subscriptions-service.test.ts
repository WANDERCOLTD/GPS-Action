/**
 * Integration tests for the Subscription service (bu-coordination-board /
 * ADRs 0008 + 0009). Mocks the Prisma client; asserts the source-rules
 * matrix from subscriptions.ts:
 *
 *   - subscribe(no row, source) → create with that source.
 *   - subscribe(deleted row, source) → undelete + set new source.
 *   - subscribe(active row, explicit) → upgrade source to explicit.
 *   - subscribe(active row, auto_*) → leave source unchanged.
 *   - unsubscribe(active) → soft-delete + audit.
 *   - unsubscribe(already deleted | no row) → no-op.
 *   - read shapes return the right fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
    requestSubscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import {
  subscribe,
  unsubscribe,
  isSubscribed,
  listSubscribersForRequest,
  listActiveSubscriptionsForUser,
  countActiveSubscribers,
} from '@/server/services/subscriptions';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';

const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedSubscription = vi.mocked(prisma.requestSubscription);
const mockedAudit = vi.mocked(auditLog);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeTxStub() {
  return {
    requestSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('subscribe — create path', () => {
  it('creates a new subscription with the given source when no row exists', async () => {
    const tx = makeTxStub();
    tx.requestSubscription.findUnique.mockResolvedValue(null);
    tx.requestSubscription.create.mockResolvedValue({
      id: 's1',
      requestId: 'r1',
      userId: 'u1',
      source: 'explicit',
      deletedAt: null,
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await subscribe({
      requestId: 'r1',
      userId: 'u1',
      source: 'explicit',
      actorId: 'u1',
    });

    expect(result.created).toBe(true);
    expect(result.reactivated).toBe(false);
    expect(tx.requestSubscription.create).toHaveBeenCalledWith({
      data: { requestId: 'r1', userId: 'u1', source: 'explicit' },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subscription_created',
        entityType: 'RequestSubscription',
        entityId: 's1',
        targetUserId: 'u1',
        context: { requestId: 'r1', source: 'explicit' },
      }),
    );
  });

  it('creates with auto_author source when called by request creator', async () => {
    const tx = makeTxStub();
    tx.requestSubscription.findUnique.mockResolvedValue(null);
    tx.requestSubscription.create.mockResolvedValue({
      id: 's1',
      source: 'auto_author',
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await subscribe({ requestId: 'r1', userId: 'u1', source: 'auto_author', actorId: 'u1' });

    expect(tx.requestSubscription.create).toHaveBeenCalledWith({
      data: { requestId: 'r1', userId: 'u1', source: 'auto_author' },
    });
  });
});

describe('subscribe — reactivate path', () => {
  it('undeletes a previously-unfollowed row + sets new source', async () => {
    const deleted = {
      id: 's1',
      requestId: 'r1',
      userId: 'u1',
      source: 'auto_author',
      deletedAt: new Date('2026-05-02'),
    };
    const tx = makeTxStub();
    tx.requestSubscription.findUnique.mockResolvedValue(deleted);
    tx.requestSubscription.update.mockResolvedValue({
      ...deleted,
      deletedAt: null,
      source: 'auto_mention',
    });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await subscribe({
      requestId: 'r1',
      userId: 'u1',
      source: 'auto_mention',
      actorId: 'u2',
    });

    expect(result.reactivated).toBe(true);
    expect(tx.requestSubscription.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { deletedAt: null, source: 'auto_mention' },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'subscription_reactivated' }),
    );
  });
});

describe('subscribe — active row source rules', () => {
  it('upgrades source to explicit when manual gesture fires on auto_author row', async () => {
    const active = {
      id: 's1',
      requestId: 'r1',
      userId: 'u1',
      source: 'auto_author',
      deletedAt: null,
    };
    const tx = makeTxStub();
    tx.requestSubscription.findUnique.mockResolvedValue(active);
    tx.requestSubscription.update.mockResolvedValue({ ...active, source: 'explicit' });
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await subscribe({
      requestId: 'r1',
      userId: 'u1',
      source: 'explicit',
      actorId: 'u1',
    });

    expect(result.created).toBe(false);
    expect(result.reactivated).toBe(false);
    expect(tx.requestSubscription.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { source: 'explicit' },
    });
    // No audit — source change is implicit; only create/reactivate audit.
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('leaves source alone when auto_assignee fires on already-explicit row', async () => {
    const explicit = {
      id: 's1',
      requestId: 'r1',
      userId: 'u1',
      source: 'explicit',
      deletedAt: null,
    };
    const tx = makeTxStub();
    tx.requestSubscription.findUnique.mockResolvedValue(explicit);
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await subscribe({
      requestId: 'r1',
      userId: 'u1',
      source: 'auto_assignee',
      actorId: 'u1',
    });

    expect(result.created).toBe(false);
    expect(result.reactivated).toBe(false);
    expect(tx.requestSubscription.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('leaves source alone when auto_mention fires on auto_author row', async () => {
    const author = {
      id: 's1',
      requestId: 'r1',
      userId: 'u1',
      source: 'auto_author',
      deletedAt: null,
    };
    const tx = makeTxStub();
    tx.requestSubscription.findUnique.mockResolvedValue(author);
    mockedTransaction.mockImplementation(async (fn: any) => fn(tx));

    await subscribe({
      requestId: 'r1',
      userId: 'u1',
      source: 'auto_mention',
      actorId: 'u2',
    });

    expect(tx.requestSubscription.update).not.toHaveBeenCalled();
  });
});

describe('unsubscribe', () => {
  it('soft-deletes an active subscription + audits', async () => {
    const active = {
      id: 's1',
      requestId: 'r1',
      userId: 'u1',
      source: 'explicit',
      deletedAt: null,
    };
    mockedSubscription.findUnique.mockResolvedValue(active as never);
    mockedSubscription.update.mockResolvedValue({ ...active, deletedAt: new Date() } as never);

    const result = await unsubscribe({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(result?.deletedAt).toBeInstanceOf(Date);
    expect(mockedSubscription.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'subscription_unsubscribed' }),
    );
  });

  it('is idempotent when already unsubscribed', async () => {
    const alreadyUnsubbed = {
      id: 's1',
      deletedAt: new Date('2026-05-02'),
    };
    mockedSubscription.findUnique.mockResolvedValue(alreadyUnsubbed as never);

    const result = await unsubscribe({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(result).toBe(alreadyUnsubbed);
    expect(mockedSubscription.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('returns null when no row exists', async () => {
    mockedSubscription.findUnique.mockResolvedValue(null);

    const result = await unsubscribe({ requestId: 'r1', userId: 'u1', actorId: 'u1' });

    expect(result).toBeNull();
    expect(mockedSubscription.update).not.toHaveBeenCalled();
  });
});

describe('read shapes', () => {
  it('isSubscribed returns true for an active row', async () => {
    mockedSubscription.findUnique.mockResolvedValue({ deletedAt: null } as never);
    expect(await isSubscribed('r1', 'u1')).toBe(true);
  });

  it('isSubscribed returns false for a deleted row', async () => {
    mockedSubscription.findUnique.mockResolvedValue({
      deletedAt: new Date('2026-05-02'),
    } as never);
    expect(await isSubscribed('r1', 'u1')).toBe(false);
  });

  it('isSubscribed returns false when no row exists', async () => {
    mockedSubscription.findUnique.mockResolvedValue(null);
    expect(await isSubscribed('r1', 'u1')).toBe(false);
  });

  it('listSubscribersForRequest returns ordered subscribers with user fields', async () => {
    mockedSubscription.findMany.mockResolvedValue([
      {
        source: 'auto_author',
        createdAt: new Date('2026-05-01'),
        user: { id: 'u1', displayName: 'Sharon', avatarUrl: 'https://x/sharon.png' },
      },
      {
        source: 'auto_assignee',
        createdAt: new Date('2026-05-02'),
        user: { id: 'u2', displayName: 'Maya', avatarUrl: null },
      },
    ] as never);

    const out = await listSubscribersForRequest('r1');

    expect(mockedSubscription.findMany).toHaveBeenCalledWith({
      where: { requestId: 'r1', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    expect(out[0]).toMatchObject({ userId: 'u1', source: 'auto_author' });
    expect(out[1]).toMatchObject({ userId: 'u2', source: 'auto_assignee' });
  });

  it('listActiveSubscriptionsForUser filters out deleted rows', async () => {
    mockedSubscription.findMany.mockResolvedValue([] as never);
    await listActiveSubscriptionsForUser('u1');
    expect(mockedSubscription.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('countActiveSubscribers excludes deleted rows', async () => {
    mockedSubscription.count.mockResolvedValue(7);
    expect(await countActiveSubscribers('r1')).toBe(7);
    expect(mockedSubscription.count).toHaveBeenCalledWith({
      where: { requestId: 'r1', deletedAt: null },
    });
  });
});
