/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Integration tests for `adminToggleBooleanAction`. The action wraps
 * `caller.admin.update` for one-click flips of allowlisted boolean
 * columns. Confirms:
 *   - allowlist rejects unknown (entity, field) pairs without
 *     touching the DB
 *   - happy path flips through the same audit-writing crud path
 *   - non-admin sees a FORBIDDEN-shaped error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '@/server/lib/trpc';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({
  prisma: {
    featureFlag: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
}));

const ctxRef: { current: TRPCContext } = {
  current: {
    user: null,
    activeRoles: [],
    activeScopes: [],
  },
};

vi.mock('@/server/routers/context', () => ({
  createTRPCContext: () => Promise.resolve(ctxRef.current),
}));

import { adminToggleBooleanAction } from '@/app/data/[entity]/actions';
import { prisma } from '@/server/db/client';
import { revalidatePath } from 'next/cache';

const FLAG_ID = '00000000-0000-4000-8000-000000000001';

const mFindUnique = vi.mocked(prisma.featureFlag.findUnique);
const mUpdate = vi.mocked(prisma.featureFlag.update);
const mAuditCreate = vi.mocked(prisma.auditLog.create);

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

function memberCtx(): TRPCContext {
  return {
    user: {
      id: 'm-1',
      email: 'm@test.com',
      displayName: 'Member',
      avatarUrl: null,
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    activeRoles: [],
    activeScopes: [],
  };
}

function fakeFlagRow(enabled: boolean) {
  const now = new Date();
  return {
    id: FLAG_ID,
    name: 'demo_flag',
    description: 'demo',
    purpose: 'rollout',
    enabledGlobally: enabled,
    rolloutPercentage: 0,
    ttlRemoveAfter: null,
    ownerUserId: null,
    createdByUserId: 'admin-1',
    updatedByUserId: 'admin-1',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    owner: null,
    createdBy: { id: 'admin-1', displayName: 'Admin' },
    updatedBy: { id: 'admin-1', displayName: 'Admin' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  ctxRef.current = adminCtx();
  mFindUnique.mockResolvedValue(
    fakeFlagRow(false) as unknown as Awaited<ReturnType<typeof prisma.featureFlag.findUnique>>,
  );
  mUpdate.mockResolvedValue({ id: FLAG_ID } as Awaited<
    ReturnType<typeof prisma.featureFlag.update>
  >);
});

describe('adminToggleBooleanAction', () => {
  it('rejects unknown entity without touching the DB', async () => {
    const result = await adminToggleBooleanAction(
      'notARealEntity',
      FLAG_ID,
      'enabledGlobally',
      true,
    );
    expect(result).toEqual({ ok: false, message: 'Unknown entity "notARealEntity"' });
    expect(mUpdate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects non-allowlisted field without touching the DB', async () => {
    const result = await adminToggleBooleanAction(
      'featureFlag',
      FLAG_ID,
      'rolloutPercentage',
      true,
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.message).toContain('not inline-toggleable');
    }
    expect(mUpdate).not.toHaveBeenCalled();
  });

  it('admin flips featureFlag.enabledGlobally → update + audit + revalidate', async () => {
    const result = await adminToggleBooleanAction('featureFlag', FLAG_ID, 'enabledGlobally', true);
    expect(result).toEqual({ ok: true });
    expect(mUpdate).toHaveBeenCalledTimes(1);
    expect(mUpdate.mock.calls[0]?.[0]?.data).toMatchObject({ enabledGlobally: true });
    expect(mAuditCreate).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/data/featureFlag');
  });

  it('non-admin sees FORBIDDEN-shaped error and DB stays untouched', async () => {
    ctxRef.current = memberCtx();
    const result = await adminToggleBooleanAction('featureFlag', FLAG_ID, 'enabledGlobally', true);
    expect(result.ok).toBe(false);
    expect(mUpdate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
