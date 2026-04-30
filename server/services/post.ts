/**
 * @build-unit BU-feed BU-composer BU-link-share BU-post-hero-demo BU-tick-or-cross BU-event-time
 * @spec product/post-creation-flow.md
 * @spec architecture/decision-log.md (D045, D048, D060, D064, D069, D073)
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Post service — business logic for listing and creating posts.
 * Handles visibility filtering, soft-delete exclusion, cursor
 * pagination, and post creation with audit logging.
 * Layer boundary: services → db + shared only.
 *
 * BU-event-time / D073: structured event-time fields land on createPost
 * + a new updatePost path + a new listUpcoming query. Server validates
 * the eventEndsAt >= eventAt invariant (defence-in-depth — Zod runs at
 * the API boundary; the service runs again so seed scripts using the
 * raw input shape can't bypass it). Permissions for updatePost: own
 * post (any role) / coordinator within region / director everywhere.
 */

import type { PostVisibility, Signal, SystemRole } from '@prisma/client';
import { prisma } from '@/server/db/client';
import type { PostCreateInput, PostUpdateInput } from '@/shared/validation/post';
import { isAllowedHeroImageUrl } from '@/shared/seed-images';
import { todayStartLondonUtc } from '@/shared/format-event-time';
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
  /** Amplify (✅) / flag (❌) choice (BU-tick-or-cross / D069). */
  signal: Signal | null;
  /** Timestamp set when the author confirms the WhatsApp paste landed. */
  sharedToNetworkAt: Date | null;
  groupTags: string[];
  /** Structured event-time fields (BU-event-time / D073). UTC; null = absent. */
  eventAt: Date | null;
  eventEndsAt: Date | null;
  locationText: string | null;
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
    signal: post.signal,
    sharedToNetworkAt: post.sharedToNetworkAt,
    groupTags: post.groupTags,
    eventAt: post.eventAt,
    eventEndsAt: post.eventEndsAt,
    locationText: post.locationText,
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

  // D069: signal is required iff kind.slug === 'tick_or_cross', forbidden
  // otherwise. Resolve the kind's slug once so the invariant runs against
  // the same row the create will reference.
  const kindSlug = input.kindId
    ? ((
        await prisma.postKind.findUnique({
          where: { id: input.kindId },
          select: { slug: true },
        })
      )?.slug ?? null)
    : null;
  if (kindSlug === 'tick_or_cross' && !input.signal) {
    throw new Error('signal is required for tick_or_cross posts');
  }
  if (kindSlug !== 'tick_or_cross' && input.signal) {
    throw new Error('signal is only valid for tick_or_cross posts');
  }

  // BU-event-time / D073: defence-in-depth — Zod enforces this at the
  // API boundary, but the service is also called from seed scripts
  // that build raw input shapes without parsing. Keep the invariant
  // co-located with the only function that writes the columns.
  if (input.eventAt && input.eventEndsAt && input.eventEndsAt < input.eventAt) {
    throw new Error('eventEndsAt must be the same as or after eventAt');
  }

  const locationText = input.locationText?.trim() || null;

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
      signal: input.signal ?? null,
      visibility: input.visibility,
      authorId,
      eventAt: input.eventAt ?? null,
      eventEndsAt: input.eventEndsAt ?? null,
      locationText,
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
      kindSlug,
      signal: input.signal ?? null,
      urgency,
      hasEventAt: Boolean(input.eventAt),
      hasEventEndsAt: Boolean(input.eventEndsAt),
      hasLocationText: Boolean(locationText),
    },
    context: { source: 'composer' },
  });

  return post;
}

// ── Update ──────────────────────────────────────────────────────────────
//
// BU-event-time / D073. Edit an existing post — used by the new
// /post/[id]/edit surface. Permissions:
//
//  - Author of the post: any field, always.
//  - Director (`admin` system role): any field on any post.
//  - Coordinator (`queue_manager` system role): any field on any post
//    in their region. We don't yet have a server-side region scope on
//    Post (no `regionSlug` column), so coordinators are treated as
//    "edit any post" in MVP. The permission matrix in the brief is
//    forward-looking; the gate tightens once region scoping lands.
//
// On update we run the same kind / urgency / signal / hero-image
// invariants `createPost` runs, plus the BU-event-time
// `eventEndsAt >= eventAt` cross-field check. Every field is optional
// in the input — `undefined` means "don't change", and explicit
// `null` clears a nullable column.

export async function updatePost(
  input: PostUpdateInput,
  callerId: string,
): Promise<{ id: string }> {
  const existing = await prisma.post.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      authorId: true,
      kindId: true,
      eventAt: true,
      eventEndsAt: true,
      deletedAt: true,
    },
  });
  if (!existing || existing.deletedAt) {
    throw new Error('post not found');
  }

  // Permission: author OR caller has admin / queue_manager role grant.
  if (existing.authorId !== callerId) {
    const grants = await prisma.roleGrant.findMany({
      where: {
        userId: callerId,
        revokedAt: null,
        role: { in: ['admin', 'queue_manager'] },
      },
      select: { role: true },
    });
    if (grants.length === 0) {
      throw new Error('not allowed to edit this post');
    }
  }

  // Resolve the kindId we'll write — `undefined` means "leave alone";
  // `null` / empty clears it.
  const nextKindId = input.kindId === undefined ? existing.kindId : input.kindId?.trim() || null;

  // Re-run urgency invariant against the resolved kind.
  let urgency: boolean | undefined = input.urgency;
  if (urgency === true) {
    if (!nextKindId) urgency = false;
    else {
      const k = await prisma.postKind.findUnique({
        where: { id: nextKindId },
        select: { isAlertEligible: true, deletedAt: true },
      });
      if (!k || k.deletedAt || !k.isAlertEligible) urgency = false;
    }
  }

  // Hero image allow-list defence-in-depth.
  let heroImageUrl: string | null | undefined;
  if (Object.prototype.hasOwnProperty.call(input, 'heroImageUrl')) {
    const raw = input.heroImageUrl;
    if (raw === null || raw === '' || raw === undefined) {
      heroImageUrl = null;
    } else {
      if (!isAllowedHeroImageUrl(raw)) {
        throw new Error('heroImageUrl must be one of the seeded demo images');
      }
      heroImageUrl = raw;
    }
  }

  // Signal coupling: required iff the resolved kind slug is tick_or_cross.
  const nextKindSlug = nextKindId
    ? ((
        await prisma.postKind.findUnique({
          where: { id: nextKindId },
          select: { slug: true },
        })
      )?.slug ?? null)
    : null;
  if (input.signal !== undefined) {
    if (nextKindSlug === 'tick_or_cross' && !input.signal) {
      throw new Error('signal is required for tick_or_cross posts');
    }
    if (nextKindSlug !== 'tick_or_cross' && input.signal) {
      throw new Error('signal is only valid for tick_or_cross posts');
    }
  }

  // Cross-field event-time invariant — compute the next values that
  // WILL persist, not just the input, so an edit that drops the start
  // but keeps the end (or vice versa) is checked correctly.
  const nextEventAt = input.eventAt === undefined ? existing.eventAt : (input.eventAt ?? null);
  const nextEventEndsAt =
    input.eventEndsAt === undefined ? existing.eventEndsAt : (input.eventEndsAt ?? null);
  if (nextEventAt && nextEventEndsAt && nextEventEndsAt < nextEventAt) {
    throw new Error('eventEndsAt must be the same as or after eventAt');
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data['title'] = input.title;
  if (input.body !== undefined) data['body'] = input.body;
  if (input.visibility !== undefined) data['visibility'] = input.visibility;
  if (input.activistMailerUrl !== undefined)
    data['activistMailerUrl'] = input.activistMailerUrl?.trim() || null;
  if (input.linkUrl !== undefined) data['linkUrl'] = input.linkUrl?.trim() || null;
  if (input.linkTitle !== undefined) data['linkTitle'] = input.linkTitle?.trim() || null;
  if (input.linkDescription !== undefined)
    data['linkDescription'] = input.linkDescription?.trim() || null;
  if (input.linkImageUrl !== undefined) data['linkImageUrl'] = input.linkImageUrl?.trim() || null;
  if (input.linkSiteName !== undefined) data['linkSiteName'] = input.linkSiteName?.trim() || null;
  if (input.kindId !== undefined) data['kindId'] = input.kindId?.trim() || null;
  if (urgency !== undefined) data['urgency'] = urgency;
  if (heroImageUrl !== undefined) data['heroImageUrl'] = heroImageUrl;
  if (input.signal !== undefined) data['signal'] = input.signal ?? null;
  if (input.eventAt !== undefined) data['eventAt'] = input.eventAt ?? null;
  if (input.eventEndsAt !== undefined) data['eventEndsAt'] = input.eventEndsAt ?? null;
  if (input.locationText !== undefined) data['locationText'] = input.locationText?.trim() || null;

  await prisma.post.update({
    where: { id: input.id },
    data,
  });

  await auditLog({
    action: 'post_updated',
    entityType: 'post',
    entityId: input.id,
    userId: callerId,
    changes: {
      fieldsUpdated: Object.keys(data),
      isAuthor: existing.authorId === callerId,
    },
    context: { source: 'edit-page' },
  });

  return { id: input.id };
}

// ── listUpcoming ────────────────────────────────────────────────────────
//
// BU-event-time / D073. Returns posts with `eventAt` set and at-or-
// after the supplied `from` cutoff (default: today 00:00 in
// Europe/London), ordered ascending by `eventAt`. Respects the same
// visibility rules as `listPosts`.
//
// Consumed by bu-calendar-view (next BU) for the agenda + month
// surfaces. Optional `kindSlugs` filter for the future "events only"
// vs "meetings only" tabs.

interface ListUpcomingInput {
  callerId: string | null;
  from?: Date;
  to?: Date;
  kindSlugs?: readonly string[];
  limit?: number;
}

export async function listUpcoming(input: ListUpcomingInput): Promise<{ posts: PostListItem[] }> {
  const limit = Math.min(input.limit ?? 100, MAX_LIMIT);
  const from = input.from ?? todayStartLondonUtc();
  const visibilityFilter: PostVisibility[] = input.callerId
    ? ['public', 'authenticated_only']
    : ['public'];

  const eventAtClause: { gte: Date; lte?: Date } = { gte: from };
  if (input.to) eventAtClause.lte = input.to;

  const kindFilter =
    input.kindSlugs && input.kindSlugs.length > 0
      ? { kind: { slug: { in: [...input.kindSlugs] } } }
      : {};

  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      visibility: { in: visibilityFilter },
      eventAt: eventAtClause,
      ...kindFilter,
    },
    orderBy: [{ eventAt: 'asc' }, { id: 'asc' }],
    take: limit,
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

  const postIds = posts.map((p) => p.id);
  const [reactionsByPost, commentCountsByPost] = await Promise.all([
    listReactionsForPosts({ postIds, callerId: input.callerId }),
    listCommentCountsForPosts({ postIds }),
  ]);

  const mapped: PostListItem[] = posts.map((post) => ({
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
    signal: post.signal,
    sharedToNetworkAt: post.sharedToNetworkAt,
    groupTags: post.groupTags,
    eventAt: post.eventAt,
    eventEndsAt: post.eventEndsAt,
    locationText: post.locationText,
    createdAt: post.createdAt,
    author: {
      id: post.author.id,
      displayName: post.author.displayName,
      roles: post.author.roleGrants.map((g) => g.role),
    },
    reactions: reactionsByPost.get(post.id) ?? [],
    commentCount: commentCountsByPost.get(post.id) ?? 0,
  }));

  return { posts: mapped };
}

// ── markSharedToNetwork ─────────────────────────────────────────────────
//
// BU-tick-or-cross / D069. Idempotent setter: stamps `sharedToNetworkAt`
// to now() if the post exists and the column is currently null. Second
// and subsequent calls are no-ops. Returns `{ alreadyShared }` so the
// caller can distinguish the two states for analytics / UI feedback.
//
// Open to anyone authenticated per pre-brief decision #3 — the demo
// trusts the self-report. Server-side delivery verification is out of
// scope until D016 lands.
export async function markSharedToNetwork(
  postId: string,
  callerId: string,
): Promise<{ alreadyShared: boolean; sharedToNetworkAt: Date }> {
  const existing = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, sharedToNetworkAt: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    throw new Error('post not found');
  }
  if (existing.sharedToNetworkAt) {
    return { alreadyShared: true, sharedToNetworkAt: existing.sharedToNetworkAt };
  }

  const now = new Date();
  await prisma.post.update({
    where: { id: postId },
    data: { sharedToNetworkAt: now },
  });

  await auditLog({
    action: 'post_shared_to_network',
    entityType: 'post',
    entityId: postId,
    userId: callerId,
    changes: { sharedToNetworkAt: now.toISOString() },
    context: { source: 'send-to-network-confirm' },
  });

  return { alreadyShared: false, sharedToNetworkAt: now };
}
