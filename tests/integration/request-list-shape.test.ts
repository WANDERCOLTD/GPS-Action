/**
 * @build-unit BU-requests-card-lift
 * @spec build/session-briefs/bu-requests-card-lift.md
 *
 * Service-layer shape test for the RequestRow lift. Confirms:
 *
 *   - REQUEST_INCLUDE pulls `avatarUrl` on createdBy + claimedBy.
 *   - mapRequest exposes the row's `priority` enum on RequestListItem.
 *   - The shape covers both submitter and reviewer query paths.
 *
 * Mocks prisma at the boundary (same pattern as post-list.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    request: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/server/db/client';
import { listRequestsForSubmitter, listRequestsForReviewer } from '@/server/services/request';

const mockFindMany = vi.mocked(prisma.request.findMany);

function makeDbRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    type: 'vetting' as const,
    status: 'unclaimed' as const,
    priority: 'high' as const,
    context: { summary: 'Test summary' },
    regionSlug: null,
    groupTags: [],
    createdAt: new Date('2026-04-30T10:00:00Z'),
    createdByUserId: 'u-submitter',
    claimedByUserId: null,
    claimedAt: null,
    claimExpiresAt: null,
    lastHeartbeatAt: null,
    resolvedAt: null,
    resolvedByUserId: null,
    resolutionNotes: null,
    urgency: false,
    urgencyExpiresAt: null,
    kindId: null,
    deletedAt: null,
    updatedAt: new Date('2026-04-30T10:00:00Z'),
    createdBy: {
      id: 'u-submitter',
      displayName: 'Sharon Cohen',
      avatarUrl: 'https://cdn.example/sharon.jpg',
    },
    claimedBy: null,
    kind: null,
    ...overrides,
  };
}

describe('RequestListItem shape — BU-requests-card-lift', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('exposes avatarUrl on createdBy in the submitter query', async () => {
    mockFindMany.mockResolvedValue([makeDbRequest()] as never);
    const rows = await listRequestsForSubmitter('u-submitter');
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row?.createdBy).toEqual({
      id: 'u-submitter',
      displayName: 'Sharon Cohen',
      avatarUrl: 'https://cdn.example/sharon.jpg',
    });
  });

  it('exposes priority on RequestListItem', async () => {
    mockFindMany.mockResolvedValue([
      makeDbRequest({ priority: 'urgent' }),
      makeDbRequest({ id: 'req-2', priority: 'low' }),
    ] as never);
    const rows = await listRequestsForSubmitter('u-submitter');
    expect(rows.map((r) => r.priority)).toEqual(['urgent', 'low']);
  });

  it('asks Prisma for avatarUrl in the include shape (createdBy + claimedBy)', async () => {
    mockFindMany.mockResolvedValue([] as never);
    await listRequestsForReviewer({
      callerId: 'u',
      hasUnscopedQueueManager: true,
      hasAdmin: false,
      scopedTypes: [],
    });
    expect(mockFindMany).toHaveBeenCalled();
    const args = mockFindMany.mock.calls[0]?.[0] as
      | {
          include?: {
            createdBy?: { select?: Record<string, boolean> };
            claimedBy?: { select?: Record<string, boolean> };
          };
        }
      | undefined;
    expect(args?.include?.createdBy?.select?.avatarUrl).toBe(true);
    expect(args?.include?.claimedBy?.select?.avatarUrl).toBe(true);
  });

  it('exposes avatarUrl on claimedBy when claimed', async () => {
    mockFindMany.mockResolvedValue([
      makeDbRequest({
        status: 'claimed',
        claimedByUserId: 'u-claimer',
        claimedAt: new Date(),
        claimedBy: {
          id: 'u-claimer',
          displayName: 'Eddie Stone',
          avatarUrl: null,
        },
      }),
    ] as never);
    const rows = await listRequestsForSubmitter('u-submitter');
    expect(rows[0]?.claimedBy).toEqual({
      id: 'u-claimer',
      displayName: 'Eddie Stone',
      avatarUrl: null,
    });
  });
});
