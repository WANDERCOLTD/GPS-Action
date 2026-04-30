/**
 * @build-unit BU-admin-audit-integration
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-audit-integration.md
 *
 * Asserts that every generic admin mutation writes one AuditLog
 * row with the expected shape (verb, action string, changes shape,
 * targetUserId rule, PII strip).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const mUserFindUnique = vi.mocked(prisma.user.findUnique);
const mUserCreate = vi.mocked(prisma.user.create);
const mUserUpdate = vi.mocked(prisma.user.update);
const mPostFindUnique = vi.mocked(prisma.post.findUnique);
const mPostUpdate = vi.mocked(prisma.post.update);
const mAuditCreate = vi.mocked(prisma.auditLog.create);

const ID = '11111111-1111-4111-8111-111111111111';

function adminCtx(): TRPCContext {
  return {
    user: {
      id: 'admin-1',
      email: 'admin@test.com',
      displayName: 'Admin',
      avatarUrl: null,
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
  return {
    id: ID,
    email: 'eddie@test.com',
    displayName: 'Eddie',
    avatarUrl: null,
    phoneNumber: null,
    verifiedAt: new Date('2026-01-01T00:00:00Z'),
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

function fakePostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    authorId: 'user-1',
    title: 'Hello',
    body: 'Body',
    visibility: 'public',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    author: { id: 'user-1', displayName: 'Eddie' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-arm the audit-create mock after clearAllMocks wipes it.
  mAuditCreate.mockResolvedValue({ id: 'audit-1' } as Awaited<
    ReturnType<typeof prisma.auditLog.create>
  >);
});

describe('admin.create — audit-write', () => {
  it('writes admin.user.create with changes.after (PII stripped)', async () => {
    mUserCreate.mockResolvedValueOnce({ id: ID } as Awaited<ReturnType<typeof prisma.user.create>>);
    mUserFindUnique.mockResolvedValueOnce(
      fakeUserRow() as Awaited<ReturnType<typeof prisma.user.findUnique>>,
    );

    const caller = createCaller(adminCtx());
    await caller.admin.create({
      entity: 'user',
      data: { email: 'new@test.com', displayName: 'New User' },
    });

    expect(mAuditCreate).toHaveBeenCalledTimes(1);
    const audit = mAuditCreate.mock.calls[0]?.[0]?.data;
    expect(audit?.action).toBe('admin.user.create');
    expect(audit?.entityType).toBe('user');
    expect(audit?.entityId).toBe(ID);
    expect(audit?.userId).toBe('admin-1');
    expect(audit?.targetUserId).toBe(ID);
    const changes = audit?.changes as Record<string, unknown>;
    expect(changes).toHaveProperty('after');
    const after = changes.after as Record<string, unknown>;
    expect(after).toHaveProperty('displayName', 'Eddie');
    expect(after).not.toHaveProperty('email');
    expect(after).not.toHaveProperty('phoneNumber');
    expect(audit?.context).toEqual({ source: 'admin' });
  });
});

describe('admin.update — audit-write', () => {
  it('writes admin.user.update with changes.diff containing only changed fields', async () => {
    // First call (before): unmodified row. Second call (after): changed row.
    mUserFindUnique
      .mockResolvedValueOnce(
        fakeUserRow({ displayName: 'Eddie' }) as Awaited<ReturnType<typeof prisma.user.findUnique>>,
      )
      .mockResolvedValueOnce(
        fakeUserRow({ displayName: 'Eddie M' }) as Awaited<
          ReturnType<typeof prisma.user.findUnique>
        >,
      );
    mUserUpdate.mockResolvedValueOnce({ id: ID } as Awaited<ReturnType<typeof prisma.user.update>>);

    const caller = createCaller(adminCtx());
    await caller.admin.update({
      entity: 'user',
      id: ID,
      data: { displayName: 'Eddie M' },
    });

    expect(mAuditCreate).toHaveBeenCalledTimes(1);
    const audit = mAuditCreate.mock.calls[0]?.[0]?.data;
    expect(audit?.action).toBe('admin.user.update');
    const changes = audit?.changes as Record<string, unknown>;
    expect(changes).toHaveProperty('diff');
    expect(changes.diff).toEqual({
      displayName: { from: 'Eddie', to: 'Eddie M' },
    });
  });

  it('no-op update writes a row with empty diff (forensically useful)', async () => {
    const row = fakeUserRow();
    mUserFindUnique
      .mockResolvedValueOnce(row as Awaited<ReturnType<typeof prisma.user.findUnique>>)
      .mockResolvedValueOnce(row as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    mUserUpdate.mockResolvedValueOnce({ id: ID } as Awaited<ReturnType<typeof prisma.user.update>>);

    const caller = createCaller(adminCtx());
    await caller.admin.update({
      entity: 'user',
      id: ID,
      data: { displayName: 'Eddie' }, // matches existing
    });

    expect(mAuditCreate).toHaveBeenCalledTimes(1);
    const audit = mAuditCreate.mock.calls[0]?.[0]?.data;
    const changes = audit?.changes as Record<string, unknown>;
    expect(changes.diff).toEqual({});
  });
});

describe('admin.delete — audit-write', () => {
  it('soft-delete writes admin.user.soft-delete with changes.before', async () => {
    mUserFindUnique.mockResolvedValueOnce(
      fakeUserRow() as Awaited<ReturnType<typeof prisma.user.findUnique>>,
    );
    mUserUpdate.mockResolvedValueOnce({ id: ID } as Awaited<ReturnType<typeof prisma.user.update>>);

    const caller = createCaller(adminCtx());
    await caller.admin.delete({ entity: 'user', id: ID, mode: 'soft' });

    const audit = mAuditCreate.mock.calls[0]?.[0]?.data;
    expect(audit?.action).toBe('admin.user.soft-delete');
    const changes = audit?.changes as Record<string, unknown>;
    expect(changes).toHaveProperty('before');
    const before = changes.before as Record<string, unknown>;
    expect(before).toHaveProperty('displayName', 'Eddie');
    expect(before).not.toHaveProperty('email'); // PII stripped
  });

  it('restore writes admin.user.restore with changes.before', async () => {
    mUserFindUnique.mockResolvedValueOnce(
      fakeUserRow({ deletedAt: new Date() }) as Awaited<ReturnType<typeof prisma.user.findUnique>>,
    );
    mUserUpdate.mockResolvedValueOnce({ id: ID } as Awaited<ReturnType<typeof prisma.user.update>>);

    const caller = createCaller(adminCtx());
    await caller.admin.delete({ entity: 'user', id: ID, mode: 'restore' });

    const audit = mAuditCreate.mock.calls[0]?.[0]?.data;
    expect(audit?.action).toBe('admin.user.restore');
    expect(audit?.changes).toHaveProperty('before');
  });
});

describe('admin audit-write — entity discrimination', () => {
  it('non-User entity sets targetUserId to null', async () => {
    mPostFindUnique.mockResolvedValueOnce(
      fakePostRow() as unknown as Awaited<ReturnType<typeof prisma.post.findUnique>>,
    );
    mPostUpdate.mockResolvedValueOnce({ id: ID } as Awaited<ReturnType<typeof prisma.post.update>>);

    const caller = createCaller(adminCtx());
    await caller.admin.delete({ entity: 'post', id: ID, mode: 'soft' });

    const audit = mAuditCreate.mock.calls[0]?.[0]?.data;
    expect(audit?.action).toBe('admin.post.soft-delete');
    expect(audit?.entityType).toBe('post');
    expect(audit?.targetUserId).toBeNull();
  });
});
