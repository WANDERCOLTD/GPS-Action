/**
 * Integration tests for the post.listNearby tRPC procedure.
 *
 * @build-unit BU-calendar-near-me
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D076)
 *
 * Asserts:
 *  - Filters out online posts (isOnline=true) and rows with NULL coords.
 *  - Sorts by Haversine distance ascending.
 *  - Honours the public/auth visibility filter (mirrors listUpcoming).
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

interface MockPostInput {
  id: string;
  latitude: number | null;
  longitude: number | null;
  visibility?: 'public' | 'authenticated_only';
}

function makeMockPost(over: MockPostInput) {
  const now = new Date();
  return {
    id: over.id,
    authorId: 'user-1',
    title: 'Mock event',
    body: 'Body content for the mock.',
    visibility: over.visibility ?? 'public',
    activistMailerUrl: null,
    linkUrl: null,
    linkTitle: null,
    linkDescription: null,
    linkImageUrl: null,
    linkSiteName: null,
    isActivistMailer: false,
    kindId: null,
    urgency: false,
    heroImageUrl: null,
    signal: null,
    sharedToNetworkAt: null,
    status: 'published',
    publishedAt: now,
    reviewRequestId: null,
    reviewedByUserId: null,
    groupTags: [],
    eventAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    eventEndsAt: null,
    locationText: 'Somewhere',
    latitude: over.latitude,
    longitude: over.longitude,
    isOnline: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    author: { id: 'user-1', displayName: 'Test', roleGrants: [] },
    kind: null,
    reviewedBy: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPostFindMany.mockResolvedValue([] as Awaited<ReturnType<typeof prisma.post.findMany>>);
});

describe('post.listNearby', () => {
  it('passes isOnline=false and latitude not null to the where clause', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listNearby({ lat: 51.5, lng: -0.1 });

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where['isOnline']).toBe(false);
    expect(where['latitude']).toEqual({ not: null });
    expect(where['deletedAt']).toBeNull();
  });

  it('respects visibility — anonymous callers see public only', async () => {
    const caller = createCaller(anonContext());
    await caller.post.listNearby({ lat: 51.5, lng: -0.1 });

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ visibility: { in: ['public'] } });
  });

  it('respects visibility — authed callers see public + authenticated_only', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listNearby({ lat: 51.5, lng: -0.1 });

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ visibility: { in: ['public', 'authenticated_only'] } });
  });

  it('filters by kindSlugs when provided', async () => {
    const caller = createCaller(authedContext());
    await caller.post.listNearby({ lat: 51.5, lng: -0.1, kindSlugs: ['event'] });

    const where = mockPostFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where['kind']).toEqual({ slug: { in: ['event'] } });
  });

  it('sorts results by ascending Haversine distance', async () => {
    // Caller is in Manchester. Candidates: Manchester (≈0), Bristol
    // (≈225 km), London (≈263 km). DB order is intentionally not by
    // distance — service must re-sort.
    mockPostFindMany.mockResolvedValueOnce([
      makeMockPost({ id: 'london', latitude: 51.5074, longitude: -0.1278 }),
      makeMockPost({ id: 'bristol', latitude: 51.4537, longitude: -2.5919 }),
      makeMockPost({ id: 'manchester', latitude: 53.4808, longitude: -2.2426 }),
    ] as unknown as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const caller = createCaller(authedContext());
    const result = await caller.post.listNearby({ lat: 53.4808, lng: -2.2426 });

    expect(result.posts.map((p) => p.id)).toEqual(['manchester', 'bristol', 'london']);
    expect(result.posts[0]!.distanceKm).toBeCloseTo(0, 1);
    // Strictly ascending.
    expect(result.posts[1]!.distanceKm).toBeLessThan(result.posts[2]!.distanceKm);
  });

  it('drops rows whose lat/lng are null even if Prisma returns them', async () => {
    mockPostFindMany.mockResolvedValueOnce([
      makeMockPost({ id: 'with-coords', latitude: 53.48, longitude: -2.24 }),
      makeMockPost({ id: 'no-coords', latitude: null, longitude: null }),
    ] as unknown as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const caller = createCaller(authedContext());
    const result = await caller.post.listNearby({ lat: 53.48, lng: -2.24 });

    expect(result.posts.map((p) => p.id)).toEqual(['with-coords']);
  });

  it('returns the distanceKm field on every result', async () => {
    mockPostFindMany.mockResolvedValueOnce([
      makeMockPost({ id: 'a', latitude: 51.4537, longitude: -2.5919 }),
    ] as unknown as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const caller = createCaller(authedContext());
    const result = await caller.post.listNearby({ lat: 51.5074, lng: -0.1278 });

    expect(result.posts).toHaveLength(1);
    expect(typeof result.posts[0]!.distanceKm).toBe('number');
    expect(result.posts[0]!.distanceKm).toBeGreaterThan(150);
  });
});
