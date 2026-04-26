/**
 * @build-unit BU-reactions
 * @spec architecture/decision-log.md (D050, D052)
 * @spec product/scenarios.md (SCN-3, SCN-20)
 *
 * Zod validation schemas for the reaction tRPC router. The
 * ReactionEmojiSchema mirrors the Prisma enum — keep these two in
 * sync. The schemas are used by both server (router input) and
 * client (form/component validation).
 *
 * Post-target schemas were the originals (D050). Comment-target
 * schemas land with D052 to enable reactions-on-comments UI.
 */

import { z } from 'zod';

/** Mirrors Prisma's ReactionEmoji enum. Keep in sync. */
export const ReactionEmojiSchema = z.enum([
  'candle',
  'pray',
  'heart',
  'strong',
  'target',
  'sparkle',
  'thumbsup',
  'sad',
]);

export type ReactionEmojiValue = z.infer<typeof ReactionEmojiSchema>;

export const reactionAddSchema = z.object({
  postId: z.string().uuid(),
  emoji: ReactionEmojiSchema,
});

export const reactionRemoveSchema = z.object({
  postId: z.string().uuid(),
  emoji: ReactionEmojiSchema,
});

export const reactionListForPostSchema = z.object({
  postId: z.string().uuid(),
});

export type ReactionAddInput = z.infer<typeof reactionAddSchema>;
export type ReactionRemoveInput = z.infer<typeof reactionRemoveSchema>;
export type ReactionListForPostInput = z.infer<typeof reactionListForPostSchema>;

// Comment-target variants (D052).

export const reactionAddToCommentSchema = z.object({
  commentId: z.string().uuid(),
  emoji: ReactionEmojiSchema,
});

export const reactionRemoveFromCommentSchema = z.object({
  commentId: z.string().uuid(),
  emoji: ReactionEmojiSchema,
});

export type ReactionAddToCommentInput = z.infer<typeof reactionAddToCommentSchema>;
export type ReactionRemoveFromCommentInput = z.infer<typeof reactionRemoveFromCommentSchema>;
