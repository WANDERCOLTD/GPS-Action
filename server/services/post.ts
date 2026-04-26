/**
 * @build-unit BU-feed BU-composer
 * @spec product/post-creation-flow.md
 * @spec architecture/decision-log.md (D045, D048)
 *
 * Post service — business logic for listing and creating posts.
 * Handles visibility filtering, soft-delete exclusion, cursor
 * pagination, and post creation with audit logging.
 * Layer boundary: services → db + shared only.
 */

import type { PostVisibility, SystemRole } from '@prisma/client';
import { prisma } from '@/server/db/client';
import type { PostCreateInput } from '@/shared/validation/post';
import { auditLog } from '@/server/services/audit';
import { listReactionsForPosts, type ReactionAggregate } from '@/server/services/reaction';
import { listCommentCountsForPosts } from '@/server/services/comment';

// ── Types ────────────────────────────────────────────────────────────────

export interface PostCursor {
  createdAt: Date;
  id: string;
}

export interface PostAuthor {
  id: string;
  displayName: string;
  roles: SystemRole[];
}

export interface PostListItem {
  id: string;
  title: string;
  body: string;
  visibility: PostVisibility;
  activistMailerUrl: string | null;
  groupTags: string[];
  createdAt: Date;
  author: PostAuthor;
  /** Per BU-reactions / D050 — empty array when none. */
  reactions: ReactionAggregate[];
  /** Per BU-comments / D052 — non-deleted comment count. */
  commentCount: number;
}

export interface ListPostsResult {
  posts: PostListItem[];
  nextCursor: PostCursor | null;
}

interface ListPostsInput {
  cursor?: PostCursor;
  limit?: number;
  /** Null when the caller is unauthenticated. */
  callerId: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function listPosts(input: ListPostsInput): Promise<ListPostsResult> {
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  // Visibility: unauthenticated callers only see 'public' posts.
  const visibilityFilter: PostVisibility[] = input.callerId
    ? ['public', 'authenticated_only']
    : ['public'];

  const cursorWhere = input.cursor
    ? {
        OR: [
          { createdAt: { lt: input.cursor.createdAt } },
          {
            createdAt: { equals: input.cursor.createdAt },
            id: { lt: input.cursor.id },
          },
        ],
      }
    : {};

  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      visibility: { in: visibilityFilter },
      ...cursorWhere,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // fetch one extra to determine if there's a next page
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
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

  const hasMore = posts.length > limit;
  const resultPosts = hasMore ? posts.slice(0, limit) : posts;

  const lastPost = resultPosts[resultPosts.length - 1];
  const nextCursor: PostCursor | null =
    hasMore && lastPost ? { createdAt: lastPost.createdAt, id: lastPost.id } : null;

  const postIds = resultPosts.map((p) => p.id);
  const [reactionsByPost, commentCountsByPost] = await Promise.all([
    listReactionsForPosts({ postIds, callerId: input.callerId }),
    listCommentCountsForPosts({ postIds }),
  ]);

  const mapped: PostListItem[] = resultPosts.map((post) => ({
    id: post.id,
    title: post.title,
    body: post.body,
    visibility: post.visibility,
    activistMailerUrl: post.activistMailerUrl,
    groupTags: post.groupTags,
    createdAt: post.createdAt,
    author: {
      id: post.author.id,
      displayName: post.author.displayName,
      roles: post.author.roleGrants.map((g) => g.role),
    },
    reactions: reactionsByPost.get(post.id) ?? [],
    commentCount: commentCountsByPost.get(post.id) ?? 0,
  }));

  return { posts: mapped, nextCursor };
}

// ── Create ──────────────────────────────────────────────────────────────

export async function createPost(
  input: PostCreateInput,
  authorId: string,
): Promise<{ id: string }> {
  const post = await prisma.post.create({
    data: {
      title: input.title,
      body: input.body,
      activistMailerUrl: input.activistMailerUrl?.trim() || null,
      visibility: input.visibility,
      authorId,
    },
    select: { id: true },
  });

  await auditLog({
    action: 'post_created',
    entityType: 'post',
    entityId: post.id,
    userId: authorId,
    changes: {
      titleLength: input.title.length,
      bodyLength: input.body.length,
      visibility: input.visibility,
      hasActivistMailerUrl: Boolean(input.activistMailerUrl),
    },
    context: { source: 'composer' },
  });

  return post;
}
