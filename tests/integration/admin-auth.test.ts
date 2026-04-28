/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Auth gating for the generic admin tRPC procedures. Confirms:
 *   - UNAUTHORIZED for unauthed callers
 *   - FORBIDDEN for plain members
 *   - FORBIDDEN for queue_managers on admin-only entities
 *   - FORBIDDEN for queue_managers attempting to edit admin-edit entities
 *   - AuditLog mutations rejected even for admins (immutable)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    featureFlag: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';

function fakeUser(id = 'u-1'): TRPCContext['user'] {
  return {
    id,
    email: `${id}@test.com`,
    displayName: id,
    avatarUrl: null,
    phoneNumber: null,
    verifiedAt: new Date(),
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

const anonCtx: TRPCContext = { user: null, activeRoles: [], activeScopes: [] };
const memberCtx: TRPCContext = { user: fakeUser('m-1'), activeRoles: [], activeScopes: [] };
const queueCtx: TRPCContext = {
  user: fakeUser('q-1'),
  activeRoles: ['queue_manager'],
  activeScopes: [],
};
const adminCtx: TRPCContext = {
  user: fakeUser('a-1'),
  activeRoles: ['admin'],
  activeScopes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin.list — auth boundary', () => {
  it('UNAUTHORIZED for anonymous caller', async () => {
    const caller = createCaller(anonCtx);
    await expect(caller.admin.list({ entity: 'user' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('FORBIDDEN for plain member on user (queue_manager view)', async () => {
    const caller = createCaller(memberCtx);
    await expect(caller.admin.list({ entity: 'user' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('FORBIDDEN for queue_manager on featureFlag (admin view)', async () => {
    const caller = createCaller(queueCtx);
    await expect(caller.admin.list({ entity: 'featureFlag' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('queue_manager can list user (queue_manager view)', async () => {
    const caller = createCaller(queueCtx);
    const result = await caller.admin.list({ entity: 'user' });
    expect(result.total).toBe(0);
  });

  it('admin can list auditLog', async () => {
    const caller = createCaller(adminCtx);
    const result = await caller.admin.list({ entity: 'auditLog' });
    expect(result.total).toBe(0);
  });
});

describe('admin.update — auth boundary', () => {
  it('FORBIDDEN for queue_manager on user.update (admin-only edit)', async () => {
    const caller = createCaller(queueCtx);
    await expect(
      caller.admin.update({
        entity: 'user',
        id: '00000000-0000-4000-8000-000000000001',
        data: { displayName: 'X' },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('admin.* — immutable entity (auditLog)', () => {
  it('admin.create rejects for auditLog (no create op registered)', async () => {
    const caller = createCaller(adminCtx);
    await expect(
      caller.admin.create({ entity: 'auditLog', data: { action: 'x' } }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('admin.update rejects for auditLog', async () => {
    const caller = createCaller(adminCtx);
    await expect(
      caller.admin.update({
        entity: 'auditLog',
        id: '00000000-0000-4000-8000-000000000001',
        data: {},
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('admin.delete rejects for auditLog', async () => {
    const caller = createCaller(adminCtx);
    await expect(
      caller.admin.delete({
        entity: 'auditLog',
        id: '00000000-0000-4000-8000-000000000001',
        mode: 'hard',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// Queue-workflow entities (request) never reach admin.list because they
// aren't in ADMIN_ENTITY_KEYS — input Zod rejects at the boundary. The
// /data/request redirect to /requests is enforced at the page level
// (see app/data/[entity]/page.tsx); covered by manual click-through.
