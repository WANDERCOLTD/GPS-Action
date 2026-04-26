/**
 * @build-unit BU-admin-audit-integration
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-audit-integration.md
 *
 * Asserts that an AuditLog write failure does NOT roll back the
 * caller's mutation. The mutation succeeds; the failure logs to
 * console but is otherwise invisible to the caller. Mirrors the
 * existing `auditLog()` writer's contract in
 * `server/services/audit.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const mUserFindUnique = vi.mocked(prisma.user.findUnique);
const mUserUpdate = vi.mocked(prisma.user.update);
const mAuditCreate = vi.mocked(prisma.auditLog.create);

const ID = '11111111-1111-4111-8111-111111111111';

function adminCtx(): TRPCContext {
  return {
    user: {
      id: 'admin-1',
      email: 'admin@test.com',
      displayName: 'Admin',
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

function fakeUserRow() {
  return {
    id: ID,
    email: 'eddie@test.com',
    displayName: 'Eddie',
    phoneNumber: null,
    verifiedAt: new Date(),
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('audit-write resilience', () => {
  it('AuditLog write failure does NOT roll back the mutation', async () => {
    mUserFindUnique.mockResolvedValue(
      fakeUserRow() as Awaited<ReturnType<typeof prisma.user.findUnique>>,
    );
    mUserUpdate.mockResolvedValueOnce({ id: ID } as Awaited<ReturnType<typeof prisma.user.update>>);
    mAuditCreate.mockRejectedValueOnce(new Error('Postgres unreachable'));

    // Silence the expected console.error for this test only.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const caller = createCaller(adminCtx());
    const result = await caller.admin.delete({ entity: 'user', id: ID, mode: 'soft' });

    expect(result).toEqual({ id: ID });
    expect(mUserUpdate).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('AuditLog success does not return its result to the caller', async () => {
    mUserFindUnique.mockResolvedValue(
      fakeUserRow() as Awaited<ReturnType<typeof prisma.user.findUnique>>,
    );
    mUserUpdate.mockResolvedValueOnce({ id: ID } as Awaited<ReturnType<typeof prisma.user.update>>);
    mAuditCreate.mockResolvedValueOnce({ id: 'audit-row' } as Awaited<
      ReturnType<typeof prisma.auditLog.create>
    >);

    const caller = createCaller(adminCtx());
    const result = await caller.admin.delete({ entity: 'user', id: ID, mode: 'soft' });

    // The caller still gets the original mutation result, not the audit row.
    expect(result).toEqual({ id: ID });
  });
});
