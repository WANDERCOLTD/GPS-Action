/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Round-trip CRUD tests for the User entity through the generic
 * admin engine. Mocks Prisma at the DB boundary; calls go through
 * the real router → service → registry chain via createCaller.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    // BU-admin-audit-integration: mutations write to AuditLog.
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const mFindMany = vi.mocked(prisma.user.findMany);
const mCount = vi.mocked(prisma.user.count);
const mFindUnique = vi.mocked(prisma.user.findUnique);
const mCreate = vi.mocked(prisma.user.create);
const mUpdate = vi.mocked(prisma.user.update);

function adminContext(): TRPCContext {
  return {
    user: {
      id: 'admin-1',
      email: 'admin@test.com',
      displayName: 'Admin User',
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    activeRoles: ['admin'],
    activeScopes: [],
  };
}

function fakeUserRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'user-x',
    email: 'eddie@test.com',
    displayName: 'Eddie',
    phoneNumber: null,
    verifiedAt: now,
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // BU-admin-audit-integration: every mutation pre-loads / re-fetches
  // the row for the audit `before`/`after` snapshot. Default to a
  // sane shape so tests that don't care about the snapshot work.
  mFindUnique.mockResolvedValue(
    fakeUserRow() as Awaited<ReturnType<typeof prisma.user.findUnique>>,
  );
});

describe('admin.list / user', () => {
  it('returns the rows + total, sorted by createdAt desc', async () => {
    mFindMany.mockResolvedValueOnce([fakeUserRow()] as Awaited<
      ReturnType<typeof prisma.user.findMany>
    >);
    mCount.mockResolvedValueOnce(1);

    const caller = createCaller(adminContext());
    const result = await caller.admin.list({ entity: 'user' });

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe('user-x');
    expect(result.rows[0]?.displayName).toBe('Eddie');
    const call = mFindMany.mock.calls[0]?.[0];
    expect(call?.where?.deletedAt).toBeNull();
    expect(call?.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('search builds an OR of contains over searchableFields', async () => {
    mFindMany.mockResolvedValueOnce([] as Awaited<ReturnType<typeof prisma.user.findMany>>);
    mCount.mockResolvedValueOnce(0);
    const caller = createCaller(adminContext());
    await caller.admin.list({ entity: 'user', search: 'edd' });

    const where = mFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown> | undefined;
    expect(where?.OR).toEqual([
      { displayName: { contains: 'edd', mode: 'insensitive' } },
      { email: { contains: 'edd', mode: 'insensitive' } },
    ]);
  });
});

describe('admin.get / user', () => {
  it('returns the row when present', async () => {
    mFindUnique.mockResolvedValueOnce(
      fakeUserRow() as Awaited<ReturnType<typeof prisma.user.findUnique>>,
    );
    const caller = createCaller(adminContext());
    const row = await caller.admin.get({
      entity: 'user',
      id: '11111111-1111-4111-8111-111111111111',
    });
    expect(row.id).toBe('user-x');
  });

  it('throws NOT_FOUND when missing', async () => {
    mFindUnique.mockResolvedValueOnce(null);
    const caller = createCaller(adminContext());
    await expect(
      caller.admin.get({ entity: 'user', id: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('admin.create / user', () => {
  it('creates a row and returns its id', async () => {
    mCreate.mockResolvedValueOnce({ id: 'user-new' } as Awaited<
      ReturnType<typeof prisma.user.create>
    >);
    const caller = createCaller(adminContext());
    const result = await caller.admin.create({
      entity: 'user',
      data: { email: 'new@test.com', displayName: 'New' },
    });
    expect(result).toEqual({ id: 'user-new' });
    expect(mCreate).toHaveBeenCalledWith({
      data: { email: 'new@test.com', displayName: 'New', phoneNumber: null },
      select: { id: true },
    });
  });

  it('rejects invalid email via Zod', async () => {
    const caller = createCaller(adminContext());
    await expect(
      caller.admin.create({
        entity: 'user',
        data: { email: 'not-an-email', displayName: 'New' },
      }),
    ).rejects.toThrow();
    expect(mCreate).not.toHaveBeenCalled();
  });
});

describe('admin.update / user', () => {
  it('updates the row with only provided fields', async () => {
    mUpdate.mockResolvedValueOnce({ id: 'user-x' } as Awaited<
      ReturnType<typeof prisma.user.update>
    >);
    const caller = createCaller(adminContext());
    const result = await caller.admin.update({
      entity: 'user',
      id: '22222222-2222-4222-8222-222222222222',
      data: { displayName: 'Eddie M' },
    });
    expect(result).toEqual({ id: 'user-x' });
    expect(mUpdate).toHaveBeenCalledWith({
      where: { id: '22222222-2222-4222-8222-222222222222' },
      data: { displayName: 'Eddie M' },
      select: { id: true },
    });
  });
});

describe('admin.delete / user — soft + restore', () => {
  it('mode=soft sets deletedAt', async () => {
    mUpdate.mockResolvedValueOnce({ id: 'user-x' } as Awaited<
      ReturnType<typeof prisma.user.update>
    >);
    const caller = createCaller(adminContext());
    await caller.admin.delete({
      entity: 'user',
      id: '33333333-3333-4333-8333-333333333333',
      mode: 'soft',
    });
    const call = mUpdate.mock.calls[0]?.[0];
    expect(call?.data).toMatchObject({ deletedAt: expect.any(Date) });
  });

  it('mode=restore clears deletedAt', async () => {
    mUpdate.mockResolvedValueOnce({ id: 'user-x' } as Awaited<
      ReturnType<typeof prisma.user.update>
    >);
    const caller = createCaller(adminContext());
    await caller.admin.delete({
      entity: 'user',
      id: '33333333-3333-4333-8333-333333333333',
      mode: 'restore',
    });
    const call = mUpdate.mock.calls[0]?.[0];
    expect(call?.data).toEqual({ deletedAt: null });
  });

  it('mode=hard rejects because user uses soft-delete', async () => {
    const caller = createCaller(adminContext());
    await expect(
      caller.admin.delete({
        entity: 'user',
        id: '44444444-4444-4444-8444-444444444444',
        mode: 'hard',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
