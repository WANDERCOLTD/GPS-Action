/**
 * Integration tests for create + update with structured event fields.
 *
 * @build-unit BU-event-time
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D073)
 *
 * Tests the router → service → prisma chain via createCaller. Mocks
 * prisma at the DB boundary (same pattern as post-create.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    postKind: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    roleGrant: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';

const mockPostCreate = vi.mocked(prisma.post.create);
const mockPostUpdate = vi.mocked(prisma.post.update);
const mockPostFindUnique = vi.mocked(prisma.post.findUnique);
const mockKindFindUnique = vi.mocked(prisma.postKind.findUnique);
const mockRoleGrantFindMany = vi.mocked(prisma.roleGrant.findMany);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);

// ── Helpers ──────────────────────────────────────────────────────────────

function authedContext(userId = 'user-1'): TRPCContext {
  return {
    user: {
      id: userId,
      email: 'test@test.com',
      displayName: 'Test User',
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

const validInput = {
  title: 'Test event post',
  body: 'A body that is long enough to clear the minimum.',
  visibility: 'public' as const,
};

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPostCreate.mockResolvedValue({ id: 'new-post-1' } as Awaited<
    ReturnType<typeof prisma.post.create>
  >);
  mockPostUpdate.mockResolvedValue({ id: 'post-1' } as Awaited<
    ReturnType<typeof prisma.post.update>
  >);
  mockAuditCreate.mockResolvedValue({} as Awaited<ReturnType<typeof prisma.auditLog.create>>);
  mockRoleGrantFindMany.mockResolvedValue(
    [] as Awaited<ReturnType<typeof prisma.roleGrant.findMany>>,
  );
});

describe('post.create with event fields', () => {
  it('persists eventAt / eventEndsAt / locationText when provided', async () => {
    const caller = createCaller(authedContext());
    await caller.post.create({
      ...validInput,
      eventAt: '2026-05-03T17:00:00.000Z',
      eventEndsAt: '2026-05-03T19:00:00.000Z',
      locationText: 'Albert Square, Manchester',
    });

    expect(mockPostCreate).toHaveBeenCalledOnce();
    const data = mockPostCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data['eventAt']).toBeInstanceOf(Date);
    expect((data['eventAt'] as Date).toISOString()).toBe('2026-05-03T17:00:00.000Z');
    expect((data['eventEndsAt'] as Date).toISOString()).toBe('2026-05-03T19:00:00.000Z');
    expect(data['locationText']).toBe('Albert Square, Manchester');
  });

  it('persists nulls when event fields are absent', async () => {
    const caller = createCaller(authedContext());
    await caller.post.create(validInput);

    const data = mockPostCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data['eventAt']).toBeNull();
    expect(data['eventEndsAt']).toBeNull();
    expect(data['locationText']).toBeNull();
  });

  it('rejects when eventEndsAt is before eventAt', async () => {
    const caller = createCaller(authedContext());
    await expect(
      caller.post.create({
        ...validInput,
        eventAt: '2026-05-03T19:00:00.000Z',
        eventEndsAt: '2026-05-03T17:00:00.000Z',
      }),
    ).rejects.toThrow();
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('accepts a start without an end', async () => {
    const caller = createCaller(authedContext());
    await caller.post.create({
      ...validInput,
      eventAt: '2026-05-03T17:00:00.000Z',
    });

    const data = mockPostCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect((data['eventAt'] as Date).toISOString()).toBe('2026-05-03T17:00:00.000Z');
    expect(data['eventEndsAt']).toBeNull();
  });

  it('rejects locationText longer than 500 chars', async () => {
    const caller = createCaller(authedContext());
    await expect(
      caller.post.create({
        ...validInput,
        locationText: 'a'.repeat(501),
      }),
    ).rejects.toThrow();
  });

  it('writes has* booleans (no PII) for the new fields to the audit log', async () => {
    const caller = createCaller(authedContext());
    await caller.post.create({
      ...validInput,
      eventAt: '2026-05-03T17:00:00.000Z',
      locationText: 'Somewhere private',
    });

    const auditData = mockAuditCreate.mock.calls[0]?.[0]?.data;
    const changes = auditData?.changes as Record<string, unknown>;
    expect(changes).toHaveProperty('hasEventAt', true);
    expect(changes).toHaveProperty('hasEventEndsAt', false);
    expect(changes).toHaveProperty('hasLocationText', true);
    // No PII — the location string itself must not appear.
    expect(JSON.stringify(changes)).not.toContain('Somewhere private');
  });
});

describe('post.update with event fields', () => {
  const postId = '00000000-0000-4000-8000-000000000001';

  it('updates event fields for the post author', async () => {
    mockPostFindUnique.mockResolvedValueOnce({
      id: postId,
      authorId: 'user-1',
      kindId: null,
      eventAt: null,
      eventEndsAt: null,
      deletedAt: null,
    } as Awaited<ReturnType<typeof prisma.post.findUnique>>);

    const caller = createCaller(authedContext('user-1'));
    await caller.post.update({
      id: postId,
      eventAt: '2026-05-10T12:00:00.000Z',
      eventEndsAt: '2026-05-10T14:00:00.000Z',
      locationText: 'Hampstead Heath',
    });

    expect(mockPostUpdate).toHaveBeenCalledOnce();
    const data = mockPostUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect((data['eventAt'] as Date).toISOString()).toBe('2026-05-10T12:00:00.000Z');
    expect((data['eventEndsAt'] as Date).toISOString()).toBe('2026-05-10T14:00:00.000Z');
    expect(data['locationText']).toBe('Hampstead Heath');
  });

  it('rejects when caller is not the author and has no elevated role', async () => {
    mockPostFindUnique.mockResolvedValueOnce({
      id: postId,
      authorId: 'someone-else',
      kindId: null,
      eventAt: null,
      eventEndsAt: null,
      deletedAt: null,
    } as Awaited<ReturnType<typeof prisma.post.findUnique>>);
    mockRoleGrantFindMany.mockResolvedValueOnce(
      [] as Awaited<ReturnType<typeof prisma.roleGrant.findMany>>,
    );

    const caller = createCaller(authedContext('user-1'));
    await expect(
      caller.post.update({
        id: postId,
        title: 'Edited title',
      }),
    ).rejects.toThrow(/not allowed/i);
    expect(mockPostUpdate).not.toHaveBeenCalled();
  });

  it('allows admin role-grant holders to edit other authors posts', async () => {
    mockPostFindUnique.mockResolvedValueOnce({
      id: postId,
      authorId: 'someone-else',
      kindId: null,
      eventAt: null,
      eventEndsAt: null,
      deletedAt: null,
    } as Awaited<ReturnType<typeof prisma.post.findUnique>>);
    mockRoleGrantFindMany.mockResolvedValueOnce([{ role: 'admin' }] as Awaited<
      ReturnType<typeof prisma.roleGrant.findMany>
    >);

    const caller = createCaller(authedContext('user-1'));
    await caller.post.update({
      id: postId,
      title: 'Edited by admin',
    });

    expect(mockPostUpdate).toHaveBeenCalledOnce();
  });

  it('rejects update when the resulting eventEndsAt would precede eventAt', async () => {
    mockPostFindUnique.mockResolvedValueOnce({
      id: postId,
      authorId: 'user-1',
      kindId: null,
      eventAt: new Date('2026-05-03T17:00:00.000Z'),
      eventEndsAt: null,
      deletedAt: null,
    } as Awaited<ReturnType<typeof prisma.post.findUnique>>);

    const caller = createCaller(authedContext('user-1'));
    await expect(
      caller.post.update({
        id: postId,
        // Set end before the existing start — invariant must trip.
        eventEndsAt: '2026-05-03T15:00:00.000Z',
      }),
    ).rejects.toThrow();
    expect(mockPostUpdate).not.toHaveBeenCalled();
  });

  it('clears event fields when explicitly set to null (explicit-clear semantic)', async () => {
    // BU-event-time / D073. The Zod transform preserves the
    // null vs. undefined distinction:
    //  - undefined → field absent → service skips it
    //  - null      → explicit clear → service writes NULL
    // This is the path the edit page takes when the user blanks a
    // previously-set event time.
    mockPostFindUnique.mockResolvedValueOnce({
      id: postId,
      authorId: 'user-1',
      kindId: null,
      eventAt: new Date('2026-05-03T17:00:00.000Z'),
      eventEndsAt: new Date('2026-05-03T19:00:00.000Z'),
      deletedAt: null,
    } as Awaited<ReturnType<typeof prisma.post.findUnique>>);

    const caller = createCaller(authedContext('user-1'));
    await caller.post.update({
      id: postId,
      eventAt: null,
      eventEndsAt: null,
    });

    const data = mockPostUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data['eventAt']).toBeNull();
    expect(data['eventEndsAt']).toBeNull();
  });

  it('throws when the post does not exist', async () => {
    mockPostFindUnique.mockResolvedValueOnce(null);

    const caller = createCaller(authedContext('user-1'));
    await expect(
      caller.post.update({
        id: postId,
        title: 'Whatever',
      }),
    ).rejects.toThrow(/not found/i);
  });
});
