/**
 * Integration tests for the post.create tRPC procedure.
 *
 * @build-unit BU-composer
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D045)
 *
 * Tests the router → service → prisma chain via createCaller.
 * Mocks prisma at the DB boundary (same pattern as post-list.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      create: vi.fn(),
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
import { TRPCError } from '@trpc/server';

const mockPostCreate = vi.mocked(prisma.post.create);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);

// ── Helpers ──────────────────────────────────────────────────────────────

function authedContext(): TRPCContext {
  return {
    user: {
      id: 'user-1',
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

function anonContext(): TRPCContext {
  return { user: null, activeRoles: [], activeScopes: [] };
}

const validInput = {
  title: 'Test post title',
  body: 'This is a valid body that is long enough',
  visibility: 'public' as const,
};

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPostCreate.mockResolvedValue({ id: 'new-post-1' } as Awaited<
    ReturnType<typeof prisma.post.create>
  >);
  mockAuditCreate.mockResolvedValue({} as Awaited<ReturnType<typeof prisma.auditLog.create>>);
});

describe('post.create', () => {
  it('creates a post with valid minimal input', async () => {
    const caller = createCaller(authedContext());
    const result = await caller.post.create(validInput);

    expect(result).toEqual({ id: 'new-post-1' });
    expect(mockPostCreate).toHaveBeenCalledOnce();
  });

  it('creates a post with valid input + AM URL', async () => {
    const caller = createCaller(authedContext());
    const result = await caller.post.create({
      ...validInput,
      activistMailerUrl: 'https://activistmailer.com/campaigns/123',
    });

    expect(result).toEqual({ id: 'new-post-1' });
    const createCall = mockPostCreate.mock.calls[0];
    expect(createCall?.[0]?.data).toMatchObject({
      activistMailerUrl: 'https://activistmailer.com/campaigns/123',
    });
  });

  it('stores empty AM URL as null', async () => {
    const caller = createCaller(authedContext());
    await caller.post.create({
      ...validInput,
      activistMailerUrl: '',
    });

    const createCall = mockPostCreate.mock.calls[0];
    expect(createCall?.[0]?.data).toMatchObject({
      activistMailerUrl: null,
    });
  });

  it('rejects title shorter than 3 chars', async () => {
    const caller = createCaller(authedContext());
    await expect(caller.post.create({ ...validInput, title: 'ab' })).rejects.toThrow();
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('rejects body shorter than 10 chars', async () => {
    const caller = createCaller(authedContext());
    await expect(caller.post.create({ ...validInput, body: 'Too short' })).rejects.toThrow();
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('rejects body longer than 10000 chars', async () => {
    const caller = createCaller(authedContext());
    await expect(caller.post.create({ ...validInput, body: 'a'.repeat(10001) })).rejects.toThrow();
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('rejects AM URL without https', async () => {
    const caller = createCaller(authedContext());
    await expect(
      caller.post.create({
        ...validInput,
        activistMailerUrl: 'http://activistmailer.com/campaigns/1',
      }),
    ).rejects.toThrow();
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('rejects AM URL from disallowed domain', async () => {
    const caller = createCaller(authedContext());
    await expect(
      caller.post.create({
        ...validInput,
        activistMailerUrl: 'https://evil.com/phishing',
      }),
    ).rejects.toThrow();
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('throws UNAUTHORIZED for unauthenticated context', async () => {
    const caller = createCaller(anonContext());

    try {
      await caller.post.create(validInput);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('UNAUTHORIZED');
    }

    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it('writes audit log entry with correct shape', async () => {
    const caller = createCaller(authedContext());
    await caller.post.create(validInput);

    expect(mockAuditCreate).toHaveBeenCalledOnce();
    const auditCall = mockAuditCreate.mock.calls[0]?.[0]?.data;
    expect(auditCall).toMatchObject({
      action: 'post_created',
      entityType: 'post',
      entityId: 'new-post-1',
      userId: 'user-1',
    });
    // Verify no body content in audit (PII safety)
    const changes = auditCall?.changes as Record<string, unknown>;
    expect(changes).not.toHaveProperty('body');
    expect(changes).not.toHaveProperty('title');
    expect(changes).toHaveProperty('titleLength');
    expect(changes).toHaveProperty('bodyLength');
    expect(changes).toHaveProperty('visibility');
    expect(changes).toHaveProperty('hasActivistMailerUrl');

    const context = auditCall?.context as Record<string, unknown>;
    expect(context).toEqual({ source: 'composer' });
  });

  it('defaults visibility to public when omitted', async () => {
    const caller = createCaller(authedContext());
    const { visibility: _, ...noVisibility } = validInput;
    await caller.post.create(noVisibility);

    const createCall = mockPostCreate.mock.calls[0];
    expect(createCall?.[0]?.data).toMatchObject({
      visibility: 'public',
    });
  });
});
