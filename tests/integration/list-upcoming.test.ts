/**
 * Integration tests for the post.listUpcoming tRPC procedure.
 *
 * @build-unit BU-event-time
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D073)
 *
 * Tests the today-cutoff, ordering, kind-slug filter, range-query
 * upper bound, and visibility filtering. Mocks prisma at the DB
 * boundary like post-list.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
    },
    reaction: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    comment: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { createCaller } from '@/server/routers/_app';
import type { TRPCContext } from '@/server/lib/trpc';
import { prisma } from '@/server/db/client';
import { todayStartLondonUtc } from '@/shared/format-event-time';

const mockPostFindMany = vi.mocked(prisma.post.findMany);

function authedContext(): TRPCContext {
  return {
    user: {
      id: 'user-1',
      email: 'test@test.com',
      displayName: 'Test User',
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

function anonContext(): TRPCContext {
  return { user: null, activeRoles: [], activeScopes: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPostFindMany.mockResolvedValue([] as Awaited<ReturnType<typeof prisma.post.findMany>>);
});

describe('post.listUpcoming', () => {
  it('defaults the from cutoff to today 00:00 Europe/London', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listUpcoming();

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where;
    const eventAtClause = (where as Record<string, unknown>)['eventAt'] as Record<string, Date>;
    expect(eventAtClause).toBeDefined();
    // Within ~1s of the helper's "now" computation.
    const expected = todayStartLondonUtc();
    expect(Math.abs(eventAtClause['gte']!.getTime() - expected.getTime())).toBeLessThan(2000);
  });

  it('orders by eventAt asc, id asc', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listUpcoming();

    const orderBy = mockPostFindMany.mock.calls[0]?.[0]?.orderBy;
    expect(orderBy).toEqual([{ eventAt: 'asc' }, { id: 'asc' }]);
  });

  it('respects visibility — anonymous callers see public only', async () => {
    const caller = createCaller(anonContext());
    await caller.post.listUpcoming();

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      visibility: { in: ['public'] },
      deletedAt: null,
    });
  });

  it('respects visibility — authed callers see public + authenticated_only', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listUpcoming();

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      visibility: { in: ['public', 'authenticated_only'] },
    });
  });

  it('honours an explicit `from` argument', async () => {
    const caller = createCaller(authedContext());
    const explicitFrom = new Date('2026-06-01T00:00:00.000Z');
    await caller.post.listUpcoming({ from: explicitFrom.toISOString() });

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where;
    const eventAtClause = (where as Record<string, unknown>)['eventAt'] as Record<string, Date>;
    expect(eventAtClause['gte']?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('adds a `lte` bound when `to` is provided', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listUpcoming({
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.999Z',
    });

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where;
    const eventAtClause = (where as Record<string, unknown>)['eventAt'] as Record<string, Date>;
    expect(eventAtClause['gte']?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(eventAtClause['lte']?.toISOString()).toBe('2026-05-31T23:59:59.999Z');
  });

  it('filters by kindSlugs when provided', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listUpcoming({ kindSlugs: ['event', 'meeting'] });

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where['kind']).toEqual({ slug: { in: ['event', 'meeting'] } });
  });

  it('omits the kind clause when kindSlugs is empty', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listUpcoming({ kindSlugs: [] });

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where).not.toHaveProperty('kind');
  });

  it('caps limit at MAX_LIMIT (50)', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listUpcoming({ limit: 50 });

    const take = mockPostFindMany.mock.calls[0]?.[0]?.take;
    expect(take).toBe(50);
  });

  it('returns posts in mapped FeedPost shape', async () => {
    const now = new Date();
    mockPostFindMany.mockResolvedValueOnce([
      {
        id: 'post-event-1',
        authorId: 'user-1',
        title: 'Saturday vigil',
        body: 'A long enough body for the API to accept.',
        visibility: 'public' as const,
        activistMailerUrl: null,
        linkUrl: null,
        linkTitle: null,
        linkDescription: null,
        linkImageUrl: null,
        linkSiteName: null,
        kindId: null,
        urgency: false,
        heroImageUrl: null,
        signal: null,
        sharedToNetworkAt: null,
        groupTags: [],
        eventAt: new Date('2026-05-03T17:00:00.000Z'),
        eventEndsAt: new Date('2026-05-03T19:00:00.000Z'),
        locationText: 'Cheddar Road',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        author: {
          id: 'user-1',
          displayName: 'Test User',
          roleGrants: [],
        },
        kind: null,
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const caller = createCaller(authedContext());
    const result = await caller.post.listUpcoming();

    expect(result.posts).toHaveLength(1);
    const p = result.posts[0]!;
    expect(p.id).toBe('post-event-1');
    expect(p.eventAt).toBeInstanceOf(Date);
    expect(p.eventAt?.toISOString()).toBe('2026-05-03T17:00:00.000Z');
    expect(p.eventEndsAt?.toISOString()).toBe('2026-05-03T19:00:00.000Z');
    expect(p.locationText).toBe('Cheddar Road');
  });
});
