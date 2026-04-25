/**
 * @build-unit BU-reactions
 * @spec architecture/decision-log.md (D050)
 * @spec product/scenarios.md (SCN-3)
 * @spec product/analytics-events.md
 *
 * Reaction service — toggle and aggregate reactions on a target.
 * Targets are polymorphic (targetType + targetId); MVP supports
 * `post` only. Comments (BU-007) reuse this primitive.
 *
 * Toggle semantics:
 *   - addReaction is idempotent (re-react with same emoji is no-op)
 *   - removeReaction is idempotent (remove a reaction that doesn't
 *     exist is also no-op)
 *
 * Audit: every add/remove writes an AuditLog entry. The
 * `reaction_added` analytics event lives in this service per
 * analytics-events.md:133 (only on add — remove is silent).
 */

import type { ReactionEmoji } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';

// ── Types ────────────────────────────────────────────────────────────────

export interface ReactionAggregate {
  emoji: ReactionEmoji;
  count: number;
  mine: boolean;
}

interface AddRemoveInput {
  postId: string;
  emoji: ReactionEmoji;
  userId: string;
}

interface ListForPostInput {
  postId: string;
  callerId: string | null;
}

// Stable enum order for tiebreak when counts are equal.
const EMOJI_ORDER: ReactionEmoji[] = [
  'candle',
  'pray',
  'heart',
  'strong',
  'target',
  'sparkle',
  'thumbsup',
  'sad',
];

function emojiRank(e: ReactionEmoji): number {
  const idx = EMOJI_ORDER.indexOf(e);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

// ── Add ──────────────────────────────────────────────────────────────────

export async function addReaction(input: AddRemoveInput): Promise<{ success: true }> {
  try {
    await prisma.reaction.create({
      data: {
        userId: input.userId,
        targetType: 'post',
        targetId: input.postId,
        postId: input.postId,
        emoji: input.emoji,
      },
    });

    await auditLog({
      action: 'reaction.add',
      entityType: 'reaction',
      entityId: input.postId,
      userId: input.userId,
      changes: { emoji: input.emoji, postId: input.postId },
    });

    // Analytics — `reaction_added` per analytics-events.md:133.
    // Server-side console.warn is the structured-log channel until a
    // proper analytics writer lands; matches the post_created pattern
    // in createPost (which is silent for now).
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Unique constraint — user already has this emoji on this post.
      // Idempotent success.
      return { success: true };
    }
    throw err;
  }
  return { success: true };
}

// ── Remove ───────────────────────────────────────────────────────────────

export async function removeReaction(input: AddRemoveInput): Promise<{ success: true }> {
  const result = await prisma.reaction.deleteMany({
    where: {
      userId: input.userId,
      targetType: 'post',
      targetId: input.postId,
      emoji: input.emoji,
    },
  });

  if (result.count > 0) {
    await auditLog({
      action: 'reaction.remove',
      entityType: 'reaction',
      entityId: input.postId,
      userId: input.userId,
      changes: { emoji: input.emoji, postId: input.postId },
    });
  }

  return { success: true };
}

// ── List for post ────────────────────────────────────────────────────────

export async function listReactionsForPost(input: ListForPostInput): Promise<ReactionAggregate[]> {
  const grouped = await prisma.reaction.groupBy({
    by: ['emoji'],
    where: {
      targetType: 'post',
      targetId: input.postId,
    },
    _count: { _all: true },
  });

  const mineSet = new Set<ReactionEmoji>();
  if (input.callerId) {
    const mine = await prisma.reaction.findMany({
      where: {
        userId: input.callerId,
        targetType: 'post',
        targetId: input.postId,
      },
      select: { emoji: true },
    });
    for (const row of mine) mineSet.add(row.emoji);
  }

  return grouped
    .map((row) => ({
      emoji: row.emoji,
      count: row._count._all,
      mine: mineSet.has(row.emoji),
    }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return emojiRank(a.emoji) - emojiRank(b.emoji);
    });
}

// ── Bulk list (for feed pagination — avoids N+1) ─────────────────────────

export async function listReactionsForPosts(input: {
  postIds: string[];
  callerId: string | null;
}): Promise<Map<string, ReactionAggregate[]>> {
  if (input.postIds.length === 0) {
    return new Map();
  }

  const grouped = await prisma.reaction.groupBy({
    by: ['targetId', 'emoji'],
    where: {
      targetType: 'post',
      targetId: { in: input.postIds },
    },
    _count: { _all: true },
  });

  const minePairs = new Set<string>();
  if (input.callerId) {
    const mine = await prisma.reaction.findMany({
      where: {
        userId: input.callerId,
        targetType: 'post',
        targetId: { in: input.postIds },
      },
      select: { targetId: true, emoji: true },
    });
    for (const row of mine) minePairs.add(`${row.targetId}:${row.emoji}`);
  }

  const byPost = new Map<string, ReactionAggregate[]>();
  for (const postId of input.postIds) byPost.set(postId, []);

  for (const row of grouped) {
    const arr = byPost.get(row.targetId) ?? [];
    arr.push({
      emoji: row.emoji,
      count: row._count._all,
      mine: minePairs.has(`${row.targetId}:${row.emoji}`),
    });
    byPost.set(row.targetId, arr);
  }

  for (const [postId, arr] of byPost) {
    arr.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return emojiRank(a.emoji) - emojiRank(b.emoji);
    });
    byPost.set(postId, arr);
  }

  return byPost;
}
