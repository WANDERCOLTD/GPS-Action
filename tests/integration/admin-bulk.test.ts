/**
 * @build-unit BU-admin-bulk-ops
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-bulk-ops.md
 *
 * Integration tests for the four bulk-mutation tRPC procedures.
 * Mocks Prisma at the DB boundary; goes through the full
 * router → service → registry chain via createCaller.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
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
const mUserUpdate = vi.mocked(prisma.user.update);
const mPostUpdate = vi.mocked(prisma.post.update);

const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '33333333-3333-4333-8333-333333333333';
const ID4 = '44444444-4444-4444-8444-444444444444';
const ID5 = '55555555-5555-4555-8555-555555555555';

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

function fakeUserRow(id: string) {
  return {
    id,
    email: `${id}@test.com`,
    displayName: `User-${id.slice(0, 4)}`,
    avatarUrl: null,
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
  // Default: pre-load the row when called for any of the mutation pre-loads.
  // The Prisma return is a thenable promise rather than a plain Promise; mock
  // by resolving via the eslint-allowed path (cast to Awaited via unknown).
  mUserFindUnique.mockImplementation(((args: { where?: { id?: string } }) =>
    Promise.resolve(
      fakeUserRow(args.where?.id ?? ID1),
    )) as unknown as typeof prisma.user.findUnique);
});

describe('admin.bulk.softDelete', () => {
  it('soft-deletes 5 ids; audit fires per row', async () => {
    mUserUpdate.mockResolvedValue({ id: 'x' } as Awaited<ReturnType<typeof prisma.user.update>>);
    const caller = createCaller(adminCtx());
    const result = await caller.admin.bulk.softDelete({
      entity: 'user',
      ids: [ID1, ID2, ID3, ID4, ID5],
    });
    expect(result).toEqual({ succeeded: 5, failed: [] });
    expect(mUserUpdate).toHaveBeenCalledTimes(5);
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledTimes(5);
  });

  it('partial failure: 1 of 5 throws → 4 succeed, 1 listed in failed', async () => {
    mUserUpdate
      .mockResolvedValueOnce({ id: ID1 } as Awaited<ReturnType<typeof prisma.user.update>>)
      .mockResolvedValueOnce({ id: ID2 } as Awaited<ReturnType<typeof prisma.user.update>>)
      .mockRejectedValueOnce(new Error('row locked'))
      .mockResolvedValueOnce({ id: ID4 } as Awaited<ReturnType<typeof prisma.user.update>>)
      .mockResolvedValueOnce({ id: ID5 } as Awaited<ReturnType<typeof prisma.user.update>>);

    const caller = createCaller(adminCtx());
    const result = await caller.admin.bulk.softDelete({
      entity: 'user',
      ids: [ID1, ID2, ID3, ID4, ID5],
    });
    expect(result.succeeded).toBe(4);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.id).toBe(ID3);
    expect(result.failed[0]?.message).toContain('row locked');
  });

  it('rejects empty ids array', async () => {
    const caller = createCaller(adminCtx());
    await expect(caller.admin.bulk.softDelete({ entity: 'user', ids: [] })).rejects.toThrow();
  });

  it('rejects ids.length > 100', async () => {
    const tooMany = Array.from({ length: 101 }, () => ID1);
    const caller = createCaller(adminCtx());
    await expect(caller.admin.bulk.softDelete({ entity: 'user', ids: tooMany })).rejects.toThrow();
  });

  it('member without edit role → FORBIDDEN', async () => {
    const caller = createCaller(memberCtx());
    await expect(
      caller.admin.bulk.softDelete({ entity: 'user', ids: [ID1] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('admin.bulk.hardDelete', () => {
  it('rejects soft-delete entity (user) with BAD_REQUEST', async () => {
    const caller = createCaller(adminCtx());
    await expect(
      caller.admin.bulk.hardDelete({ entity: 'user', ids: [ID1] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('admin.bulk.forceRelease', () => {
  it('rejects entity != "request" via Zod literal', async () => {
    const caller = createCaller(adminCtx());
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      caller.admin.bulk.forceRelease({ entity: 'user' as any, ids: [ID1] }),
    ).rejects.toThrow();
  });
});

describe('admin.bulk — verb not declared in metadata', () => {
  it('post entity rejects bulk hardDelete (post is softDelete:true; not in bulkActions)', async () => {
    // post.bulkActions = ['softDelete', 'restore'] — hardDelete is rejected
    // both because the entity is softDelete:true AND because the verb
    // isn't declared. The first check fires; assert BAD_REQUEST either way.
    mPostUpdate.mockResolvedValue({ id: ID1 } as Awaited<ReturnType<typeof prisma.post.update>>);
    const caller = createCaller(adminCtx());
    await expect(
      caller.admin.bulk.hardDelete({ entity: 'post', ids: [ID1] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('admin.bulk.softDelete on post — different entity, same engine', () => {
  it('processes post ids (proves engine is generic)', async () => {
    vi.mocked(prisma.post.findUnique).mockImplementation(((args: { where?: { id?: string } }) =>
      Promise.resolve({
        id: args.where?.id ?? ID1,
        authorId: 'u-1',
        title: 't',
        body: 'b',
        visibility: 'public',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })) as unknown as typeof prisma.post.findUnique);
    mPostUpdate.mockResolvedValue({ id: 'p' } as Awaited<ReturnType<typeof prisma.post.update>>);

    const caller = createCaller(adminCtx());
    const result = await caller.admin.bulk.softDelete({
      entity: 'post',
      ids: [ID1, ID2, ID3],
    });
    expect(result.succeeded).toBe(3);
    expect(result.failed).toHaveLength(0);
  });
});
