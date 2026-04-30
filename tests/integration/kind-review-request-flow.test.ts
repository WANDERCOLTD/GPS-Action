/**
 * Integration tests for the kind_review Request flow.
 *
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Drives the service layer directly (not via tRPC) because the
 * verdict-application path is a service-internal cross-entity
 * operation: closeKindReviewRequest writes Post + Request + the
 * `post_review_attribution` Comment in one logical step. The router
 * surface for reviewer verdicts is a Phase-3 BU; here we lock in the
 * service contract this BU's modal will dispatch against.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    request: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    comment: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
}));

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/services/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
}));

import { prisma } from '@/server/db/client';
import { createKindReviewRequest, closeKindReviewRequest } from '@/server/services/request';
import { createNotification } from '@/server/services/notification';

const mockPostFindUnique = vi.mocked(prisma.post.findUnique);
const mockPostUpdate = vi.mocked(prisma.post.update);
const mockRequestFindUnique = vi.mocked(prisma.request.findUnique);
const mockRequestCreate = vi.mocked(prisma.request.create);
const mockRequestUpdate = vi.mocked(prisma.request.update);
const mockCommentCreate = vi.mocked(prisma.comment.create);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockSystemSettingFind = vi.mocked(prisma.systemSetting.findUnique);
const mockCreateNotification = vi.mocked(createNotification);

const POST_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const ORIGINATOR_ID = 'user-eddie';
const REVIEWER_ID = 'user-sharon';

beforeEach(() => {
  vi.clearAllMocks();
  mockSystemSettingFind.mockResolvedValue(null as never);
  mockUserFindUnique.mockResolvedValue({
    id: REVIEWER_ID,
    displayName: 'Sharon Cohen',
    deletedAt: null,
  } as never);
  mockCommentCreate.mockResolvedValue({ id: 'comment-auto-1' } as never);
  mockRequestUpdate.mockResolvedValue({} as never);
  mockPostUpdate.mockResolvedValue({} as never);
});

// ── createKindReviewRequest ──────────────────────────────────────────────

describe('createKindReviewRequest', () => {
  it('creates a Request with priority inherited from PostKind.reviewPriority', async () => {
    mockPostFindUnique.mockResolvedValue({
      id: POST_ID,
      kindId: 'kind-tick-or-cross',
      kind: { reviewPriority: 'high' },
    } as never);
    mockRequestCreate.mockResolvedValue({ id: REQUEST_ID } as never);

    const result = await createKindReviewRequest({
      postId: POST_ID,
      callerId: ORIGINATOR_ID,
    });

    expect(result).toEqual({ id: REQUEST_ID, priority: 'high' });
    expect(mockRequestCreate).toHaveBeenCalledWith({
      data: {
        type: 'kind_review',
        status: 'unclaimed',
        priority: 'high',
        kindId: 'kind-tick-or-cross',
        context: { postId: POST_ID, source: 'publish_modal' },
        createdByUserId: ORIGINATOR_ID,
      },
      select: { id: true },
    });
  });

  it('falls back to priority=normal when post.kind is missing', async () => {
    mockPostFindUnique.mockResolvedValue({
      id: POST_ID,
      kindId: null,
      kind: null,
    } as never);
    mockRequestCreate.mockResolvedValue({ id: REQUEST_ID } as never);

    const result = await createKindReviewRequest({
      postId: POST_ID,
      callerId: ORIGINATOR_ID,
    });

    expect(result.priority).toBe('normal');
  });

  it('throws when the post does not exist', async () => {
    mockPostFindUnique.mockResolvedValue(null as never);
    await expect(
      createKindReviewRequest({ postId: POST_ID, callerId: ORIGINATOR_ID }),
    ).rejects.toThrow(/post not found/);
  });
});

// ── closeKindReviewRequest ───────────────────────────────────────────────

describe('closeKindReviewRequest — verdict=publish', () => {
  it('flips Post.status, sets reviewedByUserId, and inserts the auto-comment', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: REQUEST_ID,
      type: 'kind_review',
      status: 'claimed',
      deletedAt: null,
      createdByUserId: ORIGINATOR_ID,
      context: { postId: POST_ID, source: 'publish_modal' },
    } as never);
    // Post lookup inside the publish branch (preserves existing publishedAt if any)
    mockPostFindUnique.mockResolvedValue({
      status: 'draft',
      publishedAt: null,
    } as never);

    const result = await closeKindReviewRequest({
      requestId: REQUEST_ID,
      verdict: 'publish',
      reviewerId: REVIEWER_ID,
    });

    expect(result).toMatchObject({
      ok: true,
      postId: POST_ID,
      verdict: 'publish',
      autoCommentId: 'comment-auto-1',
    });

    // Post.status flipped, reviewedByUserId stamped
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: expect.objectContaining({
        status: 'published',
        reviewedByUserId: REVIEWER_ID,
        publishedAt: expect.any(Date),
      }),
    });

    // Auto-comment created with systemKind and reviewer as author
    expect(mockCommentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        postId: POST_ID,
        authorId: REVIEWER_ID,
        systemKind: 'post_review_attribution',
        body: expect.stringContaining('Sharon Cohen'),
      }),
      select: { id: true },
    });

    // Request resolved
    expect(mockRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REQUEST_ID },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedByUserId: REVIEWER_ID,
        }),
      }),
    );
  });

  it('preserves the existing publishedAt when the post was already published-then-reviewed', async () => {
    const earlierPublishedAt = new Date('2026-04-01T10:00:00Z');
    mockRequestFindUnique.mockResolvedValue({
      id: REQUEST_ID,
      type: 'kind_review',
      status: 'in_review',
      deletedAt: null,
      createdByUserId: ORIGINATOR_ID,
      context: { postId: POST_ID },
    } as never);
    mockPostFindUnique.mockResolvedValue({
      status: 'published',
      publishedAt: earlierPublishedAt,
    } as never);

    await closeKindReviewRequest({
      requestId: REQUEST_ID,
      verdict: 'publish',
      reviewerId: REVIEWER_ID,
    });

    const postUpdateCall = mockPostUpdate.mock.calls[0]?.[0] as {
      data: { publishedAt: Date };
    };
    expect(postUpdateCall.data.publishedAt).toEqual(earlierPublishedAt);
  });

  it('skips the auto-comment when review_published_creates_comment="false"', async () => {
    mockSystemSettingFind.mockResolvedValue({ value: 'false' } as never);
    mockRequestFindUnique.mockResolvedValue({
      id: REQUEST_ID,
      type: 'kind_review',
      status: 'claimed',
      deletedAt: null,
      createdByUserId: ORIGINATOR_ID,
      context: { postId: POST_ID },
    } as never);
    mockPostFindUnique.mockResolvedValue({
      status: 'draft',
      publishedAt: null,
    } as never);

    const result = await closeKindReviewRequest({
      requestId: REQUEST_ID,
      verdict: 'publish',
      reviewerId: REVIEWER_ID,
    });

    expect(result).toMatchObject({ ok: true, autoCommentId: null });
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it('notifies the originator with the verdict-specific copy', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: REQUEST_ID,
      type: 'kind_review',
      status: 'claimed',
      deletedAt: null,
      createdByUserId: ORIGINATOR_ID,
      context: { postId: POST_ID },
    } as never);
    mockPostFindUnique.mockResolvedValue({ status: 'draft', publishedAt: null } as never);

    await closeKindReviewRequest({
      requestId: REQUEST_ID,
      verdict: 'publish',
      reviewerId: REVIEWER_ID,
    });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: ORIGINATOR_ID,
        type: 'request_resolved',
        message: expect.stringContaining('reviewed and published your post'),
      }),
    );
  });
});

describe('closeKindReviewRequest — verdict=reject', () => {
  it('leaves the Post in draft and stores the reason on the Request', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: REQUEST_ID,
      type: 'kind_review',
      status: 'claimed',
      deletedAt: null,
      createdByUserId: ORIGINATOR_ID,
      context: { postId: POST_ID },
    } as never);

    await closeKindReviewRequest({
      requestId: REQUEST_ID,
      verdict: 'reject',
      reviewerId: REVIEWER_ID,
      reason: 'needs more sourcing',
    });

    // Post NOT touched on reject
    expect(mockPostUpdate).not.toHaveBeenCalled();
    // No auto-comment on reject
    expect(mockCommentCreate).not.toHaveBeenCalled();
    // Request resolved with notes
    const requestUpdate = mockRequestUpdate.mock.calls[0]?.[0] as {
      data: { status: string; resolutionNotes: string | null };
    };
    expect(requestUpdate.data.status).toBe('resolved');
    expect(requestUpdate.data.resolutionNotes).toBe('needs more sourcing');
  });
});

describe('closeKindReviewRequest — verdict=withdrawn', () => {
  it('marks the Request as abandoned (originator discarded mid-review)', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: REQUEST_ID,
      type: 'kind_review',
      status: 'claimed',
      deletedAt: null,
      createdByUserId: ORIGINATOR_ID,
      context: { postId: POST_ID },
    } as never);

    await closeKindReviewRequest({
      requestId: REQUEST_ID,
      verdict: 'withdrawn',
      reviewerId: ORIGINATOR_ID,
    });

    const requestUpdate = mockRequestUpdate.mock.calls[0]?.[0] as {
      data: { status: string };
    };
    expect(requestUpdate.data.status).toBe('abandoned');
    // Originator-as-actor → no self-notification
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

describe('closeKindReviewRequest — guards', () => {
  it('rejects an already-closed Request', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: REQUEST_ID,
      type: 'kind_review',
      status: 'resolved',
      deletedAt: null,
      createdByUserId: ORIGINATOR_ID,
      context: { postId: POST_ID },
    } as never);

    const result = await closeKindReviewRequest({
      requestId: REQUEST_ID,
      verdict: 'publish',
      reviewerId: REVIEWER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'already_closed' });
  });

  it('rejects a non-kind_review Request type', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: REQUEST_ID,
      type: 'vetting',
      status: 'claimed',
      deletedAt: null,
      createdByUserId: ORIGINATOR_ID,
      context: { postId: POST_ID },
    } as never);

    const result = await closeKindReviewRequest({
      requestId: REQUEST_ID,
      verdict: 'publish',
      reviewerId: REVIEWER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'wrong_type' });
  });

  it('rejects when the Request context has no postId', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: REQUEST_ID,
      type: 'kind_review',
      status: 'claimed',
      deletedAt: null,
      createdByUserId: ORIGINATOR_ID,
      context: {},
    } as never);

    const result = await closeKindReviewRequest({
      requestId: REQUEST_ID,
      verdict: 'publish',
      reviewerId: REVIEWER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'no_post_link' });
  });
});
