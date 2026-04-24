/**
 * @build-unit BU-feed
 * @spec product/post-creation-flow.md
 * @spec architecture/decision-log.md (D045)
 *
 * Post service — business logic for listing posts.
 * Handles visibility filtering, soft-delete exclusion, and cursor
 * pagination. Layer boundary: services → db + shared only.
 */

import type { PostVisibility, SystemRole } from '@prisma/client';
import { prisma } from '@/server/db/client';

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
  }));

  return { posts: mapped, nextCursor };
}
