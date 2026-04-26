/**
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052)
 * @spec product/scenarios.md (SCN-20)
 * @spec product/analytics-events.md
 *
 * Comment service — create + list. Comments are flat (no threading
 * in MVP), oldest-first, soft-delete-respecting. Visibility is
 * inherited from the parent post via the same filter listPosts uses.
 *
 * Audit log entry on every successful create. The `comment_added`
 * analytics event lives here per analytics-events.md (silent for now;
 * lights up when an analytics writer lands).
 */

import type { SystemRole } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { listReactionsForComments, type ReactionAggregate } from '@/server/services/reaction';

// ── Types ────────────────────────────────────────────────────────────────

export interface CommentAuthor {
  id: string;
  displayName: string;
  roles: SystemRole[];
  isNewMember: boolean;
}

export interface CommentListItem {
  id: string;
  body: string;
  createdAt: Date;
  author: CommentAuthor;
  /** Per BU-reactions / D052 — empty array when none. */
  reactions: ReactionAggregate[];
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
    },
    reactions: reactionsByComment.get(row.id) ?? [],
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
  for (const row of grouped) byPost.set(row.postId, row._count._all);
  return byPost;
}
