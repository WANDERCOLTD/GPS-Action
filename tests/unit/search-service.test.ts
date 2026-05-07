/**
 * Unit tests for the search service.
 *
 * @build-unit BU-search-surface bu-search-includes-comments
 * @spec D078 (esp. §4 ranking, §5 visibility, §9 partner orgs deferred)
 * @spec build/session-briefs/bu-search-includes-comments.md
 *
 * Mocks Prisma. Locks behaviour for the five entity groups + the
 * min-query-length / type-filter / visibility-filter rules. Comments
 * are now searched in the public-thread case
 * (bu-search-includes-comments lifts D078 §2). Partner orgs always
 * returns [] (D078 §9) so no partner-org mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    region: { findMany: vi.fn() },
    request: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
    roleGrant: { count: vi.fn() },
  },
}));

import { searchAll } from '@/server/services/search';
import { prisma } from '@/server/db/client';

const mockPostFind = vi.mocked(prisma.post.findMany);
const mockUserFind = vi.mocked(prisma.user.findMany);
const mockRegionFind = vi.mocked(prisma.region.findMany);
const mockRequestFind = vi.mocked(prisma.request.findMany);
const mockCommentFind = vi.mocked(prisma.comment.findMany);
const mockRoleGrantCount = vi.mocked(prisma.roleGrant.count);

beforeEach(() => {
  mockPostFind.mockReset().mockResolvedValue([]);
  mockUserFind.mockReset().mockResolvedValue([]);
  mockRegionFind.mockReset().mockResolvedValue([]);
  mockRequestFind.mockReset().mockResolvedValue([]);
  mockCommentFind.mockReset().mockResolvedValue([]);
  mockRoleGrantCount.mockReset().mockResolvedValue(0);
});

// ── Min query length ─────────────────────────────────────────────────────

describe('searchAll — min query length', () => {
  it('returns empty groups for empty query', async () => {
    const out = await searchAll({ q: '', callerId: null });
    expect(out).toEqual({
      posts: [],
      people: [],
      regions: [],
      partnerOrgs: [],
      tickets: [],
      comments: [],
    });
    expect(mockPostFind).not.toHaveBeenCalled();
    expect(mockUserFind).not.toHaveBeenCalled();
    expect(mockRegionFind).not.toHaveBeenCalled();
    expect(mockRequestFind).not.toHaveBeenCalled();
  });

  it('returns empty groups for 1-char query (server-enforced min 2)', async () => {
    const out = await searchAll({ q: 'a', callerId: null });
    expect(out).toEqual({
      posts: [],
      people: [],
      regions: [],
      partnerOrgs: [],
      tickets: [],
      comments: [],
    });
    expect(mockPostFind).not.toHaveBeenCalled();
    expect(mockRequestFind).not.toHaveBeenCalled();
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
    expect(mockRequestFind).not.toHaveBeenCalled();
    expect(mockCommentFind).not.toHaveBeenCalled();
  });

  it('queries only people in full mode with type=people', async () => {
    await searchAll({ q: 'sharon', callerId: null, type: 'people' });
    expect(mockUserFind).toHaveBeenCalledOnce();
    expect(mockPostFind).not.toHaveBeenCalled();
    expect(mockRequestFind).not.toHaveBeenCalled();
    expect(mockCommentFind).not.toHaveBeenCalled();
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
    expect(mockRequestFind).not.toHaveBeenCalled();
    expect(mockCommentFind).not.toHaveBeenCalled();
  });
});

// ── Result shape ─────────────────────────────────────────────────────────

describe('searchAll — result shape', () => {
  it('maps post rows to PostSearchHit shape', async () => {
    const createdAt = new Date('2026-05-01T10:00:00Z');
    mockPostFind.mockResolvedValue([
      {
        id: 'post-1',
        title: 'Hendon school-gate',
        createdAt,
        urgency: true,
        signal: 'promote',
        kind: { slug: 'event', displayName: 'Event' },
        author: {
          id: 'author-1',
          displayName: 'Sharon Cohen',
          roleGrants: [{ role: 'queue_manager' }],
        },
      },
    ] as unknown as never);
    const out = await searchAll({ q: 'hendon', callerId: null });
    expect(out.posts).toEqual([
      {
        id: 'post-1',
        href: '/post/post-1',
        title: 'Hendon school-gate',
        kindSlug: 'event',
        kindDisplayName: 'Event',
        urgency: true,
        signal: 'promote',
        createdAt: createdAt.toISOString(),
        author: {
          id: 'author-1',
          displayName: 'Sharon Cohen',
          roles: ['queue_manager'],
        },
      },
    ]);
  });

  it('maps user rows to PersonSearchHit shape', async () => {
    mockUserFind.mockResolvedValue([
      { id: 'user-1', displayName: 'Sharon Levine', roleGrants: [{ role: 'admin' }] },
    ] as unknown as never);
    const out = await searchAll({ q: 'sharon', callerId: null });
    expect(out.people).toEqual([
      {
        id: 'user-1',
        href: '/profile/user-1',
        displayName: 'Sharon Levine',
        roles: ['admin'],
      },
    ]);
  });

  it('maps region rows to RegionSearchHit shape', async () => {
    mockRegionFind.mockResolvedValue([
      { id: 'region-1', slug: 'hendon', displayName: 'Hendon' },
    ] as unknown as never);
    const out = await searchAll({ q: 'hendon', callerId: null });
    expect(out.regions).toEqual([
      {
        id: 'region-1',
        href: '/regions/hendon',
        displayName: 'Hendon',
        slug: 'hendon',
      },
    ]);
  });
});

// ── Tickets (bu-search-includes-kanban) ─────────────────────────────────

describe('searchTickets — auth gate', () => {
  it('returns no tickets for unauthenticated callers', async () => {
    const out = await searchAll({ q: 'hendon', callerId: null });
    expect(out.tickets).toEqual([]);
    // The findMany call is short-circuited inside searchTickets — never
    // hits the DB for null callers.
    expect(mockRequestFind).not.toHaveBeenCalled();
  });
});

describe('searchTickets — membership gate', () => {
  it('member callers run the request query with a memberships gate', async () => {
    mockRoleGrantCount.mockResolvedValue(0); // not a sysadmin
    await searchAll({ q: 'hendon', callerId: 'user-1' });
    expect(mockRequestFind).toHaveBeenCalledOnce();
    const where = mockRequestFind.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      deletedAt: null,
      status: { in: ['backlog', 'active'] },
      requestGroups: {
        some: {
          deletedAt: null,
          group: {
            deletedAt: null,
            memberships: {
              some: { userId: 'user-1', leftAt: null, deletedAt: null },
            },
          },
        },
      },
    });
  });

  it('sysadmin callers skip the membership gate (no requestGroups in where)', async () => {
    mockRoleGrantCount.mockResolvedValue(1); // active admin grant
    await searchAll({ q: 'hendon', callerId: 'admin-1' });
    expect(mockRequestFind).toHaveBeenCalledOnce();
    const where = mockRequestFind.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.requestGroups).toBeUndefined();
    expect(where).toMatchObject({
      deletedAt: null,
      status: { in: ['backlog', 'active'] },
    });
  });

  it('always restricts to backlog/active status (excludes done & abandoned)', async () => {
    mockRoleGrantCount.mockResolvedValue(0);
    await searchAll({ q: 'hendon', callerId: 'user-1' });
    const where = mockRequestFind.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ status: { in: ['backlog', 'active'] } });
  });
});

describe('searchTickets — result shape', () => {
  it('maps request rows to TicketSearchHit and dedupes via originating group', async () => {
    const createdAt = new Date('2026-05-04T09:00:00Z');
    mockRoleGrantCount.mockResolvedValue(0);
    mockRequestFind.mockResolvedValue([
      {
        id: 'tic-1',
        title: 'Hendon school-gate roster',
        status: 'active',
        urgency: true,
        createdAt,
        requestGroups: [{ group: { slug: 'hendon-team', displayName: 'Hendon team' } }],
      },
    ] as unknown as never);
    const out = await searchAll({ q: 'hendon', callerId: 'user-1' });
    expect(out.tickets).toEqual([
      {
        id: 'tic-1',
        href: '/board/hendon-team/tic-1',
        title: 'Hendon school-gate roster',
        status: 'active',
        urgency: true,
        groupSlug: 'hendon-team',
        groupDisplayName: 'Hendon team',
        createdAt: createdAt.toISOString(),
      },
    ]);
  });

  it('drops rows that have no originating RequestGroup link', async () => {
    mockRoleGrantCount.mockResolvedValue(0);
    mockRequestFind.mockResolvedValue([
      {
        id: 'tic-1',
        title: 'Stale flag review',
        status: 'active',
        urgency: false,
        createdAt: new Date(),
        requestGroups: [], // no originating link → drop
      },
    ] as unknown as never);
    const out = await searchAll({ q: 'flag', callerId: 'user-1' });
    expect(out.tickets).toEqual([]);
  });
});

describe('searchTickets — type filter', () => {
  it('queries only tickets in full mode with type=tickets', async () => {
    mockRoleGrantCount.mockResolvedValue(0);
    await searchAll({ q: 'hendon', callerId: 'user-1', type: 'tickets' });
    expect(mockRequestFind).toHaveBeenCalledOnce();
    expect(mockPostFind).not.toHaveBeenCalled();
    expect(mockUserFind).not.toHaveBeenCalled();
    expect(mockRegionFind).not.toHaveBeenCalled();
    expect(mockCommentFind).not.toHaveBeenCalled();
  });

  it('queries tickets alongside other groups in typeahead mode', async () => {
    mockRoleGrantCount.mockResolvedValue(0);
    await searchAll({ q: 'hendon', callerId: 'user-1' });
    expect(mockRequestFind).toHaveBeenCalledOnce();
    expect(mockPostFind).toHaveBeenCalledOnce();
  });

  it('full mode without type=tickets does not run the request query', async () => {
    await searchAll({ q: 'hendon', callerId: 'user-1', type: 'posts' });
    expect(mockRequestFind).not.toHaveBeenCalled();
  });
});

// ── Comments (bu-search-includes-comments) ─────────────────────────────

describe('searchComments — hard filters (kind, source, audience, deletedAt)', () => {
  it('always restricts to kind=comment, source=human, audience=all, deletedAt=null', async () => {
    await searchAll({ q: 'hendon', callerId: 'user-1' });
    expect(mockCommentFind).toHaveBeenCalledOnce();
    const where = mockCommentFind.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where).toMatchObject({
      deletedAt: null,
      kind: 'comment',
      source: 'human',
      audience: 'all',
    });
  });

  it('searches Comment.body with case-insensitive contains', async () => {
    await searchAll({ q: 'Hendon', callerId: 'user-1' });
    const where = mockCommentFind.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.body).toEqual({ contains: 'Hendon', mode: 'insensitive' });
  });
});

describe('searchComments — visibility gate (post comments)', () => {
  it('anonymous callers — only public-visibility post comments, no ticket comments', async () => {
    await searchAll({ q: 'hendon', callerId: null });
    expect(mockCommentFind).toHaveBeenCalledOnce();
    const where = mockCommentFind.mock.calls[0]?.[0]?.where as { OR: unknown[] };
    expect(where.OR).toHaveLength(1);
    expect(where.OR[0]).toMatchObject({
      post: {
        deletedAt: null,
        status: 'published',
        visibility: { in: ['public'] },
      },
    });
  });

  it('authenticated callers — post comments include public + authenticated_only', async () => {
    mockRoleGrantCount.mockResolvedValue(0);
    await searchAll({ q: 'hendon', callerId: 'user-1' });
    const where = mockCommentFind.mock.calls[0]?.[0]?.where as { OR: unknown[] };
    expect(where.OR[0]).toMatchObject({
      post: {
        deletedAt: null,
        status: 'published',
        visibility: { in: ['public', 'authenticated_only'] },
      },
    });
  });
});

describe('searchComments — visibility gate (ticket comments)', () => {
  it('anonymous callers — no ticket-comment branch in OR', async () => {
    await searchAll({ q: 'hendon', callerId: null });
    const where = mockCommentFind.mock.calls[0]?.[0]?.where as { OR: unknown[] };
    expect(where.OR.find((b) => (b as Record<string, unknown>).request)).toBeUndefined();
  });

  it('member callers — ticket-comment branch carries the membership gate', async () => {
    mockRoleGrantCount.mockResolvedValue(0);
    await searchAll({ q: 'hendon', callerId: 'user-1' });
    const where = mockCommentFind.mock.calls[0]?.[0]?.where as { OR: unknown[] };
    const ticketBranch = where.OR.find((b) => (b as Record<string, unknown>).request) as
      | Record<string, unknown>
      | undefined;
    expect(ticketBranch).toBeDefined();
    expect(ticketBranch?.request).toMatchObject({
      deletedAt: null,
      status: { in: ['backlog', 'active'] },
      requestGroups: {
        some: {
          deletedAt: null,
          group: {
            deletedAt: null,
            memberships: {
              some: { userId: 'user-1', leftAt: null, deletedAt: null },
            },
          },
        },
      },
    });
  });

  it('sysadmin callers — ticket-comment branch skips the membership gate', async () => {
    mockRoleGrantCount.mockResolvedValue(1);
    await searchAll({ q: 'hendon', callerId: 'admin-1' });
    const where = mockCommentFind.mock.calls[0]?.[0]?.where as { OR: unknown[] };
    const ticketBranch = where.OR.find((b) => (b as Record<string, unknown>).request) as
      | Record<string, unknown>
      | undefined;
    const req = ticketBranch?.request as Record<string, unknown>;
    expect(req).toMatchObject({
      deletedAt: null,
      status: { in: ['backlog', 'active'] },
    });
    expect(req.requestGroups).toBeUndefined();
  });
});

describe('searchComments — type filter', () => {
  it('full mode with type=comments runs only the comment query', async () => {
    await searchAll({ q: 'hendon', callerId: 'user-1', type: 'comments' });
    expect(mockCommentFind).toHaveBeenCalledOnce();
    expect(mockPostFind).not.toHaveBeenCalled();
    expect(mockUserFind).not.toHaveBeenCalled();
    expect(mockRegionFind).not.toHaveBeenCalled();
    expect(mockRequestFind).not.toHaveBeenCalled();
  });

  it('full mode with a different type does not run the comment query', async () => {
    await searchAll({ q: 'hendon', callerId: 'user-1', type: 'posts' });
    expect(mockCommentFind).not.toHaveBeenCalled();
  });

  it('typeahead runs the comment query alongside other groups', async () => {
    await searchAll({ q: 'hendon', callerId: 'user-1' });
    expect(mockCommentFind).toHaveBeenCalledOnce();
    expect(mockPostFind).toHaveBeenCalledOnce();
  });
});

describe('searchComments — result shape', () => {
  it('maps post-parented rows to CommentSearchHit (parentKind=post, /post href)', async () => {
    const createdAt = new Date('2026-05-04T09:00:00Z');
    mockCommentFind.mockResolvedValue([
      {
        id: 'c-1',
        body: 'Worked great in Hendon last week.',
        createdAt,
        postId: 'post-1',
        requestId: null,
        author: { displayName: 'Sharon Cohen' },
        post: { id: 'post-1', title: 'Hendon school-gate' },
        request: null,
      },
    ] as unknown as never);
    const out = await searchAll({ q: 'hendon', callerId: 'user-1' });
    expect(out.comments).toEqual([
      {
        id: 'c-1',
        parentKind: 'post',
        parentId: 'post-1',
        parentTitle: 'Hendon school-gate',
        parentHref: '/post/post-1',
        authorDisplayName: 'Sharon Cohen',
        excerpt: 'Worked great in Hendon last week.',
        createdAt: createdAt.toISOString(),
      },
    ]);
  });

  it('maps ticket-parented rows to CommentSearchHit (parentKind=ticket, /board href)', async () => {
    const createdAt = new Date('2026-05-04T09:00:00Z');
    mockCommentFind.mockResolvedValue([
      {
        id: 'c-2',
        body: 'Roster confirmed.',
        createdAt,
        postId: null,
        requestId: 'req-1',
        author: { displayName: 'Dani' },
        post: null,
        request: {
          id: 'req-1',
          title: 'Hendon school-gate roster',
          requestGroups: [{ group: { slug: 'hendon-team' } }],
        },
      },
    ] as unknown as never);
    const out = await searchAll({ q: 'roster', callerId: 'user-1' });
    expect(out.comments).toEqual([
      {
        id: 'c-2',
        parentKind: 'ticket',
        parentId: 'req-1',
        parentTitle: 'Hendon school-gate roster',
        parentHref: '/board/hendon-team/req-1',
        authorDisplayName: 'Dani',
        excerpt: 'Roster confirmed.',
        createdAt: createdAt.toISOString(),
      },
    ]);
  });

  it('drops ticket-parent rows with no originating RequestGroup link', async () => {
    mockCommentFind.mockResolvedValue([
      {
        id: 'c-3',
        body: 'Note on a vetting flow.',
        createdAt: new Date(),
        postId: null,
        requestId: 'req-flag',
        author: { displayName: 'Mod' },
        post: null,
        request: {
          id: 'req-flag',
          title: 'Stale flag review',
          requestGroups: [], // no originating link → drop
        },
      },
    ] as unknown as never);
    const out = await searchAll({ q: 'flag', callerId: 'user-1' });
    expect(out.comments).toEqual([]);
  });

  it('clamps the excerpt to ≤120 chars with a trailing ellipsis when truncated', async () => {
    const long = 'a'.repeat(200);
    mockCommentFind.mockResolvedValue([
      {
        id: 'c-4',
        body: long,
        createdAt: new Date('2026-05-04T09:00:00Z'),
        postId: 'post-1',
        requestId: null,
        author: { displayName: 'Sharon' },
        post: { id: 'post-1', title: 'Hendon' },
        request: null,
      },
    ] as unknown as never);
    const out = await searchAll({ q: 'aa', callerId: null });
    const excerpt = out.comments[0]?.excerpt ?? '';
    expect(excerpt.endsWith('…')).toBe(true);
    // 120 chars + the single ellipsis char.
    expect(excerpt.length).toBe(121);
  });

  it('does not append an ellipsis when the body is short', async () => {
    mockCommentFind.mockResolvedValue([
      {
        id: 'c-5',
        body: 'short body',
        createdAt: new Date('2026-05-04T09:00:00Z'),
        postId: 'post-1',
        requestId: null,
        author: { displayName: 'Sharon' },
        post: { id: 'post-1', title: 'Hendon' },
        request: null,
      },
    ] as unknown as never);
    const out = await searchAll({ q: 'short', callerId: null });
    expect(out.comments[0]?.excerpt).toBe('short body');
  });
});
