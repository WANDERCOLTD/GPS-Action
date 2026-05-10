/**
 * Integration tests for getTicketDetail (PR #5a — Surface 2 read query).
 *
 * Mocks the Prisma client; asserts:
 *   - returns null when the viewer's group has no link to the ticket.
 *   - returns null when the link is soft-deleted.
 *   - returns null when the Request is missing or soft-deleted.
 *   - maps assignees, subscribers, and groups into the typed shape.
 *   - reads typed Request.title + Request.body (ADR-0013 / D079); no
 *     fallback shapes from context JSON.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    requestGroup: {
      findUnique: vi.fn(),
    },
    request: {
      findFirst: vi.fn(),
    },
  },
}));

import { getTicketDetail } from '@/server/services/board';
import { prisma } from '@/server/db/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockedRequestGroup = vi.mocked(prisma.requestGroup) as any;
const mockedRequest = vi.mocked(prisma.request) as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getTicketDetail', () => {
  it('returns null when the viewer-group link does not exist', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue(null);
    const result = await getTicketDetail({ requestId: 'r1', viewerGroupId: 'g1' });
    expect(result).toBeNull();
    expect(mockedRequest.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when the viewer-group link is soft-deleted', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({
      id: 'rg1',
      deletedAt: new Date('2026-05-01'),
    });
    const result = await getTicketDetail({ requestId: 'r1', viewerGroupId: 'g1' });
    expect(result).toBeNull();
    expect(mockedRequest.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when the Request is missing or soft-deleted', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue(null);
    const result = await getTicketDetail({ requestId: 'r1', viewerGroupId: 'g1' });
    expect(result).toBeNull();
  });

  it('maps the typed Request fields + relations into TicketDetail', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: 'Write press release',
      body: 'Long-form description here.',
      status: 'active',
      urgency: true,
      createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-04'),
      lastActivityAt: new Date('2026-05-06'),
      kind: { slug: 'task', displayName: 'Task' },
      assignments: [
        {
          assignedAt: new Date('2026-05-02'),
          user: { id: 'u1', displayName: 'Alice', avatarUrl: null },
        },
      ],
      subscriptions: [
        { user: { id: 'u1', displayName: 'Alice', avatarUrl: null } },
        { user: { id: 'u2', displayName: 'Bob', avatarUrl: 'https://x/y.png' } },
      ],
      requestGroups: [
        {
          groupId: 'g1',
          origin: 'originating',
          isUrgent: false,
          columnId: 'c1',
          group: { slug: 'writers', displayName: 'Writers' },
        },
        {
          groupId: 'g2',
          origin: 'workflow_share',
          isUrgent: true,
          columnId: null,
          group: { slug: 'it', displayName: 'IT' },
        },
      ],
    });

    const result = await getTicketDetail({ requestId: 'r1', viewerGroupId: 'g1' });
    expect(result).toEqual({
      id: 'r1',
      title: 'Write press release',
      body: 'Long-form description here.',
      status: 'active',
      urgency: true,
      kindSlug: 'task',
      kindDisplayName: 'Task',
      assignees: [
        {
          userId: 'u1',
          displayName: 'Alice',
          avatarUrl: null,
          assignedAt: new Date('2026-05-02'),
        },
      ],
      subscribers: [
        { userId: 'u1', displayName: 'Alice', avatarUrl: null },
        { userId: 'u2', displayName: 'Bob', avatarUrl: 'https://x/y.png' },
      ],
      groups: [
        {
          groupId: 'g1',
          slug: 'writers',
          displayName: 'Writers',
          origin: 'originating',
          isUrgent: false,
          columnId: 'c1',
        },
        {
          groupId: 'g2',
          slug: 'it',
          displayName: 'IT',
          origin: 'workflow_share',
          isUrgent: true,
          columnId: null,
        },
      ],
      createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-04'),
      lastActivityAt: new Date('2026-05-06'),
    });
  });

  it('returns null body when the Request has no description', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue({ id: 'rg1', deletedAt: null });
    mockedRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: '(Untitled)',
      body: null,
      status: 'backlog',
      urgency: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      kind: null,
      assignments: [],
      subscriptions: [],
      requestGroups: [
        {
          groupId: 'g1',
          origin: 'originating',
          isUrgent: false,
          columnId: null,
          group: { slug: 'writers', displayName: 'Writers' },
        },
      ],
    });
    const result = await getTicketDetail({ requestId: 'r1', viewerGroupId: 'g1' });
    expect(result?.body).toBeNull();
    expect(result?.title).toBe('(Untitled)');
  });

  it('scopes the link lookup to the (requestId, viewerGroupId) compound key', async () => {
    mockedRequestGroup.findUnique.mockResolvedValue(null);
    await getTicketDetail({ requestId: 'r1', viewerGroupId: 'g1' });
    expect(mockedRequestGroup.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requestId_groupId: { requestId: 'r1', groupId: 'g1' } },
      }),
    );
  });
});
