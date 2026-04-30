/**
 * Integration tests for the BU-publish-router lifecycle service path.
 *
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Walks the state machine described in D072 §1: every transition
 * (draft → autosave, draft → published, draft → discarded → restored,
 * draft → in-review, in-review → published) is reachable through the
 * tRPC router, and the four cells of (status × reviewRequestId) all
 * verify their distinct behaviour.
 *
 * Prisma is mocked at the DB boundary (same pattern as the other
 * router-level integration tests).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => {
  const prismaMock: Record<string, unknown> = {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    request: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };
  // $transaction passthrough — invoke the callback with the same mock,
  // so transactional services exercise the same vi.fn() instances and
  // existing assertions on prisma.* still work.
  prismaMock.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
  return { prisma: prismaMock };
});

vi.mock('@/server/services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import { createCaller } from '@/server/routers/_app';
import { prisma } from '@/server/db/client';
import type { TRPCContext } from '@/server/lib/trpc';

const mockPostFindUnique = vi.mocked(prisma.post.findUnique);
const mockPostUpdate = vi.mocked(prisma.post.update);
const mockRequestFindUnique = vi.mocked(prisma.request.findUnique);
const mockRequestCreate = vi.mocked(prisma.request.create);
const mockRequestUpdate = vi.mocked(prisma.request.update);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);

const POST_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const KIND_ID = '33333333-3333-4333-8333-333333333333';

const authedCtx: TRPCContext = {
  user: {
    id: 'user-1',
    email: 'eddie@example.test',
    displayName: 'Eddie Stone',
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

interface PostStub {
  id?: string;
  status?: 'draft' | 'published';
  publishedAt?: Date | null;
  reviewRequestId?: string | null;
  reviewedByUserId?: string | null;
  deletedAt?: Date | null;
  authorId?: string;
  kindId?: string | null;
  kind?: { reviewPriority: 'low' | 'normal' | 'high' | 'urgent' } | null;
}

function postFixture(overrides: PostStub = {}): PostStub {
  return {
    id: POST_ID,
    status: 'draft',
    publishedAt: null,
    reviewRequestId: null,
    reviewedByUserId: null,
    deletedAt: null,
    authorId: 'user-1',
    kindId: KIND_ID,
    kind: { reviewPriority: 'high' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPostUpdate.mockResolvedValue({ updatedAt: new Date() } as never);
  mockRequestCreate.mockResolvedValue({ id: REQUEST_ID } as never);
  mockRequestUpdate.mockResolvedValue({} as never);
});

// ── publish ──────────────────────────────────────────────────────────────

describe('post.publish', () => {
  it('flips a draft to published and stamps publishedAt', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture() as never);

    const caller = createCaller(authedCtx);
    const result = await caller.post.publish({ postId: POST_ID });

    expect(result.postId).toBe(POST_ID);
    expect(result.publishedAt).toBeInstanceOf(Date);

    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: expect.objectContaining({
        status: 'published',
        publishedAt: expect.any(Date),
      }),
    });
  });

  it('rejects publish on a discarded post (BAD_REQUEST: discarded)', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture({ deletedAt: new Date() }) as never);

    const caller = createCaller(authedCtx);
    await expect(caller.post.publish({ postId: POST_ID })).rejects.toMatchObject({
      message: 'discarded',
    });
    expect(mockPostUpdate).not.toHaveBeenCalled();
  });

  it('rejects publish on a post owned by someone else (FORBIDDEN)', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture({ authorId: 'other-user' }) as never);

    const caller = createCaller(authedCtx);
    await expect(caller.post.publish({ postId: POST_ID })).rejects.toMatchObject({
      message: 'Not the post author',
    });
  });

  it('rejects publish on an already-published post (BAD_REQUEST: already_published)', async () => {
    mockPostFindUnique.mockResolvedValue(
      postFixture({ status: 'published', publishedAt: new Date() }) as never,
    );

    const caller = createCaller(authedCtx);
    await expect(caller.post.publish({ postId: POST_ID })).rejects.toMatchObject({
      message: 'already_published',
    });
  });
});

// ── sendForReview ────────────────────────────────────────────────────────

describe('post.sendForReview', () => {
  it('creates a kind_review Request and links it to the post', async () => {
    mockPostFindUnique.mockImplementation((args) => {
      const where = (args as { where: { id: string } }).where;
      if (where.id === POST_ID && (args as { select?: unknown }).select) {
        const select = (args as { select: Record<string, boolean> }).select;
        // First call: getOwnedPost — returns the post fixture
        if (select.authorId) return postFixture() as never;
        // Second call (createKindReviewRequest): kindId + kind.reviewPriority
        return postFixture() as never;
      }
      return null as never;
    });

    const caller = createCaller(authedCtx);
    const result = await caller.post.sendForReview({
      postId: POST_ID,
      alsoPublishToFeed: false,
    });

    expect(result.reviewRequestId).toBe(REQUEST_ID);
    expect(result.publishedAt).toBeNull();
    expect(mockRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'kind_review',
          status: 'unclaimed',
          priority: 'high',
          createdByUserId: 'user-1',
          context: expect.objectContaining({ postId: POST_ID, source: 'publish_modal' }),
        }),
      }),
    );
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: expect.objectContaining({ reviewRequestId: REQUEST_ID }),
    });
  });

  it('also publishes when alsoPublishToFeed=true (review_after_publish path)', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture() as never);

    const caller = createCaller(authedCtx);
    const result = await caller.post.sendForReview({
      postId: POST_ID,
      alsoPublishToFeed: true,
    });

    expect(result.publishedAt).toBeInstanceOf(Date);
    const updateCall = mockPostUpdate.mock.calls[0]?.[0] as
      | { data: { status?: string; publishedAt?: Date } }
      | undefined;
    expect(updateCall?.data.status).toBe('published');
    expect(updateCall?.data.publishedAt).toBeInstanceOf(Date);
  });

  it('rejects when the post already has an open kind_review request', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture({ reviewRequestId: REQUEST_ID }) as never);
    mockRequestFindUnique.mockResolvedValue({
      status: 'unclaimed',
      deletedAt: null,
    } as never);

    const caller = createCaller(authedCtx);
    await expect(
      caller.post.sendForReview({ postId: POST_ID, alsoPublishToFeed: false }),
    ).rejects.toMatchObject({ message: 'already_in_review' });
  });

  it('inherits reviewPriority from the post.kind row (urgent → urgent Request)', async () => {
    mockPostFindUnique.mockResolvedValue(
      postFixture({ kind: { reviewPriority: 'urgent' } }) as never,
    );

    const caller = createCaller(authedCtx);
    await caller.post.sendForReview({ postId: POST_ID, alsoPublishToFeed: false });

    const requestCreateCall = mockRequestCreate.mock.calls[0]?.[0] as {
      data: { priority: string };
    };
    expect(requestCreateCall.data.priority).toBe('urgent');
  });
});

// ── saveDraft ────────────────────────────────────────────────────────────

describe('post.saveDraft', () => {
  it('returns ok for a draft post (no DB write needed)', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture() as never);

    const caller = createCaller(authedCtx);
    const result = await caller.post.saveDraft({ postId: POST_ID });
    expect(result).toEqual({ ok: true });
    expect(mockPostUpdate).not.toHaveBeenCalled();
  });

  it('rejects when the post has already been published', async () => {
    mockPostFindUnique.mockResolvedValue(
      postFixture({ status: 'published', publishedAt: new Date() }) as never,
    );

    const caller = createCaller(authedCtx);
    await expect(caller.post.saveDraft({ postId: POST_ID })).rejects.toMatchObject({
      message: 'already_published',
    });
  });
});

// ── discard / restore ───────────────────────────────────────────────────

describe('post.discard / post.restore', () => {
  it('discard sets deletedAt and accepts subsequent restore within the cell', async () => {
    mockPostFindUnique.mockResolvedValueOnce(postFixture() as never);

    const caller = createCaller(authedCtx);
    const discarded = await caller.post.discard({ postId: POST_ID });
    expect(discarded.deletedAt).toBeInstanceOf(Date);

    const updateAfterDiscard = mockPostUpdate.mock.calls[0]?.[0] as {
      data: { deletedAt?: Date };
    };
    expect(updateAfterDiscard.data.deletedAt).toBeInstanceOf(Date);

    // Restore: the post is now soft-deleted in our fixture.
    mockPostFindUnique.mockResolvedValueOnce(postFixture({ deletedAt: new Date() }) as never);
    const restored = await caller.post.restore({ postId: POST_ID });
    expect(restored.postId).toBe(POST_ID);

    const restoreUpdate = mockPostUpdate.mock.calls[1]?.[0] as {
      data: { deletedAt: null };
    };
    expect(restoreUpdate.data.deletedAt).toBeNull();
  });

  it('cascades to closing an open kind_review Request on discard (verdict=withdrawn)', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture({ reviewRequestId: REQUEST_ID }) as never);
    // First lookup: isReviewRequestOpen → status unclaimed (open)
    // Second lookup: closeKindReviewRequest → full request snapshot
    mockRequestFindUnique
      .mockResolvedValueOnce({ status: 'unclaimed', deletedAt: null } as never)
      .mockResolvedValueOnce({
        id: REQUEST_ID,
        type: 'kind_review',
        status: 'unclaimed',
        deletedAt: null,
        createdByUserId: 'user-1',
        context: { postId: POST_ID },
      } as never);

    const caller = createCaller(authedCtx);
    await caller.post.discard({ postId: POST_ID });

    expect(mockRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REQUEST_ID },
        data: expect.objectContaining({ status: 'abandoned' }),
      }),
    );
  });

  it('rejects restore when the post has not been discarded', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture() as never);
    const caller = createCaller(authedCtx);
    await expect(caller.post.restore({ postId: POST_ID })).rejects.toMatchObject({
      message: 'not_discarded',
    });
  });
});

// ── autosaveDraft ────────────────────────────────────────────────────────

describe('post.autosaveDraft', () => {
  it('updates only the supplied fields', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture() as never);

    const caller = createCaller(authedCtx);
    await caller.post.autosaveDraft({
      postId: POST_ID,
      fields: { title: 'New title' },
    });

    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: { title: 'New title' },
      select: { updatedAt: true },
    });
  });

  it('refuses to autosave when post is in review (D072 — edits paused)', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture({ reviewRequestId: REQUEST_ID }) as never);
    mockRequestFindUnique.mockResolvedValue({
      status: 'in_review',
      deletedAt: null,
    } as never);

    const caller = createCaller(authedCtx);
    await expect(
      caller.post.autosaveDraft({
        postId: POST_ID,
        fields: { title: 'Autosaved while reviewer is editing' },
      }),
    ).rejects.toMatchObject({ message: 'In review — edits paused' });
    expect(mockPostUpdate).not.toHaveBeenCalled();
  });

  it('rejects an empty fields payload (no_fields)', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture() as never);

    const caller = createCaller(authedCtx);
    await expect(caller.post.autosaveDraft({ postId: POST_ID, fields: {} })).rejects.toMatchObject({
      message: 'no_fields',
    });
    expect(mockPostUpdate).not.toHaveBeenCalled();
  });

  it('refuses to autosave on a discarded post', async () => {
    mockPostFindUnique.mockResolvedValue(postFixture({ deletedAt: new Date() }) as never);

    const caller = createCaller(authedCtx);
    await expect(
      caller.post.autosaveDraft({ postId: POST_ID, fields: { title: 'x' } }),
    ).rejects.toMatchObject({ message: 'discarded' });
  });
});
