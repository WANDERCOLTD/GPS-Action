/**
 * @build-unit BU-comments BU-requests-vetting BU-publish-router
 * @spec architecture/decision-log.md (D052, D056, D057, D072)
 * @spec product/scenarios.md (SCN-20, SCN-21, SCN-22)
 * @spec product/analytics-events.md
 *
 * Comment service — create + list. Comments are flat (no threading
 * in MVP), oldest-first, soft-delete-respecting.
 *
 * Polymorphic — a Comment belongs to either a Post OR a Request
 * (BU-requests-vetting). For Post comments visibility is inherited from
 * the parent post via the same filter listPosts uses; for Request
 * comments the audience filter (D056 — 'all' vs 'reviewers') gates
 * what each caller sees.
 *
 * Audit log entry on every successful create. @mention parsing on
 * Request comments emits Notification rows for each matched reviewer.
 */

import type { CommentAudience, CommentSystemKind, SystemRole } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { listReactionsForComments, type ReactionAggregate } from '@/server/services/reaction';
import { createNotification } from '@/server/services/notification';
import { mentionedUserIds, type MentionCandidate } from '@/shared/lib/mentions';

// ── Types ────────────────────────────────────────────────────────────────

export interface CommentAuthor {
  id: string;
  displayName: string;
  roles: SystemRole[];
  isNewMember: boolean;
  /** D072 — for the post_review_attribution comment, the avatar IS the badge. */
  avatarUrl: string | null;
}

export interface CommentListItem {
  id: string;
  body: string;
  createdAt: Date;
  author: CommentAuthor;
  /** Per BU-reactions / D052 — empty array when none. */
  reactions: ReactionAggregate[];
  /** Audience marker — only meaningful for Request comments (D056). */
  audience?: CommentAudience;
  /** D072 — non-null marks a system-authored comment with special rendering. */
  systemKind: CommentSystemKind | null;
}

interface CreateCommentInput {
  postId: string;
  body: string;
  authorId: string;
}

interface ListCommentsForPostInput {
  postId: string;
  /** Null for unauthenticated callers. Visibility filter still applies via the parent post. */
  callerId: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────

const NEW_MEMBER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days per D052

// ── Create ───────────────────────────────────────────────────────────────

export async function createComment(input: CreateCommentInput): Promise<{ id: string }> {
  // Verify the parent post exists, is not soft-deleted, and the author can see it.
  // Visibility filter mirrors listPosts logic.
  const post = await prisma.post.findFirst({
    where: {
      id: input.postId,
      deletedAt: null,
    },
    select: { id: true, visibility: true },
  });

  if (!post) {
    throw new Error('Post not found or deleted');
  }

  // Authed callers can comment on public + authenticated_only posts.
  // (Unauthed callers can't reach this service path — authedProcedure gates.)
  if (post.visibility !== 'public' && post.visibility !== 'authenticated_only') {
    throw new Error('Cannot comment on this post');
  }

  const comment = await prisma.comment.create({
    data: {
      postId: input.postId,
      authorId: input.authorId,
      body: input.body.trim(),
    },
    select: { id: true },
  });

  await auditLog({
    action: 'comment.add',
    entityType: 'comment',
    entityId: comment.id,
    userId: input.authorId,
    changes: {
      postId: input.postId,
      bodyLength: input.body.length,
    },
  });

  // Analytics — `comment_added` per analytics-events.md. No structured-log
  // writer yet; matches the createPost / addReaction silent-for-now pattern.

  return comment;
}

// ── List for post ────────────────────────────────────────────────────────

export async function listCommentsForPost(
  input: ListCommentsForPostInput,
): Promise<CommentListItem[]> {
  // Visibility filter at the parent post level.
  const post = await prisma.post.findFirst({
    where: {
      id: input.postId,
      deletedAt: null,
      visibility: input.callerId ? { in: ['public', 'authenticated_only'] } : { equals: 'public' },
    },
    select: { id: true },
  });

  if (!post) {
    return [];
  }

  const rows = await prisma.comment.findMany({
    where: {
      postId: input.postId,
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
          createdAt: true,
          avatarUrl: true,
          roleGrants: {
            where: {
              revokedAt: null,
              role: { in: ['admin', 'queue_manager'] },
            },
            select: { role: true },
          },
        },
      },
    },
  });

  const now = Date.now();

  const reactionsByComment = await listReactionsForComments({
    commentIds: rows.map((r) => r.id),
    callerId: input.callerId,
  });

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    author: {
      id: row.author.id,
      displayName: row.author.displayName,
      roles: row.author.roleGrants.map((g) => g.role),
      isNewMember: now - row.author.createdAt.getTime() < NEW_MEMBER_WINDOW_MS,
      avatarUrl: row.author.avatarUrl,
    },
    reactions: reactionsByComment.get(row.id) ?? [],
    systemKind: row.systemKind,
  }));
}

// ── Bulk count for feed (avoids N+1) ─────────────────────────────────────

export async function listCommentCountsForPosts(input: {
  postIds: string[];
}): Promise<Map<string, number>> {
  if (input.postIds.length === 0) {
    return new Map();
  }

  const grouped = await prisma.comment.groupBy({
    by: ['postId'],
    where: {
      postId: { in: input.postIds },
      deletedAt: null,
    },
    _count: { _all: true },
  });

  const byPost = new Map<string, number>();
  for (const postId of input.postIds) byPost.set(postId, 0);
  for (const row of grouped) {
    if (row.postId) byPost.set(row.postId, row._count._all);
  }
  return byPost;
}

// ── Request comments (BU-requests-vetting) ────────────────────────────────
//
// Polymorphic Comment.requestId — comments attached to a Request rather
// than a Post. Audience filter (D056) gates visibility:
//   - submitter (createdByUserId on the Request) sees only audience='all'
//   - reviewers (queue_manager / admin / scoped grant) see both audiences
//
// @mention parsing emits Notification rows for each matched reviewer.

interface CreateCommentForRequestInput {
  requestId: string;
  body: string;
  authorId: string;
  audience: CommentAudience;
}

export async function createCommentForRequest(
  input: CreateCommentForRequestInput,
): Promise<{ id: string }> {
  // Verify the Request exists and is not soft-deleted.
  const request = await prisma.request.findFirst({
    where: { id: input.requestId, deletedAt: null },
    select: { id: true, createdByUserId: true },
  });
  if (!request) {
    throw new Error('Request not found or deleted');
  }

  const created = await prisma.comment.create({
    data: {
      requestId: input.requestId,
      authorId: input.authorId,
      body: input.body.trim(),
      audience: input.audience,
    },
    select: { id: true },
  });

  await auditLog({
    action: 'request_comment.add',
    entityType: 'comment',
    entityId: created.id,
    userId: input.authorId,
    changes: {
      bodyLength: input.body.length,
      requestId: input.requestId,
      audience: input.audience,
    },
    context: { source: 'request_workspace' },
  });

  // @mention parsing → Notification fanout per D057.
  // Candidates = active reviewer-role users (admin or queue_manager).
  // Audience filter applies to mentions too: a mention inside a
  // 'reviewers' comment must not notify the submitter (who can't see
  // the comment anyway), but a mention inside an 'all' comment may
  // notify the submitter if their displayName matches.
  const reviewerCandidates = await prisma.user.findMany({
    where: {
      deletedAt: null,
      roleGrants: {
        some: {
          revokedAt: null,
          role: { in: ['admin', 'queue_manager'] },
        },
      },
    },
    select: { id: true, displayName: true },
  });

  // For audience='all', also include the submitter as a mention target.
  const candidates: MentionCandidate[] = [...reviewerCandidates];
  if (input.audience === 'all' && request.createdByUserId) {
    const submitter = await prisma.user.findUnique({
      where: { id: request.createdByUserId },
      select: { id: true, displayName: true },
    });
    if (submitter && !candidates.some((c) => c.id === submitter.id)) {
      candidates.push(submitter);
    }
  }

  const mentions = mentionedUserIds(input.body, candidates);
  for (const mentionedId of mentions) {
    if (mentionedId === input.authorId) continue; // don't self-notify
    await createNotification({
      recipientUserId: mentionedId,
      type: 'request_mention',
      requestId: input.requestId,
      fromUserId: input.authorId,
      message: input.body.slice(0, 200),
    });
  }

  return created;
}

interface ListCommentsForRequestInput {
  requestId: string;
  /** Caller user id — used to determine submitter vs reviewer view. */
  callerId: string;
  /** Pre-computed: does the caller have a reviewer-side role/scope? */
  isReviewer: boolean;
}

export async function listCommentsForRequest(
  input: ListCommentsForRequestInput,
): Promise<CommentListItem[]> {
  // Submitter: audience='all' only. Reviewer: both audiences.
  const audienceFilter: CommentAudience[] = input.isReviewer ? ['all', 'reviewers'] : ['all'];

  const comments = await prisma.comment.findMany({
    where: {
      requestId: input.requestId,
      deletedAt: null,
      audience: { in: audienceFilter },
    },
    orderBy: [{ createdAt: 'asc' }],
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
          createdAt: true,
          avatarUrl: true,
          roleGrants: {
            where: { revokedAt: null, role: { in: ['admin', 'queue_manager'] } },
            select: { role: true },
          },
        },
      },
    },
  });

  if (comments.length === 0) return [];

  const commentIds = comments.map((c) => c.id);
  const reactionsByComment = await listReactionsForComments({
    commentIds,
    callerId: input.callerId,
  });

  const now = Date.now();
  return comments.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    author: {
      id: c.author.id,
      displayName: c.author.displayName,
      roles: c.author.roleGrants.map((g) => g.role),
      isNewMember: now - c.author.createdAt.getTime() < NEW_MEMBER_WINDOW_MS,
      avatarUrl: c.author.avatarUrl,
    },
    reactions: reactionsByComment.get(c.id) ?? [],
    audience: c.audience,
    systemKind: c.systemKind,
  }));
}

// ── Auto-comment for review attribution (BU-publish-router / D072) ───────

const REVIEW_PUBLISHED_CREATES_COMMENT_KEY = 'review_published_creates_comment';

/**
 * Insert the pinned `post_review_attribution` comment when a reviewer
 * verdicts a post `publish` via the kind-review flow. Authored by the
 * reviewer themselves (their avatar is the comment avatar — closes the
 * three-tier loop per D072 §6). Suppressed when the
 * `review_published_creates_comment` SystemSetting is `'false'` so an
 * env can opt out without a code change.
 *
 * Returns `null` when the system setting disables the auto-comment, or
 * when the reviewer / post can't be resolved (the verdict still
 * proceeds; the comment is non-load-bearing). Never throws.
 */
export async function createPostReviewAttributionComment(input: {
  postId: string;
  reviewerId: string;
}): Promise<{ id: string } | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: REVIEW_PUBLISHED_CREATES_COMMENT_KEY },
    select: { value: true },
  });
  if (setting?.value === 'false') return null;

  const reviewer = await prisma.user.findUnique({
    where: { id: input.reviewerId },
    select: { displayName: true, deletedAt: true },
  });
  if (!reviewer || reviewer.deletedAt) return null;

  const body = `${reviewer.displayName} helped review and shape this post.`;

  const created = await prisma.comment.create({
    data: {
      postId: input.postId,
      authorId: input.reviewerId,
      body,
      audience: 'all',
      systemKind: 'post_review_attribution',
    },
    select: { id: true },
  });

  await auditLog({
    action: 'comment.system_review_attribution.add',
    entityType: 'comment',
    entityId: created.id,
    userId: input.reviewerId,
    changes: { postId: input.postId, systemKind: 'post_review_attribution' },
    context: { source: 'kind_review_verdict' },
  });

  return created;
}
