/**
 * Integration tests for the dev auth stub.
 *
 * @build-unit BU-001-lite
 * @spec architecture/environments.md
 *
 * Tests cookie helpers and the services/auth user resolution.
 * Mocks next/headers cookies() and prisma.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock next/headers ────────────────────────────────────────────────────

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    roleGrant: {
      findMany: vi.fn(),
    },
  },
}));

import { getUserIdFromCookie, setDevUserCookie, clearDevUserCookie } from '@/server/lib/auth';
import { resolveUser, getActiveRoles } from '@/server/services/auth';
import { prisma } from '@/server/db/client';

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockFindMany = vi.mocked(prisma.roleGrant.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  // Ensure we're not in production for cookie tests
  vi.stubEnv('NODE_ENV', 'test');
});

// ── Cookie helper tests ──────────────────────────────────────────────────

describe('getUserIdFromCookie', () => {
  it('returns null when no cookie is present', async () => {
    mockCookieStore.get.mockReturnValueOnce(undefined);
    const result = await getUserIdFromCookie();
    expect(result).toBeNull();
  });

  it('returns the user ID from the cookie', async () => {
    mockCookieStore.get.mockReturnValueOnce({ value: 'user-123' });
    const result = await getUserIdFromCookie();
    expect(result).toBe('user-123');
  });

  it('throws in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(getUserIdFromCookie()).rejects.toThrow('invoked in production');
    vi.stubEnv('NODE_ENV', 'test');
  });
});

describe('setDevUserCookie', () => {
  it('sets the cookie with correct options', async () => {
    await setDevUserCookie('user-456');
    expect(mockCookieStore.set).toHaveBeenCalledWith('gps_dev_user_id', 'user-456', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('throws in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(setDevUserCookie('user-456')).rejects.toThrow('invoked in production');
    vi.stubEnv('NODE_ENV', 'test');
  });
});

describe('clearDevUserCookie', () => {
  it('deletes the cookie', async () => {
    await clearDevUserCookie();
    expect(mockCookieStore.delete).toHaveBeenCalledWith('gps_dev_user_id');
  });

  it('throws in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(clearDevUserCookie()).rejects.toThrow('invoked in production');
    vi.stubEnv('NODE_ENV', 'test');
  });
});

// ── User resolution tests ────────────────────────────────────────────────

describe('resolveUser', () => {
  it('returns user when found and not deleted', async () => {
    const fakeUser = {
      id: 'user-1',
      email: 'test@test.com',
      displayName: 'Test',
      avatarUrl: null,
      phoneNumber: null,
      verifiedAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    mockFindUnique.mockResolvedValueOnce(fakeUser);

    const result = await resolveUser('user-1');
    expect(result).toEqual(fakeUser);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1', deletedAt: null },
    });
  });

  it('returns null when user not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const result = await resolveUser('nonexistent');
    expect(result).toBeNull();
  });
});

describe('getActiveRoles', () => {
  it('returns active roles from non-revoked grants', async () => {
    mockFindMany.mockResolvedValueOnce([{ role: 'admin' }, { role: 'queue_manager' }] as Awaited<
      ReturnType<typeof prisma.roleGrant.findMany>
    >);

    const result = await getActiveRoles('user-1');
    expect(result).toEqual(['admin', 'queue_manager']);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      select: { role: true },
    });
  });

  it('returns empty array when no active grants', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const result = await getActiveRoles('user-1');
    expect(result).toEqual([]);
  });
});
