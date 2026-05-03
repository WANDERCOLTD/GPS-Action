/**
 * Unit tests for the search service.
 *
 * @build-unit BU-search-surface
 * @spec D078 (esp. §2 comments excluded, §4 ranking, §5 visibility, §9 partner orgs deferred)
 *
 * Mocks Prisma. Locks behaviour for the four entity groups + the
 * min-query-length / type-filter / visibility-filter rules. Comments
 * are not searched (D078 §2) so there's no comment mock; partner orgs
 * always returns [] (D078 §9) so no partner-org mock either.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    region: { findMany: vi.fn() },
  },
}));

import { searchAll } from '@/server/services/search';
import { prisma } from '@/server/db/client';

const mockPostFind = vi.mocked(prisma.post.findMany);
const mockUserFind = vi.mocked(prisma.user.findMany);
const mockRegionFind = vi.mocked(prisma.region.findMany);

beforeEach(() => {
  mockPostFind.mockReset().mockResolvedValue([]);
  mockUserFind.mockReset().mockResolvedValue([]);
  mockRegionFind.mockReset().mockResolvedValue([]);
});

// ── Min query length ─────────────────────────────────────────────────────

describe('searchAll — min query length', () => {
  it('returns empty groups for empty query', async () => {
    const out = await searchAll({ q: '', callerId: null });
    expect(out).toEqual({ posts: [], people: [], regions: [], partnerOrgs: [] });
    expect(mockPostFind).not.toHaveBeenCalled();
    expect(mockUserFind).not.toHaveBeenCalled();
    expect(mockRegionFind).not.toHaveBeenCalled();
  });

  it('returns empty groups for 1-char query (server-enforced min 2)', async () => {
    const out = await searchAll({ q: 'a', callerId: null });
    expect(out).toEqual({ posts: [], people: [], regions: [], partnerOrgs: [] });
    expect(mockPostFind).not.toHaveBeenCalled();
  });

  it('queries the DB for 2-char query', async () => {
    await searchAll({ q: 'he', callerId: null });
    expect(mockPostFind).toHaveBeenCalledOnce();
  });

  it('trims whitespace before measuring length', async () => {
    await searchAll({ q: '  a  ', callerId: null });
    // 'a' after trim → still under min, no DB calls
    expect(mockPostFind).not.toHaveBeenCalled();
  });
});

// ── Visibility (D078 §5) ─────────────────────────────────────────────────

describe('searchAll — visibility filter', () => {
  it('uses public-only visibility when callerId is null', async () => {
    await searchAll({ q: 'hendon', callerId: null });
    const where = mockPostFind.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ visibility: { in: ['public'] } });
  });

  it('uses public + authenticated_only visibility when callerId is set', async () => {
    await searchAll({ q: 'hendon', callerId: 'user-1' });
    const where = mockPostFind.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      visibility: { in: ['public', 'authenticated_only'] },
    });
  });

  it('always excludes soft-deleted and unpublished posts', async () => {
    await searchAll({ q: 'hendon', callerId: 'user-1' });
    const where = mockPostFind.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ deletedAt: null, status: 'published' });
  });
});

// ── Type filter (typeahead vs full mode) ─────────────────────────────────

describe('searchAll — type filter', () => {
  it('queries all groups in typeahead mode (no type)', async () => {
    await searchAll({ q: 'hendon', callerId: null });
    expect(mockPostFind).toHaveBeenCalledOnce();
    expect(mockUserFind).toHaveBeenCalledOnce();
    expect(mockRegionFind).toHaveBeenCalledOnce();
  });

  it('queries only posts in full mode with type=posts', async () => {
    await searchAll({ q: 'hendon', callerId: null, type: 'posts' });
    expect(mockPostFind).toHaveBeenCalledOnce();
    expect(mockUserFind).not.toHaveBeenCalled();
    expect(mockRegionFind).not.toHaveBeenCalled();
  });

  it('queries only people in full mode with type=people', async () => {
    await searchAll({ q: 'sharon', callerId: null, type: 'people' });
    expect(mockUserFind).toHaveBeenCalledOnce();
    expect(mockPostFind).not.toHaveBeenCalled();
  });

  it('typeahead default cap is 3 per group', async () => {
    await searchAll({ q: 'hendon', callerId: null });
    expect(mockPostFind.mock.calls[0]?.[0]?.take).toBe(3);
  });

  it('full mode default cap is 20', async () => {
    await searchAll({ q: 'hendon', callerId: null, type: 'posts' });
    expect(mockPostFind.mock.calls[0]?.[0]?.take).toBe(20);
  });

  it('caller-supplied limit overrides defaults', async () => {
    await searchAll({ q: 'hendon', callerId: null, limit: 7 });
    expect(mockPostFind.mock.calls[0]?.[0]?.take).toBe(7);
  });
});

// ── Partner orgs (D078 §9) ───────────────────────────────────────────────

describe('searchAll — partner orgs deferred', () => {
  it('always returns empty partner-orgs group (no entity yet)', async () => {
    const out = await searchAll({ q: 'jcc', callerId: 'user-1' });
    expect(out.partnerOrgs).toEqual([]);
  });

  it('still returns empty partner-orgs in full mode with type=partnerOrgs', async () => {
    const out = await searchAll({ q: 'jcc', callerId: 'user-1', type: 'partnerOrgs' });
    expect(out.partnerOrgs).toEqual([]);
    // No other group is touched in full mode
    expect(mockPostFind).not.toHaveBeenCalled();
    expect(mockUserFind).not.toHaveBeenCalled();
    expect(mockRegionFind).not.toHaveBeenCalled();
  });
});

// ── Result shape ─────────────────────────────────────────────────────────

describe('searchAll — result shape', () => {
  it('maps post rows to SearchHit shape', async () => {
    const createdAt = new Date('2026-05-01T10:00:00Z');
    mockPostFind.mockResolvedValue([
      { id: 'post-1', title: 'Hendon school-gate', createdAt },
    ] as unknown as never);
    const out = await searchAll({ q: 'hendon', callerId: null });
    expect(out.posts).toEqual([
      {
        id: 'post-1',
        label: 'Hendon school-gate',
        href: '/post/post-1',
        meta: createdAt.toISOString(),
      },
    ]);
  });

  it('maps user rows to SearchHit shape', async () => {
    mockUserFind.mockResolvedValue([
      { id: 'user-1', displayName: 'Sharon Levine' },
    ] as unknown as never);
    const out = await searchAll({ q: 'sharon', callerId: null });
    expect(out.people).toEqual([{ id: 'user-1', label: 'Sharon Levine', href: '/profile/user-1' }]);
  });

  it('maps region rows with slug as meta', async () => {
    mockRegionFind.mockResolvedValue([
      { id: 'region-1', slug: 'hendon', displayName: 'Hendon' },
    ] as unknown as never);
    const out = await searchAll({ q: 'hendon', callerId: null });
    expect(out.regions).toEqual([
      { id: 'region-1', label: 'Hendon', href: '/regions/hendon', meta: 'hendon' },
    ]);
  });
});
