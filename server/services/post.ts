/**
 * @build-unit BU-feed BU-composer BU-link-share BU-post-hero-demo
 * @spec product/post-creation-flow.md
 * @spec architecture/decision-log.md (D045, D048, D060, D064)
 *
 * Post service — business logic for listing and creating posts.
 * Handles visibility filtering, soft-delete exclusion, cursor
 * pagination, and post creation with audit logging.
 * Layer boundary: services → db + shared only.
 */

import type { PostVisibility, SystemRole } from '@prisma/client';
import { prisma } from '@/server/db/client';
import type { PostCreateInput } from '@/shared/validation/post';
import { isAllowedHeroImageUrl } from '@/shared/seed-images';
import { auditLog } from '@/server/services/audit';
import { listReactionsForPosts, type ReactionAggregate } from '@/server/services/reaction';
import { listCommentCountsForPosts } from '@/server/services/comment';
import type { FeedFilter } from '@/shared/feed-filters';

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
  /** Link-share preview card data (BU-link-share / D060). */
  linkUrl: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  linkImageUrl: string | null;
  linkSiteName: string | null;
  /** Intent kind (D062 revised — FK). Slug + display surfaced for clients. */
  kindId: string | null;
  kindSlug: string | null;
  kindDisplayName: string | null;
  isAlertEligibleKind: boolean;
  /** Alert flag (D062 revised, orthogonal to kind). */
  urgency: boolean;
  /** Member-picked hero image URL (BU-post-hero-demo / D064). */
  heroImageUrl: string | null;
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
  filter?: FeedFilter;
}

// ── Service ──────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function filterToWhere(filter: FeedFilter | undefined): Record<string, unknown> {
  switch (filter) {
    case undefined:
    case 'all':
      return {};
    case 'urgent':
      return { urgency: true };
    case 'happening_now':
    case 'meeting':
    case 'event':
      return { kind: { slug: filter } };
  }
}

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

  const filterWhere = filterToWhere(input.filter);

  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      visibility: { in: visibilityFilter },
      ...filterWhere,
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
      kind: { select: { slug: true, displayName: true, isAlertEligible: true } },
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
    linkUrl: post.linkUrl,
    linkTitle: post.linkTitle,
    linkDescription: post.linkDescription,
    linkImageUrl: post.linkImageUrl,
    linkSiteName: post.linkSiteName,
    kindId: post.kindId,
    kindSlug: post.kind?.slug ?? null,
    kindDisplayName: post.kind?.displayName ?? null,
    isAlertEligibleKind: post.kind?.isAlertEligible ?? false,
    urgency: post.urgency,
    heroImageUrl: post.heroImageUrl,
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
  // D062 §2: enforce alert orthogonality at the service. urgency=true is
  // only allowed when the selected PostKind has isAlertEligible=true.
  let urgency = input.urgency ?? false;
  if (urgency && input.kindId) {
    const k = await prisma.postKind.findUnique({
      where: { id: input.kindId },
      select: { isAlertEligible: true, deletedAt: true },
    });
    if (!k || k.deletedAt || !k.isAlertEligible) urgency = false;
  } else if (urgency && !input.kindId) {
    // No kind picked → can't be an alert (kind drives eligibility).
    urgency = false;
  }

  // D064: defence-in-depth — schema validator already enforces the
  // allow-list, but verify here too in case the service is called from
  // a path that bypasses Zod (e.g. seed scripts using the raw input
  // shape). Empty/undefined → null.
  const heroImageUrl = input.heroImageUrl?.trim() || null;
  if (heroImageUrl !== null && !isAllowedHeroImageUrl(heroImageUrl)) {
    throw new Error('heroImageUrl must be one of the seeded demo images');
  }

  const post = await prisma.post.create({
    data: {
      title: input.title,
      body: input.body,
      activistMailerUrl: input.activistMailerUrl?.trim() || null,
      linkUrl: input.linkUrl?.trim() || null,
      linkTitle: input.linkTitle?.trim() || null,
      linkDescription: input.linkDescription?.trim() || null,
      linkImageUrl: input.linkImageUrl?.trim() || null,
      linkSiteName: input.linkSiteName?.trim() || null,
      kindId: input.kindId?.trim() || null,
      urgency,
      heroImageUrl,
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
      hasLinkUrl: Boolean(input.linkUrl),
      hasHeroImageUrl: Boolean(heroImageUrl),
      kindId: input.kindId ?? null,
      urgency,
    },
    context: { source: 'composer' },
  });

  return post;
}
